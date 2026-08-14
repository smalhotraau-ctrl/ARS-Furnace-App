// Shared helpers for every offline sync queue in the app.
//
// heatService.ts / heatOfflineStore.ts implemented this pattern first (see the comments there
// for the full root-cause writeup: queue removal compared objects with `!==` after a fresh
// JSON.parse(), which never matched anything, so a "removed" action was never actually removed
// and every sync re-sent the entire historical queue). Every queue added after that one
// (output, dispatch, spectro, batch-plan) shares the same shape of risk and should use these
// helpers instead of re-implementing the pattern per file.

type FurnaceAccessor = () => { from: (table: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

// A payload should never carry an `id` into a fresh insert — every table's `id` is
// server-generated (DEFAULT gen_random_uuid(), see schema.sql), and dedup is meant to run purely
// on `idempotency_key`. In practice some queue entries still had a client-side `id` attached
// (legacy entries created before this file existed, back when a queue action that had already
// succeeded was never actually removed — see the root-cause note above — could carry the id its
// insert was given on that earlier successful attempt). Sending that id back on a retry collides
// with the primary key directly: `ON CONFLICT (idempotency_key)` only suppresses a clash on that
// column, a separate clash on `id` still raises a hard, uncaught 23505 error, which is exactly
// what surfaced live on heats/cycle_log/heat_cancel_requests.
//
// Guarded here for every caller at once: if a payload carries an `id` that already exists in the
// target table, the row was already written by a previous attempt — fetch it back and reconcile
// instead of inserting anything (this is the same "confirmed duplicate" path as an
// idempotency_key conflict, just keyed on the primary key instead). Otherwise `id` is always
// stripped before the actual insert so the server assigns a fresh one, and dedup continues to run
// on idempotency_key exactly as before.
async function resolveExistingById(
  furnace: FurnaceAccessor,
  table: string,
  id: unknown,
): Promise<{ row: Record<string, unknown> | null; error: unknown } | null> {
  if (typeof id !== 'string') return null
  const { data, error } = await furnace().from(table).select('*').eq('id', id).maybeSingle()
  if (error) return { row: null, error }
  if (data) return { row: data as Record<string, unknown>, error: null }
  return null
}

// INSERT keyed by a client-generated `idempotency_key`, so a retried queue action (a flush that
// reports ambiguous failure and gets correctly retried, two tabs/devices open at once, a
// concurrent flush that slips past the in-flight lock, etc.) can never create a second row.
// `ignoreDuplicates: true` compiles to INSERT ... ON CONFLICT (idempotency_key) DO NOTHING at the
// PostgREST layer. On a genuine conflict, PostgREST returns zero rows even though the row
// already exists — that's a CONFIRMED duplicate (the action already succeeded on a previous
// attempt), not a failure, so the existing row is fetched back by its idempotency key so local
// cache/state can still be reconciled. Callers must only remove the action from their local
// queue when `error` is falsy AND `row` is present — never on an ambiguous/ real failure.
export async function insertIdempotent(
  furnace: FurnaceAccessor,
  table: string,
  payload: Record<string, unknown>,
): Promise<{ row: Record<string, unknown> | null; error: unknown }> {
  const { id, ...rest } = payload

  const byId = await resolveExistingById(furnace, table, id)
  if (byId) return byId

  const { data, error } = await furnace()
    .from(table)
    .upsert(rest, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    .select('*')

  if (error) return { row: null, error }
  if (data && data.length > 0) return { row: data[0] as Record<string, unknown>, error: null }

  const { data: existing, error: fetchError } = await furnace()
    .from(table)
    .select('*')
    .eq('idempotency_key', rest.idempotency_key as string)
    .maybeSingle()
  return { row: (existing as Record<string, unknown> | null) ?? null, error: fetchError }
}

// Same as insertIdempotent but for a batch of rows in one call (e.g. dispatch_lines, several
// rows per dispatch). Postgres/PostgREST silently omits conflicting rows from the response when
// ignoreDuplicates is set, so rows that already existed from an earlier attempt are fetched back
// by their idempotency_key and merged back in — every payload row is guaranteed to come back in
// the result unless it genuinely failed. Applies the same legacy-id guard as insertIdempotent
// (see its comment above) per row before inserting anything.
export async function insertManyIdempotent(
  furnace: FurnaceAccessor,
  table: string,
  payloads: Record<string, unknown>[],
): Promise<{ rows: Record<string, unknown>[]; error: unknown }> {
  if (payloads.length === 0) return { rows: [], error: null }

  const idsToCheck = payloads.map((p) => p.id).filter((id): id is string => typeof id === 'string')

  const existingById = new Map<string, Record<string, unknown>>()
  if (idsToCheck.length > 0) {
    const { data, error } = await furnace().from(table).select('*').in('id', idsToCheck)
    if (error) return { rows: [], error }
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      existingById.set(row.id as string, row)
    }
  }

  const alreadySynced: Record<string, unknown>[] = []
  const toInsert: Record<string, unknown>[] = []
  for (const payload of payloads) {
    const { id, ...rest } = payload
    const matched = typeof id === 'string' ? existingById.get(id) : undefined
    if (matched) {
      alreadySynced.push(matched)
    } else {
      toInsert.push(rest)
    }
  }

  if (toInsert.length === 0) return { rows: alreadySynced, error: null }

  const { data, error } = await furnace()
    .from(table)
    .upsert(toInsert, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    .select('*')

  if (error) return { rows: alreadySynced, error }

  const returned = (data ?? []) as Record<string, unknown>[]
  const returnedKeys = new Set(returned.map((r) => r.idempotency_key))
  const missingKeys = toInsert
    .map((p) => p.idempotency_key as string)
    .filter((k) => !returnedKeys.has(k))

  if (missingKeys.length === 0) return { rows: [...alreadySynced, ...returned], error: null }

  const { data: existing, error: fetchError } = await furnace()
    .from(table)
    .select('*')
    .in('idempotency_key', missingKeys)

  if (fetchError) return { rows: [...alreadySynced, ...returned], error: fetchError }
  return {
    rows: [...alreadySynced, ...returned, ...((existing ?? []) as Record<string, unknown>[])],
    error: null,
  }
}

// Ensures only one flush of a given queue can run at a time. Without this, two triggers firing
// close together for the same queue (a page's 'online' listener, DevRoleSwitcher's pre-switch
// flush, and every add*/submit* function's own fire-and-forget sync call) would each read their
// own snapshot of the queue and process the same still-queued actions concurrently, submitting
// the same insert twice before either flush had a chance to remove it. Concurrent callers now
// share one in-flight run instead of racing. Call once per queue at module scope to get an
// independent lock per queue (each call to createInFlightLock() has its own private state).
export function createInFlightLock<T>() {
  let inFlight: Promise<T> | null = null
  return function runExclusive(task: () => Promise<T>): Promise<T> {
    if (inFlight) return inFlight
    const run = task().finally(() => {
      inFlight = null
    })
    inFlight = run
    return run
  }
}

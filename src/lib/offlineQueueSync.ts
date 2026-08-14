// Shared helpers for every offline sync queue in the app.
//
// heatService.ts / heatOfflineStore.ts implemented this pattern first (see the comments there
// for the full root-cause writeup: queue removal compared objects with `!==` after a fresh
// JSON.parse(), which never matched anything, so a "removed" action was never actually removed
// and every sync re-sent the entire historical queue). Every queue added after that one
// (output, dispatch, spectro, batch-plan) shares the same shape of risk and should use these
// helpers instead of re-implementing the pattern per file.

type FurnaceAccessor = () => { from: (table: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

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
  const { data, error } = await furnace()
    .from(table)
    .upsert(payload, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    .select('*')

  if (error) return { row: null, error }
  if (data && data.length > 0) return { row: data[0] as Record<string, unknown>, error: null }

  const { data: existing, error: fetchError } = await furnace()
    .from(table)
    .select('*')
    .eq('idempotency_key', payload.idempotency_key as string)
    .maybeSingle()
  return { row: (existing as Record<string, unknown> | null) ?? null, error: fetchError }
}

// Same as insertIdempotent but for a batch of rows in one call (e.g. dispatch_lines, several
// rows per dispatch). Postgres/PostgREST silently omits conflicting rows from the response when
// ignoreDuplicates is set, so rows that already existed from an earlier attempt are fetched back
// by their idempotency_key and merged back in — every payload row is guaranteed to come back in
// the result unless it genuinely failed.
export async function insertManyIdempotent(
  furnace: FurnaceAccessor,
  table: string,
  payloads: Record<string, unknown>[],
): Promise<{ rows: Record<string, unknown>[]; error: unknown }> {
  if (payloads.length === 0) return { rows: [], error: null }

  const { data, error } = await furnace()
    .from(table)
    .upsert(payloads, { onConflict: 'idempotency_key', ignoreDuplicates: true })
    .select('*')

  if (error) return { rows: [], error }

  const returned = (data ?? []) as Record<string, unknown>[]
  const returnedKeys = new Set(returned.map((r) => r.idempotency_key))
  const missingKeys = payloads
    .map((p) => p.idempotency_key as string)
    .filter((k) => !returnedKeys.has(k))

  if (missingKeys.length === 0) return { rows: returned, error: null }

  const { data: existing, error: fetchError } = await furnace()
    .from(table)
    .select('*')
    .in('idempotency_key', missingKeys)

  if (fetchError) return { rows: returned, error: fetchError }
  return { rows: [...returned, ...((existing ?? []) as Record<string, unknown>[])], error: null }
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

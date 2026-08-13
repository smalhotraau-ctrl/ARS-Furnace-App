import { supabase } from './supabaseClient'
import {
  addLocalBundle,
  addLocalDispatch,
  addLocalDispatchLines,
  enqueueDispatchAction,
  getCachedBundles,
  getCachedDispatchLines,
  getCachedDispatches,
  getQueue,
  replaceDispatchIdOnLines,
  rowToBundle,
  rowToDispatch,
  rowToDispatchLine,
  setCachedBundles,
  setCachedDispatchLines,
  setCachedDispatches,
  setQueue,
  updateLocalBundle,
  updateLocalDispatch,
} from './dispatchOfflineStore'
import { getCachedFgStock, rowToFgStock, setCachedFgStock } from './outputOfflineStore'
import type { AppUser } from '../types/auth'
import type { Bundle, Dispatch, DispatchLine, DispatchLineDraft } from '../types/dispatch'
import type { FgStock } from '../types/output'

const furnace = () => supabase.schema('furnace')

export async function fetchBundles(heatId?: string): Promise<Bundle[]> {
  let query = furnace().from('bundles').select('*').order('packed_at', { ascending: false })
  if (heatId) query = query.eq('heat_id', heatId)

  const { data, error } = await query
  if (error) throw error

  const serverBundles = (data ?? []).map((row) => rowToBundle(row as Record<string, unknown>))
  const localPending = getCachedBundles().filter((b) => b._pending && (!heatId || b.heat_id === heatId))
  const merged = new Map<string, Bundle>()
  for (const b of serverBundles) merged.set(b.id, b)
  for (const b of localPending) merged.set(b.id, b)

  const result = [...merged.values()].sort((a, b) => b.packed_at.localeCompare(a.packed_at))
  setCachedBundles(result)
  return heatId ? result.filter((b) => b.heat_id === heatId) : result
}

export async function fetchDispatches(): Promise<Dispatch[]> {
  const { data, error } = await furnace()
    .from('dispatches')
    .select('*')
    .order('dispatch_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  const serverDispatches = (data ?? []).map((row) => rowToDispatch(row as Record<string, unknown>))
  const localPending = getCachedDispatches().filter((d) => d._pending)
  const merged = new Map<string, Dispatch>()
  for (const d of serverDispatches) merged.set(d.id, d)
  for (const d of localPending) merged.set(d.id, d)

  const result = [...merged.values()].sort((a, b) => b.dispatch_date.localeCompare(a.dispatch_date))
  setCachedDispatches(result)
  return result
}

export async function fetchDispatchLines(dispatchId?: string): Promise<DispatchLine[]> {
  let query = furnace().from('dispatch_lines').select('*')
  if (dispatchId) query = query.eq('dispatch_id', dispatchId)

  const { data, error } = await query
  if (error) throw error

  const serverLines = (data ?? []).map((row) => rowToDispatchLine(row as Record<string, unknown>))
  const localPending = getCachedDispatchLines().filter(
    (l) => l._pending && (!dispatchId || l.dispatch_id === dispatchId),
  )
  const merged = new Map<string, DispatchLine>()
  for (const l of serverLines) merged.set(l.id, l)
  for (const l of localPending) merged.set(l.id, l)

  const result = [...merged.values()]
  setCachedDispatchLines(result)
  return dispatchId ? result.filter((l) => l.dispatch_id === dispatchId) : result
}

export async function fetchFgStockList(): Promise<FgStock[]> {
  const { data, error } = await furnace().from('fg_stock').select('*').order('updated_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []).map((row) => rowToFgStock(row as Record<string, unknown>))
  setCachedFgStock(rows)
  return rows
}

export function loadLocalBundles(): Bundle[] {
  return getCachedBundles()
}

export function loadLocalDispatches(): Dispatch[] {
  return getCachedDispatches()
}

export function loadLocalDispatchLines(): DispatchLine[] {
  return getCachedDispatchLines()
}

// Bundling is a simple reference/traceability record — Supervisor entry only, does not move
// stock. Offline-capable like charge lines and output entry (03g §1).
export async function saveBundle(
  user: AppUser,
  heatId: string,
  values: { bundle_no: string; pieces: number; weight_kg: number },
): Promise<Bundle> {
  const now = new Date().toISOString()
  const localId = crypto.randomUUID()
  const payload = {
    heat_id: heatId,
    bundle_no: values.bundle_no,
    pieces: values.pieces,
    weight_kg: values.weight_kg,
    packed_by: user.id,
    packed_at: now,
  }

  const localBundle: Bundle = { id: localId, _localId: localId, _pending: true, ...payload }

  addLocalBundle(localBundle)
  enqueueDispatchAction({ kind: 'bundle_insert', localId, payload })

  if (navigator.onLine) void syncDispatchQueue()
  return localBundle
}

// Creates a dispatch header plus one or more dispatch_lines in one action. Each line
// decrements fg_stock.kg_available for its specific heat — this is what gives lot-level
// traceability on shipped goods even when several heats are combined on one invoice (03g §2).
// Over-drawing a heat's available stock is a warning only, never a hard block, so this is
// safe to queue offline like everything else on the floor — the check is always best-effort.
export async function saveDispatch(
  user: AppUser,
  header: { party_name: string; invoice_no: string; dispatch_date: string },
  lines: DispatchLineDraft[],
): Promise<{ dispatch: Dispatch; lines: DispatchLine[] }> {
  const now = new Date().toISOString()
  const localId = crypto.randomUUID()
  const totalKg = lines.reduce((sum, l) => sum + l.kg_dispatched, 0)

  const headerPayload = {
    party_name: header.party_name,
    invoice_no: header.invoice_no,
    dispatch_date: header.dispatch_date,
    shortage_kg: null,
    shortage_reported_date: null,
    created_by: user.id,
  }

  const localDispatch: Dispatch = {
    id: localId,
    _localId: localId,
    _pending: true,
    ...headerPayload,
    kg_dispatched: totalKg,
    created_at: now,
    updated_by: null,
    updated_at: null,
  }
  addLocalDispatch(localDispatch)

  const lineDrafts = lines.map((l) => ({ localId: crypto.randomUUID(), heat_id: l.heat_id, kg_dispatched: l.kg_dispatched }))
  const localLines: DispatchLine[] = lineDrafts.map((l) => ({
    id: l.localId,
    _localId: l.localId,
    _pending: true,
    dispatch_id: localId,
    heat_id: l.heat_id,
    kg_dispatched: l.kg_dispatched,
    created_at: now,
  }))
  addLocalDispatchLines(localLines)

  // Optimistic client-side mirror of the fg_stock decrement trigger, so the next dispatch
  // entry in this session immediately reflects reduced availability without waiting on sync.
  const fgStock = getCachedFgStock()
  setCachedFgStock(
    fgStock.map((s) => {
      const line = lines.find((l) => l.heat_id === s.heat_id)
      return line ? { ...s, kg_available: s.kg_available - line.kg_dispatched, updated_at: now } : s
    }),
  )

  enqueueDispatchAction({ kind: 'dispatch_insert', localId, payload: headerPayload, lines: lineDrafts })

  if (navigator.onLine) void syncDispatchQueue()
  return { dispatch: localDispatch, lines: localLines }
}

export async function updateDispatchShortage(
  user: AppUser,
  dispatch: Dispatch,
  shortage_kg: number | null,
  shortage_reported_date: string | null,
): Promise<Dispatch> {
  const now = new Date().toISOString()
  const patch = { shortage_kg, shortage_reported_date, updated_by: user.id, updated_at: now }
  const updated: Dispatch = { ...dispatch, ...patch, _pending: true }
  updateLocalDispatch(dispatch.id, updated)
  enqueueDispatchAction({
    kind: 'dispatch_update',
    dispatchId: dispatch.id,
    localId: dispatch._localId,
    payload: patch,
  })
  if (navigator.onLine) void syncDispatchQueue()
  return updated
}

export async function syncDispatchQueue(): Promise<number> {
  if (!navigator.onLine) return getQueue().length

  const queue = [...getQueue()]

  for (const action of queue) {
    if (action.kind === 'bundle_insert') {
      const { data, error } = await furnace().from('bundles').insert(action.payload).select('*').single()
      if (error) continue
      const synced = rowToBundle(data as Record<string, unknown>)
      updateLocalBundle(action.localId, { ...synced, _localId: undefined, _pending: false })
      setQueue(getQueue().filter((a) => a !== action))
    }

    if (action.kind === 'dispatch_insert') {
      const { data, error } = await furnace().from('dispatches').insert(action.payload).select('*').single()
      if (error) continue
      const syncedDispatch = rowToDispatch(data as Record<string, unknown>)
      updateLocalDispatch(action.localId, { ...syncedDispatch, _localId: undefined, _pending: false })
      replaceDispatchIdOnLines(action.localId, syncedDispatch.id)

      const linesPayload = action.lines.map((l) => ({
        dispatch_id: syncedDispatch.id,
        heat_id: l.heat_id,
        kg_dispatched: l.kg_dispatched,
      }))
      const { data: lineRows, error: lineError } = await furnace().from('dispatch_lines').insert(linesPayload).select('*')
      if (lineError) continue

      const syncedLines = (lineRows ?? []).map((row) => rowToDispatchLine(row as Record<string, unknown>))
      for (let i = 0; i < action.lines.length; i++) {
        const draft = action.lines[i]
        const synced = syncedLines[i]
        if (synced) {
          setCachedDispatchLines(
            getCachedDispatchLines().map((l) =>
              l._localId === draft.localId ? { ...synced, _pending: false } : l,
            ),
          )
        }
      }
      setQueue(getQueue().filter((a) => a !== action))
    }

    if (action.kind === 'dispatch_update') {
      const resolvedId =
        getCachedDispatches().find((d) => d.id === action.dispatchId || d._localId === action.dispatchId)?.id ??
        action.dispatchId
      const { error } = await furnace().from('dispatches').update(action.payload).eq('id', resolvedId)
      if (error) continue
      updateLocalDispatch(action.dispatchId, { ...action.payload, _pending: false } as Partial<Dispatch>)
      setQueue(getQueue().filter((a) => a !== action))
    }
  }

  setCachedBundles(getCachedBundles())
  setCachedDispatches(getCachedDispatches())
  return getQueue().length
}

export { getDispatchPendingCount } from './dispatchOfflineStore'

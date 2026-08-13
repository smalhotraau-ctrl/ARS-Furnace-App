import type { Bundle, Dispatch, DispatchLine } from '../types/dispatch'

const BUNDLES_KEY = 'furnace:bundles'
const DISPATCHES_KEY = 'furnace:dispatches'
const DISPATCH_LINES_KEY = 'furnace:dispatch_lines'
const QUEUE_KEY = 'furnace:dispatch_queue'

export type DispatchQueueAction =
  | { kind: 'bundle_insert'; localId: string; payload: Record<string, unknown> }
  | {
      kind: 'dispatch_insert'
      localId: string
      payload: Record<string, unknown>
      lines: Array<{ localId: string; heat_id: string; kg_dispatched: number }>
    }
  | { kind: 'dispatch_update'; dispatchId: string; localId?: string; payload: Record<string, unknown> }

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getCachedBundles(): Bundle[] {
  return readJson<Bundle[]>(BUNDLES_KEY, [])
}

export function setCachedBundles(bundles: Bundle[]) {
  writeJson(BUNDLES_KEY, bundles)
}

export function addLocalBundle(bundle: Bundle) {
  setCachedBundles([
    bundle,
    ...getCachedBundles().filter((b) => b.id !== bundle.id && b._localId !== bundle._localId),
  ])
}

export function updateLocalBundle(id: string, patch: Partial<Bundle>) {
  setCachedBundles(
    getCachedBundles().map((b) => (b.id === id || b._localId === id ? { ...b, ...patch } : b)),
  )
}

export function getCachedDispatches(): Dispatch[] {
  return readJson<Dispatch[]>(DISPATCHES_KEY, [])
}

export function setCachedDispatches(dispatches: Dispatch[]) {
  writeJson(DISPATCHES_KEY, dispatches)
}

export function addLocalDispatch(dispatch: Dispatch) {
  setCachedDispatches([
    dispatch,
    ...getCachedDispatches().filter((d) => d.id !== dispatch.id && d._localId !== dispatch._localId),
  ])
}

export function updateLocalDispatch(id: string, patch: Partial<Dispatch>) {
  setCachedDispatches(
    getCachedDispatches().map((d) => (d.id === id || d._localId === id ? { ...d, ...patch } : d)),
  )
}

export function getCachedDispatchLines(): DispatchLine[] {
  return readJson<DispatchLine[]>(DISPATCH_LINES_KEY, [])
}

export function setCachedDispatchLines(lines: DispatchLine[]) {
  writeJson(DISPATCH_LINES_KEY, lines)
}

export function addLocalDispatchLines(lines: DispatchLine[]) {
  const existingIds = new Set(lines.map((l) => l.id))
  const existingLocalIds = new Set(lines.map((l) => l._localId).filter(Boolean))
  setCachedDispatchLines([
    ...lines,
    ...getCachedDispatchLines().filter((l) => !existingIds.has(l.id) && !existingLocalIds.has(l._localId)),
  ])
}

export function replaceDispatchIdOnLines(oldDispatchId: string, newDispatchId: string) {
  setCachedDispatchLines(
    getCachedDispatchLines().map((l) =>
      l.dispatch_id === oldDispatchId ? { ...l, dispatch_id: newDispatchId } : l,
    ),
  )
}

export function getQueue(): DispatchQueueAction[] {
  return readJson<DispatchQueueAction[]>(QUEUE_KEY, [])
}

export function setQueue(actions: DispatchQueueAction[]) {
  writeJson(QUEUE_KEY, actions)
}

export function enqueueDispatchAction(action: DispatchQueueAction) {
  setQueue([...getQueue(), action])
}

export function rowToBundle(row: Record<string, unknown>): Bundle {
  return {
    id: String(row.id),
    heat_id: String(row.heat_id),
    bundle_no: String(row.bundle_no),
    pieces: Number(row.pieces),
    weight_kg: Number(row.weight_kg),
    packed_by: String(row.packed_by),
    packed_at: String(row.packed_at),
  }
}

export function rowToDispatch(row: Record<string, unknown>): Dispatch {
  return {
    id: String(row.id),
    party_name: String(row.party_name),
    invoice_no: String(row.invoice_no),
    dispatch_date: String(row.dispatch_date),
    kg_dispatched: Number(row.kg_dispatched),
    shortage_kg: row.shortage_kg != null ? Number(row.shortage_kg) : null,
    shortage_reported_date: row.shortage_reported_date ? String(row.shortage_reported_date) : null,
    created_by: String(row.created_by),
    created_at: String(row.created_at),
    updated_by: row.updated_by ? String(row.updated_by) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  }
}

export function rowToDispatchLine(row: Record<string, unknown>): DispatchLine {
  return {
    id: String(row.id),
    dispatch_id: String(row.dispatch_id),
    heat_id: String(row.heat_id),
    kg_dispatched: Number(row.kg_dispatched),
    created_at: String(row.created_at),
  }
}

export function getDispatchPendingCount(): number {
  return getQueue().length
}

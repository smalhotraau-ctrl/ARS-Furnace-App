import type { FgStock, HeatOutput, HeatOutputFlag } from '../types/output'

const HEAT_OUTPUTS_KEY = 'furnace:heat_outputs'
const YIELD_FLAGS_KEY = 'furnace:heat_output_flags'
const FG_STOCK_KEY = 'furnace:fg_stock'
const QUEUE_KEY = 'furnace:output_queue'

// Every variant carries its own `queueId` — see heatOfflineStore.ts's HeatQueueAction comment
// for the full root-cause writeup. In short: removal used to compare action objects by
// reference (`a !== action`) after a fresh JSON.parse() of localStorage, which never matched
// anything, so nothing was ever actually removed from this queue either.
export type OutputQueueAction = (
  | { kind: 'output_insert'; localId: string; payload: Record<string, unknown> }
  | { kind: 'output_verify'; outputId: string; localId?: string; payload: Record<string, unknown> }
  | { kind: 'flag_insert'; localId: string; payload: Record<string, unknown> }
  | { kind: 'flag_acknowledge'; flagId: string; payload: Record<string, unknown> }
  | { kind: 'fg_stock_insert'; localId: string; payload: Record<string, unknown> }
) & { queueId: string }

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

const INSERT_KINDS_NEEDING_IDEMPOTENCY_KEY = new Set<OutputQueueAction['kind']>([
  'output_insert',
  'flag_insert',
  'fg_stock_insert',
])

// Self-heals queue entries written by older code before `queueId`/`idempotency_key` existed —
// see heatOfflineStore.ts's migrateLegacyQueueEntry for why this matters (a bare
// removeOutputQueueAction(undefined) would otherwise wipe out every other legacy entry that
// also lacks a queueId).
function migrateLegacyQueueEntry(raw: OutputQueueAction): OutputQueueAction {
  const action = raw as OutputQueueAction & { payload?: Record<string, unknown> }
  const queueId = action.queueId || crypto.randomUUID()

  let payload = action.payload
  if (payload && !payload.idempotency_key && INSERT_KINDS_NEEDING_IDEMPOTENCY_KEY.has(action.kind)) {
    payload = { ...payload, idempotency_key: crypto.randomUUID() }
  }

  if (queueId === action.queueId && payload === action.payload) return raw
  return { ...action, queueId, payload } as OutputQueueAction
}

export function getCachedHeatOutputs(): HeatOutput[] {
  return readJson<HeatOutput[]>(HEAT_OUTPUTS_KEY, [])
}

export function setCachedHeatOutputs(outputs: HeatOutput[]) {
  writeJson(HEAT_OUTPUTS_KEY, outputs)
}

export function addLocalHeatOutput(output: HeatOutput) {
  setCachedHeatOutputs([
    output,
    ...getCachedHeatOutputs().filter((o) => o.id !== output.id && o._localId !== output._localId),
  ])
}

export function updateLocalHeatOutput(id: string, patch: Partial<HeatOutput>) {
  setCachedHeatOutputs(
    getCachedHeatOutputs().map((o) => (o.id === id || o._localId === id ? { ...o, ...patch } : o)),
  )
}

export function getCachedYieldFlags(): HeatOutputFlag[] {
  return readJson<HeatOutputFlag[]>(YIELD_FLAGS_KEY, [])
}

export function setCachedYieldFlags(flags: HeatOutputFlag[]) {
  writeJson(YIELD_FLAGS_KEY, flags)
}

export function addLocalYieldFlag(flag: HeatOutputFlag) {
  setCachedYieldFlags([
    flag,
    ...getCachedYieldFlags().filter((f) => f.id !== flag.id && f._localId !== flag._localId),
  ])
}

export function updateLocalYieldFlag(id: string, patch: Partial<HeatOutputFlag>) {
  setCachedYieldFlags(
    getCachedYieldFlags().map((f) => (f.id === id || f._localId === id ? { ...f, ...patch } : f)),
  )
}

export function getCachedFgStock(): FgStock[] {
  return readJson<FgStock[]>(FG_STOCK_KEY, [])
}

export function setCachedFgStock(rows: FgStock[]) {
  writeJson(FG_STOCK_KEY, rows)
}

export function getOutputQueue(): OutputQueueAction[] {
  const raw = readJson<OutputQueueAction[]>(QUEUE_KEY, [])
  let changed = false
  const migrated = raw.map((action) => {
    const fixed = migrateLegacyQueueEntry(action)
    if (fixed !== action) changed = true
    return fixed
  })
  if (changed) writeJson(QUEUE_KEY, migrated)
  return migrated
}

export function setOutputQueue(actions: OutputQueueAction[]) {
  writeJson(QUEUE_KEY, actions)
}

type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never

export function enqueueOutputAction(action: DistributiveOmit<OutputQueueAction, 'queueId'>): OutputQueueAction {
  const stamped = { ...action, queueId: crypto.randomUUID() } as OutputQueueAction
  setOutputQueue([...getOutputQueue(), stamped])
  return stamped
}

// The only correct way to remove a processed action — matches by the stable queueId rather
// than object reference.
export function removeOutputQueueAction(queueId: string) {
  setOutputQueue(getOutputQueue().filter((a) => a.queueId !== queueId))
}

export function rowToHeatOutput(row: Record<string, unknown>): HeatOutput {
  return {
    id: String(row.id),
    heat_id: String(row.heat_id),
    ingot_kg: Number(row.ingot_kg),
    dross_kg: Number(row.dross_kg),
    rejection_kg: Number(row.rejection_kg),
    iron_kg: Number(row.iron_kg),
    exceptional_label: row.exceptional_label ? String(row.exceptional_label) : null,
    exceptional_kg: row.exceptional_kg != null ? Number(row.exceptional_kg) : null,
    burn_loss_kg: Number(row.burn_loss_kg),
    ingot_pct: Number(row.ingot_pct),
    dross_pct: Number(row.dross_pct),
    rejection_pct: Number(row.rejection_pct),
    iron_pct: Number(row.iron_pct),
    burn_loss_pct: Number(row.burn_loss_pct),
    verified_by: row.verified_by ? String(row.verified_by) : null,
    verified_at: row.verified_at ? String(row.verified_at) : null,
    recorded_by: String(row.recorded_by),
    recorded_at: String(row.recorded_at),
  }
}

export function rowToYieldFlag(row: Record<string, unknown>): HeatOutputFlag {
  return {
    id: String(row.id),
    heat_id: String(row.heat_id),
    metric: row.metric as HeatOutputFlag['metric'],
    actual_pct: Number(row.actual_pct),
    expected_min_pct: Number(row.expected_min_pct),
    expected_max_pct: Number(row.expected_max_pct),
    acknowledged_by: row.acknowledged_by ? String(row.acknowledged_by) : null,
    acknowledged_at: row.acknowledged_at ? String(row.acknowledged_at) : null,
    acknowledgement_note: row.acknowledgement_note ? String(row.acknowledgement_note) : null,
    created_at: String(row.created_at),
  }
}

export function rowToFgStock(row: Record<string, unknown>): FgStock {
  return {
    id: String(row.id),
    heat_id: String(row.heat_id),
    grade_code: String(row.grade_code),
    kg_available: Number(row.kg_available),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export function getOutputPendingCount(): number {
  return getOutputQueue().length
}

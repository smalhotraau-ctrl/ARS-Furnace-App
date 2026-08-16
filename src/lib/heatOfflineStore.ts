import type {
  ChargeLine,
  CycleLogEntry,
  Heat,
  HeatCancelRequest,
  HeatInsert,
  HeatNoCorrection,
  TempReading,
} from '../types/heat'
import { parseCrew } from '../types/heat'

const HEATS_KEY = 'furnace:heats'
const CHARGE_LINES_KEY = 'furnace:charge_lines'
const CYCLE_LOG_KEY = 'furnace:cycle_log'
const TEMP_READINGS_KEY = 'furnace:temp_readings'
const QUEUE_KEY = 'furnace:heat_queue'
const SYNC_ERRORS_KEY = 'furnace:heat_sync_errors'

export interface HeatSyncError {
  at: string
  action: HeatQueueAction['kind']
  message: string
  code?: string
}

// Every variant carries its own `queueId` — a client-generated id for the QUEUE ENTRY itself,
// distinct from `localId`/`requestId` (which identify the underlying business row). This is the
// only thing `syncHeatQueue` uses to remove a processed action. Removal used to compare action
// objects by reference (`a !== action`), which silently never matched anything: every call to
// getHeatQueue() does a fresh JSON.parse() of localStorage, producing brand-new object
// instances each time, so no parsed object is ever `===` to any other. Actions were never
// actually removed from the queue — every sync pass re-sent every action ever queued,
// resubmitting duplicate inserts (visible as repeated identical cancel requests, etc.) forever.
export type HeatQueueAction = (
  | { kind: 'heat_insert'; localId: string; payload: HeatInsert; emergency: boolean }
  | { kind: 'heat_update'; heatId: string; localId?: string; payload: Record<string, unknown> }
  | { kind: 'heat_assign_no'; heatId: string; localId?: string; heat_no: string }
  | { kind: 'charge_insert'; localId: string; payload: Record<string, unknown> }
  | { kind: 'cycle_insert'; localId: string; payload: Record<string, unknown> }
  | { kind: 'cycle_finish'; entryId: string; localId?: string; finish_ts: string }
  | { kind: 'temp_insert'; localId: string; payload: Record<string, unknown> }
  | { kind: 'cancel_request'; localId: string; payload: Record<string, unknown> }
  | { kind: 'cancel_decide'; requestId: string; payload: Record<string, unknown> }
  | { kind: 'correction_request'; localId: string; payload: Record<string, unknown> }
  | { kind: 'correction_decide'; requestId: string; payload: Record<string, unknown> }
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

const INSERT_KINDS_NEEDING_IDEMPOTENCY_KEY = new Set<HeatQueueAction['kind']>([
  'heat_insert',
  'charge_insert',
  'cycle_insert',
  'temp_insert',
  'cancel_request',
  'correction_request',
])

// Self-heals queue entries written by older code before `queueId`/`idempotency_key` existed.
// This matters a lot here specifically: if a legacy entry (queueId undefined) were left as-is,
// the first successful removeHeatQueueAction(undefined) would match every other legacy entry
// that also has queueId undefined and silently wipe them all from the local queue — without
// them ever having reached the server. Backfilling on read (once, then persisting) means every
// entry always has a real, unique queueId before it's ever removed by one.
function migrateLegacyQueueEntry(raw: HeatQueueAction): HeatQueueAction {
  const action = raw as HeatQueueAction & { payload?: Record<string, unknown> }
  const queueId = action.queueId || crypto.randomUUID()

  let payload = action.payload
  if (payload && !payload.idempotency_key && INSERT_KINDS_NEEDING_IDEMPOTENCY_KEY.has(action.kind)) {
    payload = { ...payload, idempotency_key: crypto.randomUUID() }
  }

  if (queueId === action.queueId && payload === action.payload) return raw
  return { ...action, queueId, payload } as HeatQueueAction
}

export function getCachedHeats(): Heat[] {
  return readJson<Heat[]>(HEATS_KEY, [])
}

export function setCachedHeats(heats: Heat[]) {
  writeJson(HEATS_KEY, heats)
}

export function getCachedChargeLines(): ChargeLine[] {
  return readJson<ChargeLine[]>(CHARGE_LINES_KEY, [])
}

export function setCachedChargeLines(lines: ChargeLine[]) {
  writeJson(CHARGE_LINES_KEY, lines)
}

export function getCachedCycleLog(): CycleLogEntry[] {
  return readJson<CycleLogEntry[]>(CYCLE_LOG_KEY, [])
}

export function setCachedCycleLog(entries: CycleLogEntry[]) {
  writeJson(CYCLE_LOG_KEY, entries)
}

export function getCachedTempReadings(): TempReading[] {
  return readJson<TempReading[]>(TEMP_READINGS_KEY, [])
}

export function setCachedTempReadings(readings: TempReading[]) {
  writeJson(TEMP_READINGS_KEY, readings)
}

export function getHeatQueue(): HeatQueueAction[] {
  const raw = readJson<HeatQueueAction[]>(QUEUE_KEY, [])
  let changed = false
  const migrated = raw.map((action) => {
    const fixed = migrateLegacyQueueEntry(action)
    if (fixed !== action) changed = true
    return fixed
  })
  if (changed) writeJson(QUEUE_KEY, migrated)
  return migrated
}

export function setHeatQueue(actions: HeatQueueAction[]) {
  writeJson(QUEUE_KEY, actions)
}

// Plain `Omit` isn't distributive over a union — applied to `HeatQueueAction` it collapses to
// only the fields common to every variant (just `kind`), rejecting the variant-specific fields
// (localId/heatId/requestId/etc.) that callers actually need to pass. Distributing the
// conditional type over each union member first keeps each variant's own shape intact.
type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never

export function enqueueHeatAction(action: DistributiveOmit<HeatQueueAction, 'queueId'>): HeatQueueAction {
  const stamped = { ...action, queueId: crypto.randomUUID() } as HeatQueueAction
  setHeatQueue([...getHeatQueue(), stamped])
  return stamped
}

// The only correct way to remove a processed action — matches by the stable queueId rather
// than object reference (see HeatQueueAction comment above for why reference equality failed).
export function removeHeatQueueAction(queueId: string) {
  setHeatQueue(getHeatQueue().filter((a) => a.queueId !== queueId))
}

export function upsertLocalHeat(heat: Heat) {
  const cached = getCachedHeats()
  setCachedHeats([
    heat,
    ...cached.filter((h) => h.id !== heat.id && h._localId !== heat._localId),
  ])
}

export function updateLocalHeat(id: string, patch: Partial<Heat>) {
  setCachedHeats(
    getCachedHeats().map((h) => (h.id === id || h._localId === id ? { ...h, ...patch } : h)),
  )
}

export function addLocalChargeLine(line: ChargeLine) {
  setCachedChargeLines([line, ...getCachedChargeLines()])
}

export function addLocalCycleEntry(entry: CycleLogEntry) {
  setCachedCycleLog([entry, ...getCachedCycleLog()])
}

export function updateLocalCycleEntry(id: string, patch: Partial<CycleLogEntry>) {
  setCachedCycleLog(
    getCachedCycleLog().map((e) => (e.id === id || e._localId === id ? { ...e, ...patch } : e)),
  )
}

export function addLocalTempReading(reading: TempReading) {
  setCachedTempReadings([reading, ...getCachedTempReadings()])
}

export function rowToHeat(row: Record<string, unknown>): Heat {
  return {
    id: String(row.id),
    heat_no: String(row.heat_no),
    furnace_code: String(row.furnace_code),
    batch_plan_id: row.batch_plan_id ? String(row.batch_plan_id) : null,
    grade_code: String(row.grade_code),
    customer: row.customer ? String(row.customer) : null,
    shift_id: row.shift_id ? String(row.shift_id) : null,
    crew: parseCrew(row.crew),
    status: row.status as Heat['status'],
    fuel_reading: row.fuel_reading != null ? Number(row.fuel_reading) : null,
    verified_by: row.verified_by ? String(row.verified_by) : null,
    verified_at: row.verified_at ? String(row.verified_at) : null,
    created_by: String(row.created_by),
    created_at: String(row.created_at),
    updated_by: row.updated_by ? String(row.updated_by) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  }
}

export function rowToChargeLine(row: Record<string, unknown>): ChargeLine {
  return {
    id: String(row.id),
    heat_id: String(row.heat_id),
    bin_bay: row.bin_bay != null ? String(row.bin_bay) : null,
    material_code: String(row.material_code),
    gross_kg: row.gross_kg != null ? Number(row.gross_kg) : null,
    tare_kg: row.tare_kg != null ? Number(row.tare_kg) : null,
    net_kg: Number(row.net_kg),
    is_mid_heat_addition: Boolean(row.is_mid_heat_addition),
    added_at: String(row.added_at),
    created_by: String(row.created_by),
    created_at: String(row.created_at),
  }
}

export function rowToCycleEntry(row: Record<string, unknown>): CycleLogEntry {
  return {
    id: String(row.id),
    heat_id: String(row.heat_id),
    stage: row.stage as CycleLogEntry['stage'],
    start_ts: String(row.start_ts),
    finish_ts: row.finish_ts ? String(row.finish_ts) : null,
    recorded_by: String(row.recorded_by),
    recorded_at: String(row.recorded_at),
  }
}

export function rowToTempReading(row: Record<string, unknown>): TempReading {
  return {
    id: String(row.id),
    heat_id: String(row.heat_id),
    checkpoint: row.checkpoint as TempReading['checkpoint'],
    value: Number(row.value),
    spec_min: row.spec_min != null ? Number(row.spec_min) : null,
    spec_max: row.spec_max != null ? Number(row.spec_max) : null,
    recorded_by: String(row.recorded_by),
    recorded_at: String(row.recorded_at),
  }
}

export function rowToCancelRequest(row: Record<string, unknown>): HeatCancelRequest {
  return {
    id: String(row.id),
    heat_id: String(row.heat_id),
    requested_by: String(row.requested_by),
    requested_at: String(row.requested_at),
    reason: String(row.reason),
    status: row.status as HeatCancelRequest['status'],
    decided_by: row.decided_by ? String(row.decided_by) : null,
    decided_at: row.decided_at ? String(row.decided_at) : null,
    decision_note: row.decision_note ? String(row.decision_note) : null,
  }
}

export function rowToHeatNoCorrection(row: Record<string, unknown>): HeatNoCorrection {
  return {
    id: String(row.id),
    heat_id: String(row.heat_id),
    original_heat_no: String(row.original_heat_no),
    requested_heat_no: String(row.requested_heat_no),
    requested_by: String(row.requested_by),
    requested_at: String(row.requested_at),
    reason: String(row.reason),
    status: row.status as HeatNoCorrection['status'],
    decided_by: row.decided_by ? String(row.decided_by) : null,
    decided_at: row.decided_at ? String(row.decided_at) : null,
  }
}

export function getHeatPendingCount(): number {
  return getHeatQueue().length
}

// A heat row's server `id` replaces the client-generated id once `heat_insert` syncs. Dependent
// charge/cycle/temp rows and queue payloads must follow that remap or their FK inserts 409.
export function resolveHeatId(heatId: string): string {
  const heat = getCachedHeats().find((h) => h.id === heatId || h._localId === heatId)
  return heat?.id ?? heatId
}

export function getHeatIdAliases(heatId: string): Set<string> {
  const aliases = new Set<string>([heatId])
  const heat = getCachedHeats().find((h) => h.id === heatId || h._localId === heatId)
  if (heat) {
    aliases.add(heat.id)
    if (heat._localId) aliases.add(heat._localId)
  }
  return aliases
}

export function repointHeatDependents(fromId: string, toId: string) {
  if (fromId === toId) return

  setCachedChargeLines(
    getCachedChargeLines().map((line) =>
      line.heat_id === fromId ? { ...line, heat_id: toId } : line,
    ),
  )
  setCachedCycleLog(
    getCachedCycleLog().map((entry) =>
      entry.heat_id === fromId ? { ...entry, heat_id: toId } : entry,
    ),
  )
  setCachedTempReadings(
    getCachedTempReadings().map((reading) =>
      reading.heat_id === fromId ? { ...reading, heat_id: toId } : reading,
    ),
  )

  setHeatQueue(
    getHeatQueue().map((action) => {
      if (
        (action.kind === 'charge_insert' ||
          action.kind === 'cycle_insert' ||
          action.kind === 'temp_insert') &&
        action.payload.heat_id === fromId
      ) {
        return { ...action, payload: { ...action.payload, heat_id: toId } }
      }
      if (action.kind === 'heat_update' && action.heatId === fromId) {
        return { ...action, heatId: toId }
      }
      return action
    }),
  )
}

export function getHeatSyncErrors(): HeatSyncError[] {
  return readJson<HeatSyncError[]>(SYNC_ERRORS_KEY, [])
}

export function setHeatSyncErrors(errors: HeatSyncError[]) {
  writeJson(SYNC_ERRORS_KEY, errors)
}

export function clearHeatSyncErrors() {
  localStorage.removeItem(SYNC_ERRORS_KEY)
}

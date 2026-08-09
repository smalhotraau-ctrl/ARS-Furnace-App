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

export type HeatQueueAction =
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
  return readJson<HeatQueueAction[]>(QUEUE_KEY, [])
}

export function setHeatQueue(actions: HeatQueueAction[]) {
  writeJson(QUEUE_KEY, actions)
}

export function enqueueHeatAction(action: HeatQueueAction) {
  setHeatQueue([...getHeatQueue(), action])
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
    bin_bay: String(row.bin_bay),
    material_code: String(row.material_code),
    gross_kg: Number(row.gross_kg),
    tare_kg: Number(row.tare_kg),
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

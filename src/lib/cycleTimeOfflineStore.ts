import type { CycleStageTimeFlag, CycleStageTimeStandardRow } from '../types/cycleTime'
import type { CycleStage } from '../types/heat'

const STANDARDS_KEY = 'furnace:cycle_stage_time_standards'
const FLAGS_KEY = 'furnace:cycle_stage_time_flags'
const QUEUE_KEY = 'furnace:cycle_time_queue'

export interface PendingCycleTimeFlagInsert {
  kind: 'cycle_time_flag_insert'
  localId: string
  payload: Record<string, unknown>
}

export interface PendingCycleTimeFlagAcknowledge {
  kind: 'cycle_time_flag_acknowledge'
  flagId: string
  payload: Record<string, unknown>
}

export type CycleTimeQueueAction = (PendingCycleTimeFlagInsert | PendingCycleTimeFlagAcknowledge) & {
  queueId: string
}

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

export function getCachedCycleStageTimeStandards(): CycleStageTimeStandardRow[] {
  return readJson<CycleStageTimeStandardRow[]>(STANDARDS_KEY, [])
}

export function setCachedCycleStageTimeStandards(rows: CycleStageTimeStandardRow[]) {
  writeJson(STANDARDS_KEY, rows)
}

export function getCachedCycleStageTimeFlags(): CycleStageTimeFlag[] {
  return readJson<CycleStageTimeFlag[]>(FLAGS_KEY, [])
}

export function setCachedCycleStageTimeFlags(flags: CycleStageTimeFlag[]) {
  writeJson(FLAGS_KEY, flags)
}

export function addLocalCycleStageTimeFlag(flag: CycleStageTimeFlag) {
  setCachedCycleStageTimeFlags([flag, ...getCachedCycleStageTimeFlags()])
}

export function updateLocalCycleStageTimeFlag(id: string, patch: Partial<CycleStageTimeFlag>) {
  setCachedCycleStageTimeFlags(getCachedCycleStageTimeFlags().map((f) => (f.id === id ? { ...f, ...patch } : f)))
}

export function getCycleTimeQueue(): CycleTimeQueueAction[] {
  return readJson<CycleTimeQueueAction[]>(QUEUE_KEY, [])
}

export function setCycleTimeQueue(queue: CycleTimeQueueAction[]) {
  writeJson(QUEUE_KEY, queue)
}

export function enqueueCycleTimeAction(action: PendingCycleTimeFlagInsert | PendingCycleTimeFlagAcknowledge) {
  setCycleTimeQueue([...getCycleTimeQueue(), { ...action, queueId: crypto.randomUUID() }])
}

export function removeCycleTimeQueueAction(queueId: string) {
  setCycleTimeQueue(getCycleTimeQueue().filter((a) => a.queueId !== queueId))
}

export function getCycleTimePendingCount(): number {
  return getCycleTimeQueue().length
}

export function rowToCycleStageTimeStandard(row: Record<string, unknown>): CycleStageTimeStandardRow {
  return {
    id: String(row.id),
    stage: String(row.stage) as CycleStage,
    target_minutes: Number(row.target_minutes),
    updated_by: String(row.updated_by),
    updated_at: String(row.updated_at),
  }
}

export function rowToCycleStageTimeFlag(row: Record<string, unknown>): CycleStageTimeFlag {
  return {
    id: String(row.id),
    heat_id: String(row.heat_id),
    stage: String(row.stage) as CycleStage,
    actual_minutes: Number(row.actual_minutes),
    target_minutes: Number(row.target_minutes),
    flagged_at: String(row.flagged_at),
    acknowledged_by: row.acknowledged_by != null ? String(row.acknowledged_by) : null,
    acknowledged_at: row.acknowledged_at != null ? String(row.acknowledged_at) : null,
    note: row.note != null ? String(row.note) : null,
  }
}

export function targetMinutesForStage(
  stage: CycleStage,
  standards: CycleStageTimeStandardRow[],
): number | null {
  const row = standards.find((s) => s.stage === stage)
  return row?.target_minutes ?? null
}

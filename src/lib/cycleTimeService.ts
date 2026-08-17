import { supabase } from './supabaseClient'
import { createInFlightLock, insertIdempotent } from './offlineQueueSync'
import {
  addLocalCycleStageTimeFlag,
  enqueueCycleTimeAction,
  getCachedCycleStageTimeFlags,
  getCachedCycleStageTimeStandards,
  getCycleTimePendingCount,
  getCycleTimeQueue,
  removeCycleTimeQueueAction,
  rowToCycleStageTimeFlag,
  rowToCycleStageTimeStandard,
  setCachedCycleStageTimeFlags,
  setCachedCycleStageTimeStandards,
  targetMinutesForStage,
  updateLocalCycleStageTimeFlag,
} from './cycleTimeOfflineStore'
import type { AppUser } from '../types/auth'
import type { CycleStageTimeFlag, CycleStageTimeStandardRow } from '../types/cycleTime'
import type { CycleLogEntry, CycleStage } from '../types/heat'

const furnace = () => supabase.schema('furnace')

export async function fetchCycleStageTimeStandards(): Promise<CycleStageTimeStandardRow[]> {
  if (!navigator.onLine) return getCachedCycleStageTimeStandards()

  const { data, error } = await furnace()
    .from('cycle_stage_time_standards')
    .select('*')
    .order('stage')
  if (error) throw error
  const rows = (data ?? []).map((row) => rowToCycleStageTimeStandard(row as Record<string, unknown>))
  setCachedCycleStageTimeStandards(rows)
  return rows
}

export async function fetchOpenCycleStageTimeFlags(): Promise<CycleStageTimeFlag[]> {
  const { data, error } = await furnace()
    .from('cycle_stage_time_flags')
    .select('*')
    .is('acknowledged_at', null)
    .order('flagged_at', { ascending: false })
  if (error) throw error

  const serverFlags = (data ?? []).map((row) => rowToCycleStageTimeFlag(row as Record<string, unknown>))
  const localPending = getCachedCycleStageTimeFlags().filter((f) => f._pending && !f.acknowledged_at)
  const merged = new Map<string, CycleStageTimeFlag>()
  for (const f of serverFlags) merged.set(f.id, f)
  for (const f of localPending) merged.set(f.id, f)

  const result = [...merged.values()].sort((a, b) => b.flagged_at.localeCompare(a.flagged_at))
  setCachedCycleStageTimeFlags(result)
  return result.filter((f) => !f.acknowledged_at)
}

export function maybeFlagCycleStageOvertime(
  entry: CycleLogEntry,
  finishTs: string,
  standards: CycleStageTimeStandardRow[] = getCachedCycleStageTimeStandards(),
): CycleStageTimeFlag | null {
  const target = targetMinutesForStage(entry.stage, standards)
  if (target == null) return null

  const actualMinutes = (new Date(finishTs).getTime() - new Date(entry.start_ts).getTime()) / 60_000
  if (actualMinutes <= target) return null

  const localId = entry.id
  const existing = getCachedCycleStageTimeFlags().find(
    (f) => f._localId === localId || (f as CycleStageTimeFlag & { idempotency_key?: string }).id === localId,
  )
  if (existing) return existing

  const payload = {
    heat_id: entry.heat_id,
    stage: entry.stage,
    actual_minutes: Math.round(actualMinutes * 10) / 10,
    target_minutes: target,
    flagged_at: finishTs,
    idempotency_key: localId,
  }

  const flag: CycleStageTimeFlag = {
    id: localId,
    _localId: localId,
    _pending: true,
    ...payload,
    acknowledged_by: null,
    acknowledged_at: null,
    note: null,
  }

  addLocalCycleStageTimeFlag(flag)
  enqueueCycleTimeAction({ kind: 'cycle_time_flag_insert', localId, payload })
  if (navigator.onLine) void syncCycleTimeQueue()
  return flag
}

export async function acknowledgeCycleStageTimeFlag(
  user: AppUser,
  flag: CycleStageTimeFlag,
  note: string | null,
): Promise<void> {
  const now = new Date().toISOString()
  updateLocalCycleStageTimeFlag(flag.id, {
    acknowledged_by: user.id,
    acknowledged_at: now,
    note,
    _pending: true,
  })
  enqueueCycleTimeAction({
    kind: 'cycle_time_flag_acknowledge',
    flagId: flag.id,
    payload: { acknowledged_by: user.id, acknowledged_at: now, note },
  })
  if (navigator.onLine) void syncCycleTimeQueue()
}

const withCycleTimeSyncLock = createInFlightLock<number>()

export function syncCycleTimeQueue(): Promise<number> {
  return withCycleTimeSyncLock(runCycleTimeQueueSync)
}

async function runCycleTimeQueueSync(): Promise<number> {
  if (!navigator.onLine) return getCycleTimePendingCount()

  const queue = [...getCycleTimeQueue()]

  for (const action of queue) {
    if (action.kind === 'cycle_time_flag_insert') {
      const payload = {
        ...action.payload,
        heat_id: String(action.payload.heat_id),
      }
      const { row, error } = await insertIdempotent(furnace, 'cycle_stage_time_flags', payload)
      if (error || !row) continue
      const synced = rowToCycleStageTimeFlag(row)
      updateLocalCycleStageTimeFlag(action.localId, { ...synced, _localId: undefined, _pending: false })
      removeCycleTimeQueueAction(action.queueId)
    }

    if (action.kind === 'cycle_time_flag_acknowledge') {
      const resolvedId =
        getCachedCycleStageTimeFlags().find((f) => f.id === action.flagId || f._localId === action.flagId)?.id ??
        action.flagId
      const { error } = await furnace().from('cycle_stage_time_flags').update(action.payload).eq('id', resolvedId)
      if (error) continue
      updateLocalCycleStageTimeFlag(action.flagId, { ...action.payload, _pending: false } as Partial<CycleStageTimeFlag>)
      removeCycleTimeQueueAction(action.queueId)
    }
  }

  return getCycleTimePendingCount()
}

export { targetMinutesForStage }

export function formatTargetMinutes(minutes: number): string {
  if (Number.isInteger(minutes)) return `${minutes} min`
  return `${minutes.toFixed(1)} min`
}

export function stageElapsedExceedsTarget(
  startTs: string,
  nowMs: number,
  targetMinutes: number | null,
): boolean {
  if (targetMinutes == null) return false
  const elapsedMinutes = (nowMs - new Date(startTs).getTime()) / 60_000
  return elapsedMinutes > targetMinutes
}

export type { CycleStage }

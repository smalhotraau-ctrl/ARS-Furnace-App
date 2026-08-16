import { supabase } from './supabaseClient'
import { fetchActiveMaterials, fetchGradeSpecs, fetchMaterialStdComposition } from './batchPlanService'
import { fetchChargeLines, fetchHeats, loadLocalHeats } from './heatService'
import { createInFlightLock, insertIdempotent } from './offlineQueueSync'
import {
  addLocalSpectroReport,
  enqueueSpectroAction,
  getCachedSpectroReports,
  getSpectroQueue,
  removeSpectroPending,
  rowToSpectroReport,
  setCachedSpectroReports,
  setSpectroQueue,
  updateLocalSpectroReport,
} from './spectroOfflineStore'
import type { AppUser } from '../types/auth'
import type { CorrectionSuggestion, SpectroReport, SpectroReportInsert } from '../types/spectro'
import type { Heat } from '../types/heat'

const furnace = () => supabase.schema('furnace')

export async function fetchSpectroReports(heatId?: string): Promise<SpectroReport[]> {
  let query = furnace()
    .from('spectro_reports')
    .select('*')
    .order('sample_time', { ascending: false })

  if (heatId) query = query.eq('heat_id', heatId)

  const { data, error } = await query
  if (error) throw error

  const serverReports = (data ?? []).map((row) => rowToSpectroReport(row as Record<string, unknown>))
  const localPending = getCachedSpectroReports().filter((r) => r._pending && (!heatId || r.heat_id === heatId))
  const merged = new Map<string, SpectroReport>()
  for (const r of serverReports) merged.set(r.id, r)
  for (const r of localPending) merged.set(r.id, r)

  const result = [...merged.values()].sort((a, b) => b.sample_time.localeCompare(a.sample_time))
  setCachedSpectroReports(result)
  return heatId ? result.filter((r) => r.heat_id === heatId) : result
}

export async function fetchHeatsForSpectro(): Promise<Heat[]> {
  return navigator.onLine ? fetchHeats() : loadLocalHeats()
}

export { fetchGradeSpecs, fetchChargeLines, fetchMaterialStdComposition, fetchActiveMaterials }

export async function saveSpectroReport(
  user: AppUser,
  payload: Omit<SpectroReportInsert, 'recorded_by' | 'idempotency_key'>,
): Promise<SpectroReport> {
  const localId = crypto.randomUUID()
  const insert: SpectroReportInsert = { ...payload, recorded_by: user.id, idempotency_key: localId }
  const now = new Date().toISOString()

  const localReport: SpectroReport = {
    id: localId,
    _localId: localId,
    _pending: true,
    ...insert,
    recorded_at: now,
  }

  addLocalSpectroReport(localReport)
  enqueueSpectroAction({ kind: 'insert', localId, payload: insert })
  void syncSpectroQueue()

  return localReport
}

export async function updateReportCorrection(
  report: SpectroReport,
  correction: CorrectionSuggestion[],
): Promise<SpectroReport> {
  const updated = { ...report, correction_suggested: correction, _pending: true }
  updateLocalSpectroReport(report.id, updated)

  const queue = getSpectroQueue()
  const insertAction = queue.find((a) => a.localId === report._localId)
  if (insertAction) {
    insertAction.payload.correction_suggested = correction
    setSpectroQueue([...queue])
  }

  void syncSpectroQueue()
  return updated
}

// Only one flush of furnace:spectro_queue may run at a time — see offlineQueueSync.ts.
const withSpectroSyncLock = createInFlightLock<number>()

export function syncSpectroQueue(): Promise<number> {
  return withSpectroSyncLock(runSpectroQueueSync)
}

async function runSpectroQueueSync(): Promise<number> {
  if (!navigator.onLine) return getSpectroQueue().length

  for (const action of [...getSpectroQueue()]) {
    if (action.kind === 'insert') {
      const { row, error } = await insertIdempotent(
        furnace,
        'spectro_reports',
        action.payload as unknown as Record<string, unknown>,
      )
      if (error || !row) continue

      const synced = rowToSpectroReport(row)
      removeSpectroPending(action.localId)
      updateLocalSpectroReport(action.localId, { ...synced, _localId: undefined, _pending: false })
    }
  }

  setCachedSpectroReports(getCachedSpectroReports())
  return getSpectroQueue().length
}

export function loadLocalSpectroReports(): SpectroReport[] {
  return getCachedSpectroReports()
}

export { getSpectroPendingCount } from './spectroOfflineStore'

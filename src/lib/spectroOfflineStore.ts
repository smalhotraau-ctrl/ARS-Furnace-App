import type { SpectroReport, SpectroReportInsert } from '../types/spectro'
import { parseCorrectionSuggested, parseSpectroComposition } from '../types/spectro'

const CACHE_KEY = 'furnace:spectro_reports'
const QUEUE_KEY = 'furnace:spectro_queue'

export interface PendingSpectroInsert {
  kind: 'insert'
  localId: string
  payload: SpectroReportInsert
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

export function getCachedSpectroReports(): SpectroReport[] {
  return readJson<SpectroReport[]>(CACHE_KEY, [])
}

export function setCachedSpectroReports(reports: SpectroReport[]) {
  writeJson(CACHE_KEY, reports)
}

export function getSpectroQueue(): PendingSpectroInsert[] {
  return readJson<PendingSpectroInsert[]>(QUEUE_KEY, [])
}

export function setSpectroQueue(actions: PendingSpectroInsert[]) {
  writeJson(QUEUE_KEY, actions)
}

export function enqueueSpectroAction(action: PendingSpectroInsert) {
  setSpectroQueue([...getSpectroQueue(), action])
}

export function removeSpectroPending(localId: string) {
  setSpectroQueue(getSpectroQueue().filter((a) => a.localId !== localId))
}

export function addLocalSpectroReport(report: SpectroReport) {
  setCachedSpectroReports([
    report,
    ...getCachedSpectroReports().filter((r) => r.id !== report.id && r._localId !== report._localId),
  ])
}

export function updateLocalSpectroReport(id: string, patch: Partial<SpectroReport>) {
  setCachedSpectroReports(
    getCachedSpectroReports().map((r) => (r.id === id || r._localId === id ? { ...r, ...patch } : r)),
  )
}

export function rowToSpectroReport(row: Record<string, unknown>): SpectroReport {
  return {
    id: String(row.id),
    heat_id: String(row.heat_id),
    report_type: row.report_type as SpectroReport['report_type'],
    composition: parseSpectroComposition(row.composition),
    sample_time: String(row.sample_time),
    correction_suggested: parseCorrectionSuggested(row.correction_suggested),
    recorded_by: String(row.recorded_by),
    recorded_at: String(row.recorded_at),
  }
}

export function getSpectroPendingCount(): number {
  return getSpectroQueue().length
}

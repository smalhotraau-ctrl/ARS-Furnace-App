export type ReportType = 'process' | 'final'
export type SpecFlag = 'in_spec' | 'out_of_spec'

export interface SpectroCompositionEntry {
  element: string
  actual_pct: number
  spec_min: number
  spec_max: number
  flag: SpecFlag
}

export interface CorrectionSuggestion {
  material_code: string
  suggested_kg: number
}

export interface SpectroReport {
  id: string
  heat_id: string
  report_type: ReportType
  composition: SpectroCompositionEntry[]
  sample_time: string
  correction_suggested: CorrectionSuggestion[] | null
  recorded_by: string
  recorded_at: string
  _localId?: string
  _pending?: boolean
}

export interface SpectroReportInsert {
  heat_id: string
  report_type: ReportType
  composition: SpectroCompositionEntry[]
  sample_time: string
  correction_suggested: CorrectionSuggestion[] | null
  recorded_by: string
  idempotency_key: string
}

export function parseSpectroComposition(raw: unknown): SpectroCompositionEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (entry): entry is SpectroCompositionEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        'element' in entry &&
        'actual_pct' in entry,
    )
    .map((entry) => ({
      element: String(entry.element),
      actual_pct: Number(entry.actual_pct),
      spec_min: Number(entry.spec_min),
      spec_max: Number(entry.spec_max),
      flag: entry.flag === 'out_of_spec' ? 'out_of_spec' : 'in_spec',
    }))
}

export function parseCorrectionSuggested(raw: unknown): CorrectionSuggestion[] | null {
  if (!raw) return null
  if (!Array.isArray(raw)) return null
  return raw.map((entry) => ({
    material_code: String((entry as CorrectionSuggestion).material_code),
    suggested_kg: Number((entry as CorrectionSuggestion).suggested_kg),
  }))
}

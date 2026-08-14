export interface PlannedLine {
  material_code: string
  planned_kg: number
}

export interface ExpectedCompositionEntry {
  element: string
  expected_pct: number
  spec_flag: 'in_spec' | 'out_of_spec'
}

export interface BatchPlan {
  id: string
  furnace_code: string
  grade_code: string
  plan_date: string
  planned_lines: PlannedLine[]
  expected_composition: ExpectedCompositionEntry[]
  status: string
  owner_reviewed: boolean
  owner_reviewed_by: string | null
  owner_reviewed_at: string | null
  owner_review_note: string | null
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string | null
  _localId?: string
  _pending?: boolean
}

export interface BatchPlanInsert {
  furnace_code: string
  grade_code: string
  plan_date: string
  planned_lines: PlannedLine[]
  expected_composition: ExpectedCompositionEntry[]
  status: string
  created_by: string
  idempotency_key: string
}

export interface FurnaceOption {
  code: string
  name: string
  type: string
}

export interface MaterialOption {
  code: string
  name: string
}

export interface MaterialStdRow {
  material_code: string
  element: string
  std_pct: number
}

export interface GradeSpecRow {
  grade_code: string
  element: string
  min_pct: number
  max_pct: number
  active: boolean
}

export const BATCH_PLAN_STATUS = 'planned'

export function parsePlannedLines(raw: unknown): PlannedLine[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (line): line is { material_code: string; planned_kg: number } =>
        typeof line === 'object' &&
        line !== null &&
        'material_code' in line &&
        'planned_kg' in line,
    )
    .map((line) => ({
      material_code: String(line.material_code),
      planned_kg: Number(line.planned_kg),
    }))
}

export function parseExpectedComposition(raw: unknown): ExpectedCompositionEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (entry): entry is ExpectedCompositionEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        'element' in entry &&
        'expected_pct' in entry &&
        'spec_flag' in entry,
    )
    .map((entry) => ({
      element: String(entry.element),
      expected_pct: Number(entry.expected_pct),
      spec_flag: entry.spec_flag === 'out_of_spec' ? 'out_of_spec' : 'in_spec',
    }))
}

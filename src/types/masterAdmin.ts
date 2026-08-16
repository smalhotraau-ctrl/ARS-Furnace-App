import type { HeatCostingOverridePayload, ProcessCostStandardCreatePayload, RateMasterCreatePayload, RateMasterUpdatePayload } from './costing'

export interface Furnace {
  id: string
  code: string
  name: string
  type: 'main' | 'pit'
  heat_code_letter: string | null
  active: boolean
}

export interface FurnaceCreatePayload {
  code: string
  name: string
  type: 'main' | 'pit'
  heat_code_letter: string | null
}

export interface FurnaceUpdatePayload {
  name?: string
  heat_code_letter?: string | null
  active?: boolean
}

// One row per element per grade_code — a full grade spec is every row sharing a grade_code.
export interface GradeSpecRow {
  id: string
  grade_code: string
  element: string
  min_pct: number
  max_pct: number
  active: boolean
  superseded_by: string | null
  created_by: string
  created_at: string
}

export interface GradeSpecElementInput {
  element: string
  min_pct: number
  max_pct: number
}

// A re-spec is always a brand new grade_code — never an edit of an existing row. If
// supersedes_grade_code is set, every active row under that old grade_code is marked
// superseded_by the new spec (see 03i section 5 / grade_specs immutability rule).
export interface GradeSpecCreatePayload {
  grade_code: string
  elements: GradeSpecElementInput[]
  supersedes_grade_code: string | null
}

export interface Material {
  id: string
  code: string
  name: string
  active: boolean
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string | null
}

export interface MaterialCreatePayload {
  code: string
  name: string
}

export interface MaterialUpdatePayload {
  name?: string
  active?: boolean
}

export interface MaterialStdCompositionRow {
  id: string
  material_code: string
  element: string
  std_pct: number
}

export interface MaterialStdCompositionElementInput {
  element: string
  std_pct: number
}

export interface MaterialStdCompositionCreatePayload {
  material_code: string
  elements: MaterialStdCompositionElementInput[]
}

export interface MaterialStdCompositionUpdatePayload {
  std_pct: number
}

export const YIELD_METRICS = ['ingot_pct', 'dross_pct', 'rejection_pct', 'iron_pct', 'burn_loss_pct'] as const
export type YieldMetric = (typeof YIELD_METRICS)[number]

export const YIELD_METRIC_LABELS: Record<YieldMetric, { en: string; hi: string }> = {
  ingot_pct: { en: 'Ingot %', hi: 'इनगट %' },
  dross_pct: { en: 'Dross %', hi: 'ड्रॉस %' },
  rejection_pct: { en: 'Rejection %', hi: 'रिजेक्शन %' },
  iron_pct: { en: 'Iron %', hi: 'आयरन %' },
  burn_loss_pct: { en: 'Burn Loss %', hi: 'बर्न लॉस %' },
}

export interface MaterialYieldStandardRow {
  id: string
  material_code: string
  metric: YieldMetric
  min_pct: number
  max_pct: number
  active: boolean
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string | null
}

export interface MaterialYieldStandardCreatePayload {
  material_code: string
  metric: YieldMetric
  min_pct: number
  max_pct: number
}

export interface MaterialYieldStandardUpdatePayload {
  min_pct?: number
  max_pct?: number
  active?: boolean
}

// rate_master and heat_costing are handled by this same generic request/decide mechanism (see
// masterAdminService.ts's applyChangeToTarget) even though they belong to the Costing screens,
// not the five Master Admin entity screens — 03i §5 explicitly lists "rate_master (base entries)"
// as Master-Admin-covered data, and there is no second maker-checker table in the schema for the
// heat_costing.material_cost_final override (03i §3), so it reuses this one too, just gated by
// the 'rate_override' approval_settings row instead of 'master_admin_change' (see
// furnace.rate_override_auto_approved() in the database).
export type MasterAdminTargetTable =
  | 'furnaces'
  | 'grade_specs'
  | 'materials'
  | 'material_std_composition'
  | 'material_yield_standards'
  | 'rate_master'
  | 'heat_costing'
  | 'process_cost_standards'

export type MasterAdminAction = 'create' | 'update'

export type MasterAdminPayload =
  | FurnaceCreatePayload
  | FurnaceUpdatePayload
  | GradeSpecCreatePayload
  | MaterialCreatePayload
  | MaterialUpdatePayload
  | MaterialStdCompositionCreatePayload
  | MaterialStdCompositionUpdatePayload
  | MaterialYieldStandardCreatePayload
  | MaterialYieldStandardUpdatePayload
  | RateMasterCreatePayload
  | RateMasterUpdatePayload
  | ProcessCostStandardCreatePayload
  | HeatCostingOverridePayload

export interface MasterAdminChangeRequest {
  id: string
  target_table: MasterAdminTargetTable
  target_id: string | null
  action: MasterAdminAction
  payload: Record<string, unknown>
  requested_by: string
  requested_at: string
  status: 'pending' | 'approved' | 'rejected'
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
}

export const MASTER_ADMIN_TABLE_LABELS: Record<MasterAdminTargetTable, { en: string; hi: string }> = {
  furnaces: { en: 'Furnace', hi: 'फर्नेस' },
  grade_specs: { en: 'Grade Spec', hi: 'ग्रेड स्पेक' },
  materials: { en: 'Material', hi: 'मैटेरियल' },
  material_std_composition: { en: 'Material Std. Composition', hi: 'मैटेरियल स्टैंडर्ड संरचना' },
  material_yield_standards: { en: 'Yield Standard', hi: 'यील्ड स्टैंडर्ड' },
  rate_master: { en: 'Rate Master', hi: 'रेट मास्टर' },
  heat_costing: { en: 'Material Cost Override', hi: 'मैटेरियल लागत ओवरराइड' },
  process_cost_standards: { en: 'Process Cost Standards', hi: 'प्रक्रिया लागत मानक' },
}

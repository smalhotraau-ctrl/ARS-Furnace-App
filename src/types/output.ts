export type YieldMetric = 'ingot_pct' | 'dross_pct' | 'rejection_pct' | 'iron_pct' | 'burn_loss_pct'

export const YIELD_METRICS: YieldMetric[] = ['ingot_pct', 'dross_pct', 'rejection_pct', 'iron_pct', 'burn_loss_pct']

export const YIELD_METRIC_LABELS: Record<YieldMetric, { en: string; hi: string }> = {
  ingot_pct: { en: 'Ingot %', hi: 'इंगट %' },
  dross_pct: { en: 'Dross %', hi: 'ड्रॉस %' },
  rejection_pct: { en: 'Rejection %', hi: 'रिजेक्शन %' },
  iron_pct: { en: 'Iron %', hi: 'आयरन %' },
  burn_loss_pct: { en: 'Burn Loss %', hi: 'बर्न लॉस %' },
}

export interface HeatOutput {
  id: string
  heat_id: string
  ingot_kg: number
  dross_kg: number
  rejection_kg: number
  iron_kg: number
  exceptional_label: string | null
  exceptional_kg: number | null
  burn_loss_kg: number
  ingot_pct: number
  dross_pct: number
  rejection_pct: number
  iron_pct: number
  burn_loss_pct: number
  verified_by: string | null
  verified_at: string | null
  recorded_by: string
  recorded_at: string
  _localId?: string
  _pending?: boolean
}

export interface HeatOutputInsert {
  heat_id: string
  ingot_kg: number
  dross_kg: number
  rejection_kg: number
  iron_kg: number
  exceptional_label: string | null
  exceptional_kg: number | null
  burn_loss_kg: number
  ingot_pct: number
  dross_pct: number
  rejection_pct: number
  iron_pct: number
  burn_loss_pct: number
  recorded_by: string
}

export interface HeatOutputFlag {
  id: string
  heat_id: string
  metric: YieldMetric
  actual_pct: number
  expected_min_pct: number
  expected_max_pct: number
  acknowledged_by: string | null
  acknowledged_at: string | null
  acknowledgement_note: string | null
  created_at: string
  _localId?: string
  _pending?: boolean
}

export interface HeatOutputFlagInsert {
  heat_id: string
  metric: YieldMetric
  actual_pct: number
  expected_min_pct: number
  expected_max_pct: number
}

export interface MaterialYieldStandardRow {
  material_code: string
  metric: YieldMetric
  min_pct: number
  max_pct: number
  active: boolean
}

export interface FgStock {
  id: string
  heat_id: string
  grade_code: string
  kg_available: number
  created_at: string
  updated_at: string
}

export interface FgStockInsert {
  heat_id: string
  grade_code: string
  kg_available: number
}

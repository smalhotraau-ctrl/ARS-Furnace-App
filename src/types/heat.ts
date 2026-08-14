export type HeatStatus =
  | 'Planned'
  | 'Charging'
  | 'Melting'
  | 'Casting'
  | 'Output Entered'
  | 'Closed'
  | 'Cancelled'

export interface Heat {
  id: string
  heat_no: string
  furnace_code: string
  batch_plan_id: string | null
  grade_code: string
  customer: string | null
  shift_id: string | null
  crew: string[]
  status: HeatStatus
  fuel_reading: number | null
  verified_by: string | null
  verified_at: string | null
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string | null
  _localId?: string
  _pending?: boolean
  _emergency?: boolean
}

export interface HeatInsert {
  heat_no: string
  furnace_code: string
  batch_plan_id: string | null
  grade_code: string
  customer: string | null
  crew: string[]
  status: HeatStatus
  fuel_reading: number | null
  created_by: string
  idempotency_key: string
}

export interface ChargeLine {
  id: string
  heat_id: string
  // Real floor usage is a single net weight per material pickup — bin/bay and gross/tare are
  // optional context, not required entry (03d_Furnace_Module_HeatCharging_Cycle.md §4).
  bin_bay: string | null
  material_code: string
  gross_kg: number | null
  tare_kg: number | null
  net_kg: number
  is_mid_heat_addition: boolean
  added_at: string
  created_by: string
  created_at: string
  _localId?: string
  _pending?: boolean
}

export interface ChargeLineInsert {
  heat_id: string
  bin_bay: string | null
  material_code: string
  gross_kg: number | null
  tare_kg: number | null
  net_kg: number
  is_mid_heat_addition: boolean
  added_at: string
  created_by: string
  idempotency_key: string
}

export interface CycleLogEntry {
  id: string
  heat_id: string
  stage: CycleStage
  start_ts: string
  finish_ts: string | null
  recorded_by: string
  recorded_at: string
  _localId?: string
  _pending?: boolean
}

export interface CycleLogInsert {
  heat_id: string
  stage: CycleStage
  start_ts: string
  finish_ts: string | null
  recorded_by: string
  idempotency_key: string
}

export interface TempReading {
  id: string
  heat_id: string
  checkpoint: TempCheckpoint
  value: number
  spec_min: number | null
  spec_max: number | null
  recorded_by: string
  recorded_at: string
  _localId?: string
  _pending?: boolean
}

export interface TempReadingInsert {
  heat_id: string
  checkpoint: TempCheckpoint
  value: number
  spec_min: number | null
  spec_max: number | null
  recorded_by: string
  idempotency_key: string
}

export interface HeatCancelRequest {
  id: string
  heat_id: string
  requested_by: string
  requested_at: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  decided_by: string | null
  decided_at: string | null
  decision_note: string | null
}

export interface HeatNoCorrection {
  id: string
  heat_id: string
  original_heat_no: string
  requested_heat_no: string
  requested_by: string
  requested_at: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  decided_by: string | null
  decided_at: string | null
}

export const CYCLE_STAGES = [
  'preheating',
  'charging',
  'melting',
  'drossing',
  'iron_removal',
  'alloying',
  'degassing',
  'casting',
  'cleaning',
] as const

export type CycleStage = (typeof CYCLE_STAGES)[number]

export const TEMP_CHECKPOINTS = [
  'mould_preheat',
  'melting',
  'iron_removal',
  'alloying',
  'casting',
] as const

export type TempCheckpoint = (typeof TEMP_CHECKPOINTS)[number]

export const ACTIVE_HEAT_STATUSES: HeatStatus[] = [
  'Planned',
  'Charging',
  'Melting',
  'Casting',
  'Output Entered',
]

export function parseCrew(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === 'string')
}

export function isActiveHeat(status: HeatStatus): boolean {
  return ACTIVE_HEAT_STATUSES.includes(status)
}

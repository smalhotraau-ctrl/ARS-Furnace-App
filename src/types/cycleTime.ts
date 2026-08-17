import type { CycleStage } from './heat'

export interface CycleStageTimeStandardRow {
  id: string
  stage: CycleStage
  target_minutes: number
  updated_by: string
  updated_at: string
}

export interface CycleStageTimeStandardCreatePayload {
  stage: CycleStage
  target_minutes: number
}

export interface CycleStageTimeStandardUpdatePayload {
  target_minutes: number
}

export interface CycleStageTimeFlag {
  id: string
  heat_id: string
  stage: CycleStage
  actual_minutes: number
  target_minutes: number
  flagged_at: string
  acknowledged_by: string | null
  acknowledged_at: string | null
  note: string | null
  _localId?: string
  _pending?: boolean
}

export interface CycleStageTimeFlagInsert {
  heat_id: string
  stage: CycleStage
  actual_minutes: number
  target_minutes: number
  flagged_at: string
  idempotency_key: string
}

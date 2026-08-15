export const RATE_ITEM_TYPES = ['lot_material', 'flat_rate'] as const
export type RateItemType = (typeof RATE_ITEM_TYPES)[number]

// item is a materials-master code for lot_material entries (FIFO draw matches this against
// charge_lines.material_code — see costingService.ts), and free text for flat_rate entries
// (electricity, labour, overhead, transport, ...) since those aren't materials at all.
export interface RateMasterRow {
  id: string
  item: string
  item_type: RateItemType
  rate_per_kg: number
  quantity_kg: number | null
  remaining_qty_kg: number | null
  effective_from: string
  source_ref_id: string | null
  updated_by: string
  updated_at: string
}

export interface RateMasterCreatePayload {
  item: string
  item_type: RateItemType
  rate_per_kg: number
  quantity_kg: number | null
  effective_from: string
}

export interface RateMasterUpdatePayload {
  rate_per_kg?: number
  quantity_kg?: number | null
  effective_from?: string
}

export interface RateConsumptionLogRow {
  id: string
  heat_id: string
  rate_master_id: string
  item: string
  kg_consumed: number
  rate_used: number
  created_at: string
}

export interface HeatCostingRow {
  id: string
  heat_id: string
  material_cost_computed: number
  material_cost_final: number
  material_cost_override_reason: string | null
  overridden_by: string | null
  overridden_at: string | null
  fuel_cost: number
  manpower_cost: number
  consumables_cost: number
  electrical_cost: number
  transport_cost: number
  cost_per_kg: number
  selling_price_per_kg: number
  savings: number
  created_by: string
  created_at: string
}

// 03i §4: "the base cost inputs" are the one hand-entered group besides material_cost_final —
// fuel/manpower/consumables/electrical/transport plus the selling price needed to derive savings.
export interface HeatCostingBaseInputsPayload {
  fuel_cost: number
  manpower_cost: number
  consumables_cost: number
  electrical_cost: number
  transport_cost: number
  selling_price_per_kg: number
}

export interface HeatCostingOverridePayload {
  material_cost_final: number
  material_cost_override_reason: string
}

export type ApprovalActionType = 'rate_override' | 'master_admin_change'

export interface ApprovalSetting {
  id: string
  action_type: ApprovalActionType
  requires_owner_approval: boolean
  updated_by: string
  updated_at: string
}

export const APPROVAL_ACTION_LABELS: Record<ApprovalActionType, { en: string; hi: string }> = {
  rate_override: { en: 'Rate override', hi: 'रेट ओवरराइड' },
  master_admin_change: { en: 'Master Admin changes', hi: 'मास्टर एडमिन बदलाव' },
}

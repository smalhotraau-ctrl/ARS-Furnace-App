import { supabase } from './supabaseClient'
import type { AppUser } from '../types/auth'
import type { ChargeLine, Heat } from '../types/heat'
import type {
  HeatCostingBaseInputsPayload,
  HeatCostingRow,
  RateMasterRow,
} from '../types/costing'

const furnace = () => supabase.schema('furnace')

function rowToRateMaster(row: Record<string, unknown>): RateMasterRow {
  return {
    id: String(row.id),
    item: String(row.item),
    item_type: row.item_type as RateMasterRow['item_type'],
    rate_per_kg: Number(row.rate_per_kg),
    quantity_kg: row.quantity_kg != null ? Number(row.quantity_kg) : null,
    remaining_qty_kg: row.remaining_qty_kg != null ? Number(row.remaining_qty_kg) : null,
    effective_from: String(row.effective_from),
    source_ref_id: row.source_ref_id != null ? String(row.source_ref_id) : null,
    updated_by: String(row.updated_by),
    updated_at: String(row.updated_at),
  }
}

function rowToHeatCosting(row: Record<string, unknown>): HeatCostingRow {
  return {
    id: String(row.id),
    heat_id: String(row.heat_id),
    material_cost_computed: Number(row.material_cost_computed),
    material_cost_final: Number(row.material_cost_final),
    material_cost_override_reason: row.material_cost_override_reason != null ? String(row.material_cost_override_reason) : null,
    overridden_by: row.overridden_by != null ? String(row.overridden_by) : null,
    overridden_at: row.overridden_at != null ? String(row.overridden_at) : null,
    fuel_cost: Number(row.fuel_cost),
    manpower_cost: Number(row.manpower_cost),
    consumables_cost: Number(row.consumables_cost),
    electrical_cost: Number(row.electrical_cost),
    transport_cost: Number(row.transport_cost),
    cost_per_kg: Number(row.cost_per_kg),
    selling_price_per_kg: Number(row.selling_price_per_kg),
    savings: Number(row.savings),
    created_by: String(row.created_by),
    created_at: String(row.created_at),
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function fetchRateMaster(): Promise<RateMasterRow[]> {
  const { data, error } = await furnace()
    .from('rate_master')
    .select('*')
    .order('item')
    .order('effective_from')
  if (error) throw error
  return (data ?? []).map((row) => rowToRateMaster(row as Record<string, unknown>))
}

export async function fetchAllHeatCostings(): Promise<HeatCostingRow[]> {
  const { data, error } = await furnace()
    .from('heat_costing')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => rowToHeatCosting(row as Record<string, unknown>))
}

export async function fetchHeatCostingByHeatId(heatId: string): Promise<HeatCostingRow | null> {
  const { data, error } = await furnace().from('heat_costing').select('*').eq('heat_id', heatId).maybeSingle()
  if (error) throw error
  return data ? rowToHeatCosting(data as Record<string, unknown>) : null
}

// ---------------------------------------------------------------------------
// Latest-effective-rate material cost (one current rate per item, versioned by
// effective_from). Same lookup previously used only for flat-rate items, now
// applied to every charged material. Does not touch remaining_qty_kg or
// rate_consumption_log.
// ---------------------------------------------------------------------------

export function heatCloseDate(heat: Heat): string {
  return (heat.verified_at ?? heat.updated_at ?? heat.created_at).slice(0, 10)
}

export function lookupLatestRate(item: string, closeDate: string, rates: RateMasterRow[]): RateMasterRow | null {
  const candidates = rates.filter((r) => r.item === item && r.effective_from <= closeDate)
  if (candidates.length === 0) return null
  return candidates.reduce((a, b) => (a.effective_from > b.effective_from ? a : b))
}

export interface MaterialCostLine {
  material_code: string
  kg: number
  rate_per_kg: number | null
  cost: number
}

export interface MaterialCostPreview {
  materialCost: number
  lines: MaterialCostLine[]
  uncovered: Array<{ material_code: string; kg: number }>
}

export function computeMaterialCostFromRates(
  chargeLines: ChargeLine[],
  rates: RateMasterRow[],
  closeDate: string,
): MaterialCostPreview {
  const totals = new Map<string, number>()
  for (const line of chargeLines) {
    totals.set(line.material_code, (totals.get(line.material_code) ?? 0) + line.net_kg)
  }

  let materialCost = 0
  const lines: MaterialCostLine[] = []
  const uncovered: MaterialCostPreview['uncovered'] = []

  for (const [materialCode, kg] of totals) {
    const rate = lookupLatestRate(materialCode, closeDate, rates)
    if (!rate) {
      lines.push({ material_code: materialCode, kg, rate_per_kg: null, cost: 0 })
      uncovered.push({ material_code: materialCode, kg })
      continue
    }
    const cost = kg * rate.rate_per_kg
    materialCost += cost
    lines.push({ material_code: materialCode, kg, rate_per_kg: rate.rate_per_kg, cost })
  }

  return { materialCost, lines, uncovered }
}

// ---------------------------------------------------------------------------
// Writes — Plant Head / Owner only (Supervisor/QA have zero RLS access to every table here)
// ---------------------------------------------------------------------------

// Looks up the latest effective rate per charged material and locks that figure into
// heat_costing once. material_cost_final defaults to the computed figure and is then the
// everyday actual-cost field (override flow). heat_costing.heat_id is UNIQUE, so a second
// call for an already-costed heat is also blocked at the database; the up-front check just
// avoids a duplicate insert error.
export async function computeAndSaveHeatCosting(
  user: AppUser,
  heat: Heat,
  chargeLines: ChargeLine[],
): Promise<HeatCostingRow> {
  const existing = await fetchHeatCostingByHeatId(heat.id)
  if (existing) return existing

  const rates = await fetchRateMaster()
  const preview = computeMaterialCostFromRates(chargeLines, rates, heatCloseDate(heat))

  const { data, error } = await furnace()
    .from('heat_costing')
    .insert({
      heat_id: heat.id,
      material_cost_computed: preview.materialCost,
      material_cost_final: preview.materialCost,
      fuel_cost: 0,
      manpower_cost: 0,
      consumables_cost: 0,
      electrical_cost: 0,
      transport_cost: 0,
      cost_per_kg: 0,
      selling_price_per_kg: 0,
      savings: 0,
      created_by: user.id,
    })
    .select('*')
    .single()
  if (error) throw error
  return rowToHeatCosting(data as Record<string, unknown>)
}

// Base-cost suggestions (fuel/manpower/...) stay hand-entered (03i §4). Offered as a
// non-binding rate × charged-kg hint next to each field using the same latest-effective
// lookup as material cost.
const FLAT_RATE_KEYWORDS: Record<'fuel' | 'manpower' | 'consumables' | 'electrical' | 'transport', string[]> = {
  fuel: ['fuel', 'diesel'],
  manpower: ['labour', 'labor', 'manpower'],
  consumables: ['overhead', 'consumable'],
  electrical: ['electric'],
  transport: ['transport', 'freight'],
}

export function suggestFlatRateCost(
  category: keyof typeof FLAT_RATE_KEYWORDS,
  closeDateIso: string,
  chargedNetKg: number,
  rates: RateMasterRow[],
): { rate_per_kg: number; item: string; suggested_cost: number } | null {
  const keywords = FLAT_RATE_KEYWORDS[category]
  const candidates = rates.filter(
    (l) => l.effective_from <= closeDateIso && keywords.some((k) => l.item.toLowerCase().includes(k)),
  )
  if (candidates.length === 0) return null
  const latest = candidates.reduce((a, b) => (a.effective_from > b.effective_from ? a : b))
  return { rate_per_kg: latest.rate_per_kg, item: latest.item, suggested_cost: latest.rate_per_kg * chargedNetKg }
}

// The "base cost inputs" (03i §4) — hand-entered, never gated. Recomputes cost_per_kg/savings
// from the heat's saleable output (ingot_kg) but never touches material_cost_final or any of
// the override bookkeeping columns; that's the one thing the override flow (proposeChange /
// applyDirectChange with target_table 'heat_costing', see masterAdminService.ts) is for.
export async function updateHeatCostingBaseInputs(
  costing: HeatCostingRow,
  inputs: HeatCostingBaseInputsPayload,
  ingotKg: number,
): Promise<HeatCostingRow> {
  const totalCost =
    costing.material_cost_final +
    inputs.fuel_cost +
    inputs.manpower_cost +
    inputs.consumables_cost +
    inputs.electrical_cost +
    inputs.transport_cost
  const costPerKg = ingotKg > 0 ? totalCost / ingotKg : 0
  const savings = (inputs.selling_price_per_kg - costPerKg) * ingotKg

  const { data, error } = await furnace()
    .from('heat_costing')
    .update({ ...inputs, cost_per_kg: costPerKg, savings })
    .eq('id', costing.id)
    .select('*')
    .single()
  if (error) throw error
  return rowToHeatCosting(data as Record<string, unknown>)
}

// Second step after a material_cost_final write: derived cost_per_kg/savings must be a
// separate UPDATE because the override RLS policy forbids touching those columns in the
// same statement as material_cost_final.
export async function refreshHeatCostingDerived(costingId: string): Promise<void> {
  const { data, error } = await furnace().from('heat_costing').select('*').eq('id', costingId).single()
  if (error) throw error
  const costing = rowToHeatCosting(data as Record<string, unknown>)
  const { data: output } = await furnace()
    .from('heat_output')
    .select('ingot_kg')
    .eq('heat_id', costing.heat_id)
    .maybeSingle()
  await updateHeatCostingBaseInputs(
    costing,
    {
      fuel_cost: costing.fuel_cost,
      manpower_cost: costing.manpower_cost,
      consumables_cost: costing.consumables_cost,
      electrical_cost: costing.electrical_cost,
      transport_cost: costing.transport_cost,
      selling_price_per_kg: costing.selling_price_per_kg,
    },
    Number(output?.ingot_kg ?? 0),
  )
}

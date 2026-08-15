import { supabase } from './supabaseClient'
import type { AppUser } from '../types/auth'
import type { ChargeLine, Heat } from '../types/heat'
import type {
  HeatCostingBaseInputsPayload,
  HeatCostingRow,
  RateConsumptionLogRow,
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

function rowToRateConsumptionLog(row: Record<string, unknown>): RateConsumptionLogRow {
  return {
    id: String(row.id),
    heat_id: String(row.heat_id),
    rate_master_id: String(row.rate_master_id),
    item: String(row.item),
    kg_consumed: Number(row.kg_consumed),
    rate_used: Number(row.rate_used),
    created_at: String(row.created_at),
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

export async function fetchRateConsumptionLog(heatId: string): Promise<RateConsumptionLogRow[]> {
  const { data, error } = await furnace()
    .from('rate_consumption_log')
    .select('*')
    .eq('heat_id', heatId)
    .order('created_at')
  if (error) throw error
  return (data ?? []).map((row) => rowToRateConsumptionLog(row as Record<string, unknown>))
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
// FIFO material cost draw (03i §2)
// ---------------------------------------------------------------------------

interface FifoLotUpdate {
  id: string
  remaining_qty_kg: number
}

interface FifoConsumptionRow {
  heat_id: string
  rate_master_id: string
  item: string
  kg_consumed: number
  rate_used: number
}

export interface FifoDrawResult {
  materialCost: number
  consumptionRows: FifoConsumptionRow[]
  lotUpdates: FifoLotUpdate[]
  // Charged kg for a material with no lot coverage at all (rate_master has no matching
  // lot_material entries, or existing lots are fully drawn down) — [FLAG], never blocks costing;
  // that portion just contributes zero to materialCost and is surfaced to Plant Head/Owner so
  // they know the figure is understated until a rate is entered.
  uncovered: Array<{ material_code: string; kg: number }>
}

// Oldest effective_from lot first; if a heat's charge for one material spans more than one lot,
// blend proportionally across every lot touched and record one rate_consumption_log row per lot
// (03i §2). Pure function so it can be shown as a preview before committing any writes.
export function drawMaterialCostFifo(heatId: string, chargeLines: ChargeLine[], lots: RateMasterRow[]): FifoDrawResult {
  const totals = new Map<string, number>()
  for (const line of chargeLines) {
    totals.set(line.material_code, (totals.get(line.material_code) ?? 0) + line.net_kg)
  }

  const lotsByItem = new Map<string, RateMasterRow[]>()
  for (const lot of lots) {
    if (lot.item_type !== 'lot_material') continue
    const list = lotsByItem.get(lot.item) ?? []
    list.push(lot)
    lotsByItem.set(lot.item, list)
  }
  for (const list of lotsByItem.values()) {
    list.sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  }

  let materialCost = 0
  const consumptionRows: FifoConsumptionRow[] = []
  const lotUpdates: FifoLotUpdate[] = []
  const uncovered: FifoDrawResult['uncovered'] = []

  for (const [materialCode, totalKg] of totals) {
    let remaining = totalKg
    for (const lot of lotsByItem.get(materialCode) ?? []) {
      if (remaining <= 0) break
      const available = lot.remaining_qty_kg ?? 0
      if (available <= 0) continue
      const drawn = Math.min(remaining, available)
      materialCost += drawn * lot.rate_per_kg
      consumptionRows.push({ heat_id: heatId, rate_master_id: lot.id, item: materialCode, kg_consumed: drawn, rate_used: lot.rate_per_kg })
      lotUpdates.push({ id: lot.id, remaining_qty_kg: available - drawn })
      remaining -= drawn
    }
    if (remaining > 1e-6) {
      uncovered.push({ material_code: materialCode, kg: remaining })
    }
  }

  return { materialCost, consumptionRows, lotUpdates, uncovered }
}

export async function previewHeatCostingFifo(heatId: string, chargeLines: ChargeLine[]): Promise<FifoDrawResult> {
  const lots = await fetchRateMaster()
  return drawMaterialCostFifo(heatId, chargeLines, lots)
}

// ---------------------------------------------------------------------------
// Writes — Plant Head / Owner only (Supervisor/QA have zero RLS access to every table here)
// ---------------------------------------------------------------------------

// Runs the FIFO draw exactly once per heat and commits it: decrements every lot touched,
// writes one rate_consumption_log row per lot, and creates the heat_costing row with
// material_cost_final defaulted to the fresh material_cost_computed figure (03i §3 — "always
// the FIFO-derived figure, calculated fresh, never overwritten"). heat_costing.heat_id is UNIQUE,
// so a second call for an already-costed heat is also blocked at the database level — this
// up-front check just avoids re-drawing lots (and double-decrementing remaining_qty_kg) before
// that constraint would ever fire.
export async function computeAndSaveHeatCosting(
  user: AppUser,
  heat: Heat,
  chargeLines: ChargeLine[],
): Promise<HeatCostingRow> {
  const existing = await fetchHeatCostingByHeatId(heat.id)
  if (existing) return existing

  const draw = await previewHeatCostingFifo(heat.id, chargeLines)

  for (const update of draw.lotUpdates) {
    const { error } = await furnace()
      .from('rate_master')
      .update({ remaining_qty_kg: update.remaining_qty_kg, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq('id', update.id)
    if (error) throw error
  }

  if (draw.consumptionRows.length > 0) {
    const { error } = await furnace().from('rate_consumption_log').insert(draw.consumptionRows)
    if (error) throw error
  }

  const { data, error } = await furnace()
    .from('heat_costing')
    .insert({
      heat_id: heat.id,
      material_cost_computed: draw.materialCost,
      material_cost_final: draw.materialCost,
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

// Flat-rate items (electricity, labour, overhead, transport, ...) have no quantity/FIFO — 03i §2
// says to use whichever entry has the latest effective_from <= the heat's close date. 03i §4
// then calls fuel/manpower/consumables/electrical/transport "base cost inputs" that stay
// hand-entered rather than fully computed, so this is offered as a non-binding suggestion next
// to each field (rate x charged kg) rather than silently overwriting whatever Plant Head types.
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
  lots: RateMasterRow[],
): { rate_per_kg: number; item: string; suggested_cost: number } | null {
  const keywords = FLAT_RATE_KEYWORDS[category]
  const candidates = lots.filter(
    (l) =>
      l.item_type === 'flat_rate' &&
      l.effective_from <= closeDateIso &&
      keywords.some((k) => l.item.toLowerCase().includes(k)),
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

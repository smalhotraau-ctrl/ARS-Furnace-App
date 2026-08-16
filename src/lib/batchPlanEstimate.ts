import type { PlannedLine } from '../types/batchPlan'
import type { ProcessCostStandardRow, RateMasterRow } from '../types/costing'
import type { ChargeLine } from '../types/heat'
import type { MaterialYieldStandardRow } from '../types/output'
import { computeMaterialCostFromRates, lookupLatestRate } from './costingService'
import { computeExpectedBand } from './outputCalc'

export function lookupLatestProcessCostStandard(
  asOfDate: string,
  rows: ProcessCostStandardRow[],
): ProcessCostStandardRow | null {
  const candidates = rows.filter((r) => r.effective_from <= asOfDate)
  if (candidates.length === 0) return null
  return candidates.reduce((a, b) => (a.effective_from > b.effective_from ? a : b))
}

export function processCostPerKg(standard: ProcessCostStandardRow | null): number | null {
  if (!standard) return null
  return (
    standard.fuel_cost_per_kg +
    standard.manpower_cost_per_kg +
    standard.consumables_cost_per_kg +
    standard.electrical_transport_cost_per_kg
  )
}

export function plannedLinesToChargeLines(lines: PlannedLine[]): ChargeLine[] {
  return lines.map((line, index) => ({
    id: `plan-${index}`,
    heat_id: '',
    bin_bay: null,
    material_code: line.material_code,
    gross_kg: null,
    tare_kg: null,
    net_kg: line.planned_kg,
    is_mid_heat_addition: false,
    added_at: '',
    created_by: '',
    created_at: '',
  }))
}

export interface BatchPlanEstimate {
  totalPlannedKg: number
  materialCost: number
  materialLines: Array<{ material_code: string; kg: number; rate_per_kg: number | null; cost: number }>
  uncoveredMaterials: string[]
  ingotBand: { min: number; max: number } | null
  estimatedIngotKgMid: number | null
  processCost: number | null
  processRatePerKg: number | null
  totalCost: number | null
  costPerKg: number | null
}

export function computeBatchPlanEstimate(
  plannedLines: PlannedLine[],
  planDate: string,
  rates: RateMasterRow[],
  yieldStandards: MaterialYieldStandardRow[],
  processStandards: ProcessCostStandardRow[],
): BatchPlanEstimate {
  const totalPlannedKg = plannedLines.reduce((sum, line) => sum + line.planned_kg, 0)
  if (totalPlannedKg <= 0) {
    return {
      totalPlannedKg: 0,
      materialCost: 0,
      materialLines: [],
      uncoveredMaterials: [],
      ingotBand: null,
      estimatedIngotKgMid: null,
      processCost: null,
      processRatePerKg: null,
      totalCost: null,
      costPerKg: null,
    }
  }

  const chargeLines = plannedLinesToChargeLines(plannedLines)
  const materialPreview = computeMaterialCostFromRates(chargeLines, rates, planDate)

  const ingotBand = computeExpectedBand(chargeLines, yieldStandards, 'ingot_pct')
  const estimatedIngotKgMid = ingotBand
    ? (totalPlannedKg * (ingotBand.min + ingotBand.max)) / 200
    : null

  const processStandard = lookupLatestProcessCostStandard(planDate, processStandards)
  const processRatePerKg = processCostPerKg(processStandard)
  const processCost = processRatePerKg != null ? totalPlannedKg * processRatePerKg : null

  const totalCost =
    processCost != null ? materialPreview.materialCost + processCost : materialPreview.materialCost
  const costPerKg =
    estimatedIngotKgMid != null && estimatedIngotKgMid > 0 && totalCost != null
      ? totalCost / estimatedIngotKgMid
      : null

  return {
    totalPlannedKg,
    materialCost: materialPreview.materialCost,
    materialLines: materialPreview.lines,
    uncoveredMaterials: materialPreview.uncovered.map((u) => u.material_code),
    ingotBand,
    estimatedIngotKgMid,
    processCost,
    processRatePerKg,
    totalCost,
    costPerKg,
  }
}

// Convenience for displaying current material rate on estimate breakdown.
export function lookupMaterialRate(
  materialCode: string,
  asOfDate: string,
  rates: RateMasterRow[],
): RateMasterRow | null {
  return lookupLatestRate(materialCode, asOfDate, rates)
}

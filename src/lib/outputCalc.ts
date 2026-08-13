import type { ChargeLine } from '../types/heat'
import type { MaterialYieldStandardRow, YieldMetric } from '../types/output'
import { YIELD_METRICS } from '../types/output'

export interface RecoveryBreakdown {
  charged_net_kg: number
  burn_loss_kg: number
  ingot_pct: number
  dross_pct: number
  rejection_pct: number
  iron_pct: number
  burn_loss_pct: number
}

export interface YieldBand {
  min: number
  max: number
}

export interface YieldFlagCandidate {
  metric: YieldMetric
  actual_pct: number
  expected_min_pct: number
  expected_max_pct: number
}

export function computeChargedNetKg(chargeLines: ChargeLine[]): number {
  return chargeLines.reduce((sum, line) => sum + line.net_kg, 0)
}

// burn_loss_kg = charged_net_kg − (ingot_kg + dross_kg + rejection_kg + iron_kg + exceptional_kg) — 03f §1
export function computeBurnLossKg(
  chargedNetKg: number,
  ingotKg: number,
  drossKg: number,
  rejectionKg: number,
  ironKg: number,
  exceptionalKg: number,
): number {
  return chargedNetKg - (ingotKg + drossKg + rejectionKg + ironKg + exceptionalKg)
}

// Five recovery percentages, per 03f §3 (Ingot/Dross/Rejection/Iron are equally-weighted core
// fields, Burn Loss is the derived balancing figure). Stored as plain percentage numbers
// (e.g. 92.4), consistent with how grade_specs/material_yield_standards min_pct/max_pct are authored.
export function computeRecoveryBreakdown(
  chargedNetKg: number,
  ingotKg: number,
  drossKg: number,
  rejectionKg: number,
  ironKg: number,
  exceptionalKg: number,
): RecoveryBreakdown {
  const burn_loss_kg = computeBurnLossKg(chargedNetKg, ingotKg, drossKg, rejectionKg, ironKg, exceptionalKg)
  const pct = (kg: number) => (chargedNetKg > 0 ? (kg / chargedNetKg) * 100 : 0)

  return {
    charged_net_kg: chargedNetKg,
    burn_loss_kg,
    ingot_pct: pct(ingotKg),
    dross_pct: pct(drossKg),
    rejection_pct: pct(rejectionKg),
    iron_pct: pct(ironKg),
    burn_loss_pct: pct(burn_loss_kg),
  }
}

// Expected band for one metric = kg-weighted blend of material_yield_standards across every
// charge_lines row for the heat (including mid-heat additions) — 03f §4. Materials with no
// standard row for this metric are excluded from both the sum and the weight total.
export function computeExpectedBand(
  chargeLines: ChargeLine[],
  yieldStandards: MaterialYieldStandardRow[],
  metric: YieldMetric,
): YieldBand | null {
  let weightedMinSum = 0
  let weightedMaxSum = 0
  let totalKg = 0

  for (const line of chargeLines) {
    const std = yieldStandards.find((s) => s.material_code === line.material_code && s.metric === metric && s.active)
    if (!std) continue
    weightedMinSum += std.min_pct * line.net_kg
    weightedMaxSum += std.max_pct * line.net_kg
    totalKg += line.net_kg
  }

  if (totalKg <= 0) return null
  return { min: weightedMinSum / totalKg, max: weightedMaxSum / totalKg }
}

// For each of the four metrics independently: if the heat's actual % falls outside its
// blended expected band, it's a candidate flag row — 03f §4. Non-blocking; used only to
// decide what to write to heat_output_flags at verification time.
export function computeYieldFlags(
  recovery: RecoveryBreakdown,
  chargeLines: ChargeLine[],
  yieldStandards: MaterialYieldStandardRow[],
): YieldFlagCandidate[] {
  const actualByMetric: Record<YieldMetric, number> = {
    ingot_pct: recovery.ingot_pct,
    dross_pct: recovery.dross_pct,
    rejection_pct: recovery.rejection_pct,
    iron_pct: recovery.iron_pct,
    burn_loss_pct: recovery.burn_loss_pct,
  }

  const flags: YieldFlagCandidate[] = []
  for (const metric of YIELD_METRICS) {
    const band = computeExpectedBand(chargeLines, yieldStandards, metric)
    if (!band) continue
    const actual = actualByMetric[metric]
    if (actual < band.min || actual > band.max) {
      flags.push({ metric, actual_pct: actual, expected_min_pct: band.min, expected_max_pct: band.max })
    }
  }
  return flags
}

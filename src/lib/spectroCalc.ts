import type { GradeSpecRow, MaterialStdRow } from '../types/batchPlan'
import type { ChargeLine } from '../types/heat'
import type { CorrectionSuggestion, SpectroCompositionEntry, SpecFlag } from '../types/spectro'

export function flagActualPct(actual_pct: number, spec_min: number, spec_max: number): SpecFlag {
  return actual_pct >= spec_min && actual_pct <= spec_max ? 'in_spec' : 'out_of_spec'
}

export function buildCompositionEntries(
  gradeSpecs: GradeSpecRow[],
  gradeCode: string,
  actualPcts: Record<string, string>,
): SpectroCompositionEntry[] {
  const specsForGrade = gradeSpecs.filter((s) => s.grade_code === gradeCode && s.active)

  return specsForGrade.map((spec) => {
    const raw = actualPcts[spec.element]?.trim()
    const actual_pct = raw ? Number(raw) : 0
    return {
      element: spec.element,
      actual_pct: Number.isFinite(actual_pct) ? actual_pct : 0,
      spec_min: spec.min_pct,
      spec_max: spec.max_pct,
      flag: flagActualPct(Number.isFinite(actual_pct) ? actual_pct : 0, spec.min_pct, spec.max_pct),
    }
  })
}

export function totalChargedKg(chargeLines: ChargeLine[]): number {
  return chargeLines.reduce((sum, line) => sum + line.net_kg, 0)
}

function stdRowsForElement(
  element: string,
  materialStd: MaterialStdRow[],
  activeMaterialCodes?: Set<string>,
): MaterialStdRow[] {
  return materialStd.filter(
    (row) =>
      row.element === element &&
      row.std_pct > 0 &&
      (!activeMaterialCodes || activeMaterialCodes.has(row.material_code)),
  )
}

function pickRichestMaterial(
  element: string,
  materialStd: MaterialStdRow[],
  targetPct: number,
  activeMaterialCodes?: Set<string>,
): MaterialStdRow | null {
  const candidates = stdRowsForElement(element, materialStd, activeMaterialCodes).filter(
    (row) => row.std_pct > targetPct,
  )
  if (candidates.length === 0) return null
  return candidates.reduce((best, row) => (row.std_pct > best.std_pct ? row : best))
}

function pickMostDiluteMaterial(
  element: string,
  materialStd: MaterialStdRow[],
  targetPct: number,
  activeMaterialCodes?: Set<string>,
): MaterialStdRow | null {
  const candidates = stdRowsForElement(element, materialStd, activeMaterialCodes).filter(
    (row) => row.std_pct < targetPct,
  )
  if (candidates.length === 0) return null
  return candidates.reduce((best, row) => (row.std_pct < best.std_pct ? row : best))
}

// Linear mix with dilution: adding x kg of material at std_pct c to melt M kg at actual a
// yields (a*M + c*x)/(M+x) = t  →  x = M*(t-a)/(c-t)
function additionKgForTarget(
  meltKg: number,
  actualPct: number,
  targetPct: number,
  materialStdPct: number,
): number | null {
  const denominator = materialStdPct - targetPct
  if (Math.abs(denominator) < 1e-6) return null
  const kg = (meltKg * (targetPct - actualPct)) / denominator
  if (!Number.isFinite(kg) || kg <= 0) return null
  return kg
}

// Dilute with low-element material when actual is above spec: x = M*(a-t)/(t-c)
function dilutionKgForTarget(
  meltKg: number,
  actualPct: number,
  targetPct: number,
  materialStdPct: number,
): number | null {
  const denominator = targetPct - materialStdPct
  if (Math.abs(denominator) < 1e-6) return null
  const kg = (meltKg * (actualPct - targetPct)) / denominator
  if (!Number.isFinite(kg) || kg <= 0) return null
  return kg
}

export function computeCorrectionSuggestion(
  composition: SpectroCompositionEntry[],
  chargeLines: ChargeLine[],
  materialStd: MaterialStdRow[],
  activeMaterialCodes?: Set<string>,
): CorrectionSuggestion[] {
  const meltKg = totalChargedKg(chargeLines)
  if (meltKg <= 0 || materialStd.length === 0) return []

  const suggestions: CorrectionSuggestion[] = []

  for (const entry of composition) {
    if (entry.flag === 'in_spec') continue

    if (entry.actual_pct < entry.spec_min) {
      const targetPct = entry.spec_min
      const material = pickRichestMaterial(
        entry.element,
        materialStd,
        targetPct,
        activeMaterialCodes,
      )
      if (!material) continue

      const suggestedKg = additionKgForTarget(
        meltKg,
        entry.actual_pct,
        targetPct,
        material.std_pct,
      )
      if (!suggestedKg || suggestedKg < 0.01) continue

      suggestions.push({
        material_code: material.material_code,
        suggested_kg: Math.round(suggestedKg * 100) / 100,
      })
      continue
    }

    if (entry.actual_pct > entry.spec_max) {
      const targetPct = entry.spec_max
      const material = pickMostDiluteMaterial(
        entry.element,
        materialStd,
        targetPct,
        activeMaterialCodes,
      )
      if (!material) continue

      const suggestedKg = dilutionKgForTarget(
        meltKg,
        entry.actual_pct,
        targetPct,
        material.std_pct,
      )
      if (!suggestedKg || suggestedKg < 0.01) continue

      suggestions.push({
        material_code: material.material_code,
        suggested_kg: Math.round(suggestedKg * 100) / 100,
      })
    }
  }

  return suggestions
}

import type { GradeSpecRow } from '../types/batchPlan'
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

export function computeCorrectionSuggestion(
  composition: SpectroCompositionEntry[],
  chargeLines: ChargeLine[],
): CorrectionSuggestion[] {
  const meltKg = totalChargedKg(chargeLines)
  if (meltKg <= 0) return []

  const dominantMaterial =
    chargeLines.length > 0
      ? chargeLines.reduce((best, line) => (line.net_kg > best.net_kg ? line : best)).material_code
      : 'Alloy'

  const suggestions: CorrectionSuggestion[] = []

  for (const entry of composition) {
    if (entry.flag === 'in_spec') continue

    const target = (entry.spec_min + entry.spec_max) / 2
    const deltaPct = target - entry.actual_pct
    const suggestedKg = Math.abs((deltaPct / 100) * meltKg)

    if (suggestedKg < 0.01) continue

    suggestions.push({
      material_code: `${dominantMaterial} (${entry.element})`,
      suggested_kg: Math.round(suggestedKg * 100) / 100,
    })
  }

  return suggestions
}

import type {
  ExpectedCompositionEntry,
  GradeSpecRow,
  MaterialStdRow,
  PlannedLine,
} from '../types/batchPlan'

function normalizeElement(element: string): string {
  return element.trim().toUpperCase()
}

function normalizeMaterialCode(code: string): string {
  return code.trim().toUpperCase()
}

function stdPctFor(materialStd: MaterialStdRow[], materialCode: string, element: string): number | null {
  const row = materialStd.find(
    (r) =>
      normalizeMaterialCode(r.material_code) === normalizeMaterialCode(materialCode) &&
      normalizeElement(r.element) === normalizeElement(element),
  )
  return row?.std_pct ?? null
}

export function computeExpectedComposition(
  plannedLines: PlannedLine[],
  materialStd: MaterialStdRow[],
  gradeSpecs: GradeSpecRow[],
  gradeCode: string,
): ExpectedCompositionEntry[] {
  const totalKg = plannedLines.reduce((sum, line) => sum + line.planned_kg, 0)
  if (totalKg <= 0) return []

  const specsForGrade = gradeSpecs.filter(
    (spec) => spec.grade_code === gradeCode && spec.active,
  )
  const elements = [...new Set(specsForGrade.map((spec) => spec.element))]

  return elements.map((element) => {
    let weightedSum = 0
    for (const line of plannedLines) {
      const stdPct = stdPctFor(materialStd, line.material_code, element)
      if (stdPct != null) {
        weightedSum += stdPct * line.planned_kg
      }
    }

    const expected_pct = weightedSum / totalKg
    const spec = specsForGrade.find((row) => normalizeElement(row.element) === normalizeElement(element))
    const inSpec = spec
      ? expected_pct >= spec.min_pct && expected_pct <= spec.max_pct
      : true

    return {
      element,
      expected_pct,
      spec_flag: inSpec ? 'in_spec' : 'out_of_spec',
    }
  })
}

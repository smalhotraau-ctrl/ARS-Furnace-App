import type {
  ExpectedCompositionEntry,
  GradeSpecRow,
  MaterialStdRow,
  PlannedLine,
} from '../types/batchPlan'

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
      const std = materialStd.find(
        (row) => row.material_code === line.material_code && row.element === element,
      )
      if (std) {
        weightedSum += std.std_pct * line.planned_kg
      }
    }

    const expected_pct = weightedSum / totalKg
    const spec = specsForGrade.find((row) => row.element === element)
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

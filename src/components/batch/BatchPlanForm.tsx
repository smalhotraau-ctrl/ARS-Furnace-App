import { useState } from 'react'
import type { BatchPlan } from '../../types/batchPlan'
import type { GradeSpecRow, MaterialOption, MaterialStdRow, PlannedLine } from '../../types/batchPlan'
import { computeExpectedComposition } from '../../lib/compositionCalc'
import { computeBatchPlanEstimate } from '../../lib/batchPlanEstimate'
import { ExpectedCompositionPanel } from './ExpectedCompositionPanel'
import { EstimatedCostingPanel } from './EstimatedCostingPanel'
import type { ProcessCostStandardRow, RateMasterRow } from '../../types/costing'
import type { MaterialYieldStandardRow } from '../../types/output'
import { PlannedLinesEditor } from './PlannedLinesEditor'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface BatchPlanFormProps {
  gradeCodes: string[]
  materials: MaterialOption[]
  materialStd: MaterialStdRow[]
  gradeSpecs: GradeSpecRow[]
  initialPlan?: BatchPlan | null
  disabled?: boolean
  showEstimates?: boolean
  rates?: RateMasterRow[]
  yieldStandards?: MaterialYieldStandardRow[]
  processStandards?: ProcessCostStandardRow[]
  onSubmit: (values: {
    grade_code: string
    plan_date: string
    planned_lines: PlannedLine[]
    expected_composition: ReturnType<typeof computeExpectedComposition>
  }) => Promise<void>
  onCancel?: () => void
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function BatchPlanForm({
  gradeCodes,
  materials,
  materialStd,
  gradeSpecs,
  initialPlan = null,
  disabled = false,
  showEstimates = false,
  rates = [],
  yieldStandards = [],
  processStandards = [],
  onSubmit,
  onCancel,
}: BatchPlanFormProps) {
  const { t } = useLanguage()
  const [step, setStep] = useState(initialPlan ? 1 : 0)
  const [gradeCode, setGradeCode] = useState(initialPlan?.grade_code ?? '')
  const [planDate, setPlanDate] = useState(initialPlan?.plan_date ?? todayIsoDate())
  const [plannedLines, setPlannedLines] = useState<PlannedLine[]>(initialPlan?.planned_lines ?? [])
  const [submitting, setSubmitting] = useState(false)

  const expectedComposition = computeExpectedComposition(
    plannedLines,
    materialStd,
    gradeSpecs,
    gradeCode,
  )

  const estimate = showEstimates
    ? computeBatchPlanEstimate(plannedLines, planDate, rates, yieldStandards, processStandards)
    : null

  const stepOneValid = Boolean(gradeCode && planDate)
  const stepTwoValid = plannedLines.length > 0

  async function handleSave() {
    if (!stepOneValid || !stepTwoValid) return
    setSubmitting(true)
    try {
      await onSubmit({
        grade_code: gradeCode,
        plan_date: planDate,
        planned_lines: plannedLines,
        expected_composition: expectedComposition,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText
        as="h2"
        en={initialPlan ? 'Edit Batch Plan' : 'New Batch Plan'}
        hi={initialPlan ? 'बैच योजना संपादित करें' : 'नई बैच योजना'}
        className="text-xl font-bold text-slate-100"
      />

      <div className="flex gap-2">
        {[0, 1].map((index) => (
          <div
            key={index}
            className={`h-2 flex-1 rounded-full ${step >= index ? 'bg-emerald-500' : 'bg-slate-700'}`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            <label className="block space-y-2">
              <BilingualText as="span" en="Grade *" hi="ग्रेड" className="font-semibold" />
              <select
                value={gradeCode}
                disabled={disabled}
                onChange={(e) => setGradeCode(e.target.value)}
                className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg"
              >
                <option value="">{t('Select grade', 'ग्रेड चुनें')}</option>
                {gradeCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <BilingualText as="span" en="Plan date *" hi="योजना तारीख" className="font-semibold" />
              <input
                type="date"
                value={planDate}
                disabled={disabled}
                onChange={(e) => setPlanDate(e.target.value)}
                className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={disabled || !stepOneValid}
            onClick={() => setStep(1)}
            className="min-h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-on-accent disabled:opacity-50 lg:w-auto lg:px-8"
          >
            {t('Next', 'आगे')}
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <PlannedLinesEditor
            lines={plannedLines}
            materials={materials}
            disabled={disabled}
            onChange={setPlannedLines}
          />
          <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
            <ExpectedCompositionPanel composition={expectedComposition} />
            {showEstimates && estimate && <EstimatedCostingPanel estimate={estimate} />}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => (onCancel ? onCancel() : setStep(0))}
              className="min-h-14 flex-1 rounded-xl border border-slate-600 text-lg font-semibold"
            >
              {onCancel ? t('Cancel', 'रद्द') : t('Back', 'पीछे')}
            </button>
            <button
              type="button"
              disabled={disabled || !stepTwoValid || submitting}
              onClick={() => void handleSave()}
              className="min-h-14 flex-1 rounded-xl bg-emerald-500 text-lg font-semibold text-on-accent disabled:opacity-50"
            >
              {t('Save', 'सहेजें')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

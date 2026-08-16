import type { BatchPlan } from '../../types/batchPlan'
import type { GradeSpecRow, MaterialStdRow } from '../../types/batchPlan'
import { useMemo } from 'react'
import { computeExpectedComposition } from '../../lib/compositionCalc'
import { ExpectedCompositionPanel } from './ExpectedCompositionPanel'
import { EstimatedCostingPanel } from './EstimatedCostingPanel'
import { computeBatchPlanEstimate } from '../../lib/batchPlanEstimate'
import type { ProcessCostStandardRow, RateMasterRow } from '../../types/costing'
import type { MaterialYieldStandardRow } from '../../types/output'
import { BilingualText } from '../ui/BilingualText'
import { DeskTd, DesktopTable } from '../ui/DesktopTable'
import { useLanguage } from '../../context/LanguageContext'

interface BatchPlanDetailProps {
  plan: BatchPlan | null
  materialStd: MaterialStdRow[]
  gradeSpecs: GradeSpecRow[]
  showEstimates?: boolean
  rates?: RateMasterRow[]
  yieldStandards?: MaterialYieldStandardRow[]
  processStandards?: ProcessCostStandardRow[]
}

export function BatchPlanDetail({
  plan,
  materialStd,
  gradeSpecs,
  showEstimates = false,
  rates = [],
  yieldStandards = [],
  processStandards = [],
}: BatchPlanDetailProps) {
  const { t } = useLanguage()

  const composition = useMemo(
    () =>
      plan
        ? computeExpectedComposition(plan.planned_lines, materialStd, gradeSpecs, plan.grade_code)
        : [],
    [plan, materialStd, gradeSpecs],
  )

  const estimate = useMemo(
    () =>
      plan && showEstimates
        ? computeBatchPlanEstimate(
            plan.planned_lines,
            plan.plan_date,
            rates,
            yieldStandards,
            processStandards,
          )
        : null,
    [plan, showEstimates, rates, yieldStandards, processStandards],
  )

  if (!plan) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-600 p-6 text-center text-slate-400">
        <p>{t('Select a batch plan to view details', 'विवरण देखने के लिए बैच योजना चुनें')}</p>
      </section>
    )
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <div>
        <BilingualText
          as="h2"
          en="Batch Plan Details"
          hi="बैच योजना विवरण"
          className="text-xl font-bold text-slate-100"
        />
        <p className="mt-2 text-lg font-semibold text-emerald-400">{plan.grade_code}</p>
        <p className="text-sm text-slate-400">{plan.plan_date} · {plan.status}</p>
      </div>

      {plan.owner_reviewed && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          <p>{t('Reviewed for costing', 'costing के लिए समीक्षित')}</p>
          {plan.owner_review_note && <p className="mt-1 text-slate-300">{plan.owner_review_note}</p>}
        </div>
      )}

      <div>
        <BilingualText
          as="h3"
          en="Planned Materials"
          hi="योजना बनाई सामग्री"
          className="mb-3 text-base font-semibold"
        />
        <ul className="space-y-2 lg:hidden">
          {plan.planned_lines.map((line, index) => (
            <li
              key={`${line.material_code}-${index}`}
              className="flex justify-between rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3"
            >
              <span className="font-medium">{line.material_code}</span>
              <span>{line.planned_kg} kg</span>
            </li>
          ))}
        </ul>
        <DesktopTable columns={[t('Material', 'सामग्री'), t('kg', 'किग्रा')]}>
          {plan.planned_lines.map((line, index) => (
            <tr key={`${line.material_code}-${index}`} className="hover:bg-slate-800/40">
              <DeskTd className="font-medium">{line.material_code}</DeskTd>
              <DeskTd>{line.planned_kg}</DeskTd>
            </tr>
          ))}
        </DesktopTable>
      </div>

      <ExpectedCompositionPanel composition={composition} />

      {showEstimates && estimate && <EstimatedCostingPanel estimate={estimate} />}

      <p className="text-xs text-slate-500">
        {t('Owner review does not block charging', 'मालिक की समीक्षा charging नहीं रोकती')}
      </p>
    </section>
  )
}

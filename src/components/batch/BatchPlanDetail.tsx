import type { BatchPlan } from '../../types/batchPlan'
import { ExpectedCompositionPanel } from './ExpectedCompositionPanel'
import { BilingualText } from '../ui/BilingualText'

interface BatchPlanDetailProps {
  plan: BatchPlan | null
}

export function BatchPlanDetail({ plan }: BatchPlanDetailProps) {
  if (!plan) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-600 p-6 text-center text-slate-400">
        <p>Select a batch plan to view details</p>
        <p className="text-sm">विवरण देखने के लिए बैच योजना चुनें</p>
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
        <p className="mt-2 text-lg font-semibold text-emerald-400">
          {plan.furnace_code} · {plan.grade_code}
        </p>
        <p className="text-sm text-slate-400">{plan.plan_date} · {plan.status}</p>
      </div>

      {plan.owner_reviewed && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          <p>Reviewed for costing · costing के लिए समीक्षित</p>
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
        <ul className="space-y-2">
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
      </div>

      <ExpectedCompositionPanel composition={plan.expected_composition} />

      <p className="text-xs text-slate-500">
        Owner review does not block charging · मालिक की समीक्षा charging नहीं रोकती
      </p>
    </section>
  )
}

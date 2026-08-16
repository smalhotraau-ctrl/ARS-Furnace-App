import type { BatchPlan } from '../../types/batchPlan'
import { useLanguage } from '../../context/LanguageContext'
import { DeskTd, DesktopTable } from '../ui/DesktopTable'

interface BatchPlanListProps {
  plans: BatchPlan[]
  selectedId: string | null
  onSelect: (plan: BatchPlan) => void
}

export function BatchPlanList({ plans, selectedId, onSelect }: BatchPlanListProps) {
  const { t } = useLanguage()

  if (plans.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-600 p-6 text-center text-slate-400">
        <p>{t('No batch plans yet', 'अभी कोई बैच योजना नहीं')}</p>
      </div>
    )
  }

  return (
    <>
      <ul className="space-y-3 lg:hidden">
        {plans.map((plan) => {
          const selected = selectedId === plan.id
          return (
            <li key={plan.id}>
              <button
                type="button"
                onClick={() => onSelect(plan)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  selected
                    ? 'border-emerald-500 bg-emerald-950/40'
                    : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-slate-100">{plan.grade_code}</p>
                    <p className="text-sm text-slate-400">{plan.plan_date}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="capitalize text-slate-300">{plan.status}</p>
                    {plan.owner_reviewed ? (
                      <span className="mt-1 inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                        {t('Reviewed', 'समीक्षित')}
                      </span>
                    ) : (
                      <span className="mt-1 inline-block rounded-full bg-slate-600/40 px-2 py-0.5 text-xs text-slate-300">
                        {t('Not reviewed', 'समीक्षा बाकी')}
                      </span>
                    )}
                    {plan._pending && (
                      <span className="mt-1 block rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                        Local
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      <DesktopTable
        columns={[
          t('Grade', 'ग्रेड'),
          t('Date', 'तारीख'),
          t('Status', 'स्थिति'),
          t('Review', 'समीक्षा'),
        ]}
      >
        {plans.map((plan) => {
          const selected = selectedId === plan.id
          return (
            <tr
              key={plan.id}
              onClick={() => onSelect(plan)}
              className={`cursor-pointer ${
                selected ? 'bg-emerald-950/40' : 'hover:bg-slate-800/40'
              }`}
            >
              <DeskTd className="font-semibold text-slate-100">{plan.grade_code}</DeskTd>
              <DeskTd className="whitespace-nowrap text-slate-400">{plan.plan_date}</DeskTd>
              <DeskTd className="capitalize">
                {plan.status}
                {plan._pending && (
                  <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Local</span>
                )}
              </DeskTd>
              <DeskTd>
                {plan.owner_reviewed ? (
                  <span className="text-emerald-300">{t('Reviewed', 'समीक्षित')}</span>
                ) : (
                  <span className="text-slate-400">{t('Not reviewed', 'समीक्षा बाकी')}</span>
                )}
              </DeskTd>
            </tr>
          )
        })}
      </DesktopTable>
    </>
  )
}

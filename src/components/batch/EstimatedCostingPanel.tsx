import type { BatchPlanEstimate } from '../../lib/batchPlanEstimate'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface EstimatedCostingPanelProps {
  estimate: BatchPlanEstimate
}

function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return n.toFixed(2)
}

export function EstimatedCostingPanel({ estimate }: EstimatedCostingPanelProps) {
  const { t } = useLanguage()

  if (estimate.totalPlannedKg <= 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-600 p-5 text-center text-slate-400">
        <p>{t('Add planned materials to see cost estimate', 'लागत अनुमान के लिए सामग्री जोड़ें')}</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-sky-700/60 bg-sky-950/20 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BilingualText as="h3" en="Estimated Costing" hi="अनुमानित लागत" className="text-lg font-bold text-slate-100" />
        <span className="rounded-full bg-sky-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-400">
          {t('Estimate', 'अनुमान')}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        {t(
          'Advisory only — does not affect saved plan or closed-heat costing',
          'केवल सलाह — सहेजी योजना या बंद हीट लागत को प्रभावित नहीं करता',
        )}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-sky-600/40 bg-slate-900/50 p-4">
          <p className="text-sm text-slate-400">{t('Estimated material cost', 'अनुमानित मैटेरियल लागत')}</p>
          <p className="text-2xl font-bold text-slate-100">₹{fmt(estimate.materialCost)}</p>
          {estimate.uncoveredMaterials.length > 0 && (
            <p className="mt-1 text-xs text-amber-300">
              {t('No rate for', 'कोई रेट नहीं')}: {estimate.uncoveredMaterials.join(', ')}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-sky-600/40 bg-slate-900/50 p-4">
          <p className="text-sm text-slate-400">{t('Estimated recovery (ingot)', 'अनुमानित रिकवरी (इंगट)')}</p>
          {estimate.ingotBand ? (
            <>
              <p className="text-2xl font-bold text-slate-100">
                {estimate.ingotBand.min.toFixed(1)}–{estimate.ingotBand.max.toFixed(1)}%
              </p>
              <p className="text-sm text-slate-300">
                ≈ {fmt(estimate.estimatedIngotKgMid)} kg {t('ingot', 'इंगट')}
              </p>
            </>
          ) : (
            <p className="text-lg text-slate-400">—</p>
          )}
        </div>

        <div className="rounded-xl border border-sky-600/40 bg-slate-900/50 p-4">
          <p className="text-sm text-slate-400">{t('Estimated process cost', 'अनुमानित प्रक्रिया लागत')}</p>
          <p className="text-2xl font-bold text-slate-100">₹{fmt(estimate.processCost)}</p>
          {estimate.processRatePerKg != null && (
            <p className="text-xs text-slate-400">
              {estimate.totalPlannedKg.toFixed(0)} kg × ₹{estimate.processRatePerKg.toFixed(2)}/kg
            </p>
          )}
        </div>

        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4">
          <p className="text-sm text-slate-400">{t('Estimated cost / kg ingot', 'अनुमानित लागत / kg इंगट')}</p>
          <p className="text-2xl font-bold text-slate-100">₹{fmt(estimate.costPerKg)}</p>
        </div>
      </div>
    </section>
  )
}

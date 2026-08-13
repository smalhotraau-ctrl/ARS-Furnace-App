import type { Heat } from '../../types/heat'
import type { HeatOutput } from '../../types/output'
import { useLanguage } from '../../context/LanguageContext'

interface HeatClosedBannerProps {
  heat: Heat
  output: HeatOutput
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 1 })
}

// Unmistakable completion state once a heat reaches Closed — big green card, checkmark,
// heat number, and the final output figures. Not a subtle status label.
export function HeatClosedBanner({ heat, output }: HeatClosedBannerProps) {
  const { t } = useLanguage()

  return (
    <section className="rounded-2xl border-2 border-emerald-500 bg-emerald-950/60 p-6 shadow-lg shadow-emerald-950/50">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-slate-950">
          <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="3.5">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-2xl font-extrabold text-emerald-200">{t('Heat Closed', 'हीट बंद')}</p>
          <p className="text-lg font-semibold text-emerald-100">{heat.heat_no}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl bg-emerald-900/50 p-3">
          <p className="text-xs text-emerald-300">{t('Ingot', 'इंगट')}</p>
          <p className="text-lg font-bold text-emerald-50">{fmt(output.ingot_kg)} kg</p>
          <p className="text-xs text-emerald-300">{fmt(output.ingot_pct)}%</p>
        </div>
        <div className="rounded-xl bg-emerald-900/50 p-3">
          <p className="text-xs text-emerald-300">{t('Dross', 'ड्रॉस')}</p>
          <p className="text-lg font-bold text-emerald-50">{fmt(output.dross_kg)} kg</p>
          <p className="text-xs text-emerald-300">{fmt(output.dross_pct)}%</p>
        </div>
        <div className="rounded-xl bg-emerald-900/50 p-3">
          <p className="text-xs text-emerald-300">{t('Rejection', 'रिजेक्शन')}</p>
          <p className="text-lg font-bold text-emerald-50">{fmt(output.rejection_kg)} kg</p>
          <p className="text-xs text-emerald-300">{fmt(output.rejection_pct)}%</p>
        </div>
        <div className="rounded-xl bg-emerald-900/50 p-3">
          <p className="text-xs text-emerald-300">{t('Iron', 'आयरन')}</p>
          <p className="text-lg font-bold text-emerald-50">{fmt(output.iron_kg)} kg</p>
          <p className="text-xs text-emerald-300">{fmt(output.iron_pct)}%</p>
        </div>
        <div className="rounded-xl bg-emerald-900/50 p-3">
          <p className="text-xs text-emerald-300">{t('Burn Loss', 'बर्न लॉस')}</p>
          <p className="text-lg font-bold text-emerald-50">{fmt(output.burn_loss_kg)} kg</p>
          <p className="text-xs text-emerald-300">{fmt(output.burn_loss_pct)}%</p>
        </div>
      </div>

      {output.exceptional_label && output.exceptional_kg != null && (
        <p className="mt-3 text-sm text-emerald-200">
          {output.exceptional_label}: {fmt(output.exceptional_kg)} kg
        </p>
      )}

      <p className="mt-4 text-sm text-emerald-300">
        {t('FG stock posted', 'FG स्टॉक जमा हुआ')} · {t('Verified', 'सत्यापित')} {new Date(output.verified_at ?? output.recorded_at).toLocaleString('en-IN')}
      </p>
    </section>
  )
}

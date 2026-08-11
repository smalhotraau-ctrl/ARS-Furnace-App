import type { HeatOutput } from '../../types/output'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface RecoveryBreakdownCardProps {
  output: HeatOutput
}

// Read-only recovery breakdown (section 3 of 03f) shown to the verifier and to anyone
// viewing an already-entered/closed heat.
export function RecoveryBreakdownCard({ output }: RecoveryBreakdownCardProps) {
  const { t } = useLanguage()

  return (
    <section className="space-y-3 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText as="h3" en="Recovery Breakdown" hi="रिकवरी विवरण" className="text-lg font-bold" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-900/60 p-3 text-center">
          <p className="text-xs text-slate-400">{t('Ingot', 'इंगट')}</p>
          <p className="font-bold text-slate-100">{output.ingot_kg.toFixed(2)} kg</p>
          <p className="text-sm text-emerald-400">{output.ingot_pct.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl bg-slate-900/60 p-3 text-center">
          <p className="text-xs text-slate-400">{t('Dross', 'ड्रॉस')}</p>
          <p className="font-bold text-slate-100">{output.dross_kg.toFixed(2)} kg</p>
          <p className="text-sm text-emerald-400">{output.dross_pct.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl bg-slate-900/60 p-3 text-center">
          <p className="text-xs text-slate-400">{t('Rejection', 'रिजेक्शन')}</p>
          <p className="font-bold text-slate-100">{output.rejection_kg.toFixed(2)} kg</p>
          <p className="text-sm text-emerald-400">{output.rejection_pct.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl bg-slate-900/60 p-3 text-center">
          <p className="text-xs text-slate-400">{t('Burn Loss', 'बर्न लॉस')}</p>
          <p className="font-bold text-slate-100">{output.burn_loss_kg.toFixed(2)} kg</p>
          <p className="text-sm text-emerald-400">{output.burn_loss_pct.toFixed(1)}%</p>
        </div>
      </div>

      {output.exceptional_label && output.exceptional_kg != null && (
        <p className="text-sm text-slate-300">
          {output.exceptional_label}: {output.exceptional_kg.toFixed(2)} kg
        </p>
      )}
    </section>
  )
}

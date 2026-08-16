import type { PlanVarianceFlag } from '../../lib/heatService'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface PlanVarianceExceptionsPanelProps {
  flags: PlanVarianceFlag[]
}

export function PlanVarianceExceptionsPanel({ flags }: PlanVarianceExceptionsPanelProps) {
  const { t } = useLanguage()

  if (flags.length === 0) return null

  return (
    <section className="space-y-3 rounded-2xl border-2 border-orange-500 bg-orange-950/30 p-5">
      <div className="flex items-center justify-between gap-3">
        <BilingualText
          as="h2"
          en="Plan vs Actual Exceptions"
          hi="योजना बनाम वास्तविक अपवाद"
          className="text-lg font-bold text-orange-200"
        />
        <span className="inline-flex items-center rounded-full bg-orange-500 px-3 py-1 text-sm font-extrabold text-on-accent">
          {flags.length} {t('open', 'खुला')}
        </span>
      </div>
      <ul className="space-y-2">
        {flags.slice(0, 12).map((flag) => (
          <li key={`${flag.heat_id}-${flag.material_code}`} className="rounded-xl border border-orange-500/50 bg-orange-950/40 px-4 py-3">
            <p className="font-bold text-orange-100">
              {flag.heat_no} · {flag.material_code}
            </p>
            <p className="text-sm text-orange-200/90">
              {t('Plan', 'योजना')} {flag.planned_kg} kg · {t('Actual', 'वास्तविक')} {flag.actual_kg.toFixed(1)} kg
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

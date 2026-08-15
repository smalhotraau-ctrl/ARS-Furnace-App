import { HEAT_STATUS_ICON, HEAT_STATUS_META } from '../../lib/heatStatusMeta'
import type { HeatStatus } from '../../types/heat'
import { useLanguage } from '../../context/LanguageContext'

interface HeatStatusBadgeProps {
  status: HeatStatus
  className?: string
}

export function HeatStatusBadge({ status, className = '' }: HeatStatusBadgeProps) {
  const { t } = useLanguage()
  const meta = HEAT_STATUS_META[status]

  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${meta.badgeClass} ${className}`}
    >
      <span className="text-sm leading-none" aria-hidden>
        {HEAT_STATUS_ICON[status]}
      </span>
      {t(meta.en, meta.hi)}
    </span>
  )
}

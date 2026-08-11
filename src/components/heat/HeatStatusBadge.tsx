import { HEAT_STATUS_META } from '../../lib/heatStatusMeta'
import type { HeatStatus } from '../../types/heat'
import { useLanguage } from '../../context/LanguageContext'

interface HeatStatusBadgeProps {
  status: HeatStatus
  className?: string
}

export function HeatStatusBadge({ status, className = '' }: HeatStatusBadgeProps) {
  const { t } = useLanguage()
  const meta = HEAT_STATUS_META[status]

  const isClosed = status === 'Closed'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${meta.badgeClass} ${className}`}
    >
      {isClosed ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.5">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
      )}
      {t(meta.en, meta.hi)}
    </span>
  )
}

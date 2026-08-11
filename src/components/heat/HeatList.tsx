import type { Heat } from '../../types/heat'
import { isPendingSyncHeatNo } from '../../lib/heatNumber'
import { useLanguage } from '../../context/LanguageContext'
import { HeatStatusBadge } from './HeatStatusBadge'

interface HeatListProps {
  heats: Heat[]
  selectedId: string | null
  onSelect: (heat: Heat) => void
}

export function HeatList({ heats, selectedId, onSelect }: HeatListProps) {
  const { t } = useLanguage()

  if (heats.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-600 p-6 text-center text-slate-400">
        <p>{t('No heats yet', 'अभी कोई हीट नहीं')}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {heats.map((heat) => {
        const selected = selectedId === heat.id
        return (
          <li key={heat.id}>
            <button
              type="button"
              onClick={() => onSelect(heat)}
              className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                selected
                  ? 'border-emerald-500 bg-emerald-950/40'
                  : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-100">{heat.heat_no}</p>
                  <p className="text-sm text-slate-400">
                    {heat.furnace_code} · {heat.grade_code}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-right text-sm">
                  <HeatStatusBadge status={heat.status} />
                  {isPendingSyncHeatNo(heat.heat_no) && (
                    <span className="inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                      {t('Pending sync', 'सिंक बाकी')}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

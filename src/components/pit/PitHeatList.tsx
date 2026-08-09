import { isCompositionComplete, type PitHeat } from '../../types/pitFurnace'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface PitHeatListProps {
  heats: PitHeat[]
  selectedId: string | null
  onSelect: (heat: PitHeat) => void
  showQualityStatus?: boolean
}

export function PitHeatList({ heats, selectedId, onSelect, showQualityStatus = false }: PitHeatListProps) {
  const { t } = useLanguage()

  if (heats.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-600 p-6 text-center text-slate-400">
        <p>{t('No pit heats yet', 'अभी कोई पिट हीट नहीं')}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {heats.map((heat) => {
        const qualityDone = isCompositionComplete(heat.composition)
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
                  <p className="text-sm text-slate-400">{heat.date}</p>
                </div>
                <div className="text-right text-sm text-slate-300">
                  <p>{heat.ingot_kg} kg ingot</p>
                  {heat._pending && (
                    <span className="mt-1 inline-block rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                      Local
                    </span>
                  )}
                </div>
              </div>
              {showQualityStatus && (
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
                      qualityDone ? 'bg-emerald-500 text-slate-950' : 'bg-slate-600 text-slate-200'
                    }`}
                  >
                    {qualityDone ? '✓' : '·'}
                  </span>
                  <BilingualText
                    en={qualityDone ? 'Quality recorded' : 'Quality pending'}
                    hi={qualityDone ? 'गुणवत्ता दर्ज' : 'गुणवत्ता बाकी'}
                    className="text-sm text-slate-300"
                  />
                </div>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

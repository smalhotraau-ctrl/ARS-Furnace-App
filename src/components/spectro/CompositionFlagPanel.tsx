import type { SpectroCompositionEntry } from '../../types/spectro'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface CompositionFlagPanelProps {
  composition: SpectroCompositionEntry[]
}

export function CompositionFlagPanel({ composition }: CompositionFlagPanelProps) {
  const { t } = useLanguage()

  if (composition.length === 0) return null

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText
        as="h3"
        en="Composition vs Spec"
        hi="संरचना बनाम मानक"
        className="text-lg font-bold text-slate-100"
      />
      <p className="mt-1 text-sm text-slate-400">
        {t('Advisory only — does not block saving', 'केवल सलाह — सहेजने से नहीं रोकता')}
      </p>
      <ul className="mt-4 space-y-3">
        {composition.map((entry) => {
          const inSpec = entry.flag === 'in_spec'
          return (
            <li
              key={entry.element}
              className={`flex items-center justify-between rounded-xl px-4 py-3 ${
                inSpec ? 'bg-emerald-950/50 border border-emerald-500/30' : 'bg-red-950/50 border border-red-500/40'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold ${
                    inSpec ? 'bg-emerald-500 text-slate-950' : 'bg-red-500 text-white'
                  }`}
                >
                  {inSpec ? '✓' : '✕'}
                </span>
                <div>
                  <p className="font-semibold text-slate-100">{entry.element}</p>
                  <p className="text-sm text-slate-400">
                    {entry.spec_min}–{entry.spec_max}%
                  </p>
                </div>
              </div>
              <p className="text-xl font-bold text-slate-100">{entry.actual_pct.toFixed(3)}%</p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

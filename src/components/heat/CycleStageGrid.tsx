import type { CycleLogEntry, CycleStage } from '../../types/heat'
import { CYCLE_STAGES } from '../../types/heat'
import { CYCLE_STAGE_META } from '../../lib/heatLabels'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface CycleStageGridProps {
  entries: CycleLogEntry[]
  disabled?: boolean
  onStart: (stage: CycleStage) => Promise<void>
  onFinish: (entry: CycleLogEntry) => Promise<void>
}

export function CycleStageGrid({ entries, disabled = false, onStart, onFinish }: CycleStageGridProps) {
  const { t } = useLanguage()

  return (
    <section className="space-y-4">
      <BilingualText
        as="h2"
        en="Cycle Log"
        hi="साइकिल लॉग"
        className="text-xl font-bold text-slate-100"
      />
      <p className="text-sm text-slate-400">
        {t(
          'Tap to record time automatically · No edits ever',
          'समय स्वचालित दर्ज · कभी संपादित नहीं',
        )}
      </p>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
        {CYCLE_STAGES.map((stage) => {
          const meta = CYCLE_STAGE_META[stage]
          const openEntry = entries.find((e) => e.stage === stage && !e.finish_ts)
          const completed = entries.filter((e) => e.stage === stage && e.finish_ts)
          const latest = completed[completed.length - 1]

          return (
            <div
              key={stage}
              className="flex flex-col items-center rounded-2xl border border-slate-700 bg-slate-800/60 p-3 text-center"
            >
              <span className="text-3xl" aria-hidden>{meta.icon}</span>
              <p className="mt-2 text-sm font-bold text-slate-100">{t(meta.en, meta.hi)}</p>

              {openEntry ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void onFinish(openEntry)}
                  className="mt-3 min-h-11 w-full rounded-xl bg-amber-500 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  {t('Finish', 'समाप्त')}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void onStart(stage)}
                  className="mt-3 min-h-11 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  {t('Start', 'शुरू')}
                </button>
              )}

              {latest && (
                <p className="mt-2 text-[10px] text-slate-500">
                  {new Date(latest.start_ts).toLocaleTimeString()} – {latest.finish_ts ? new Date(latest.finish_ts).toLocaleTimeString() : '…'}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

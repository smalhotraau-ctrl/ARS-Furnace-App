import { useEffect, useState } from 'react'
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

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function CycleStageGrid({ entries, disabled = false, onStart, onFinish }: CycleStageGridProps) {
  const { t } = useLanguage()
  const [now, setNow] = useState(() => Date.now())

  const hasOpenEntry = entries.some((e) => !e.finish_ts)

  // Only tick while something is actually running, so idle stages don't
  // force a re-render every second.
  useEffect(() => {
    if (!hasOpenEntry) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [hasOpenEntry])

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
          const stageEntries = entries.filter((e) => e.stage === stage)
          // The most recent occurrence of this stage decides what the card
          // shows. Once it has a finish_ts, the card locks permanently —
          // no button is ever rendered again for this stage.
          const latest = stageEntries[stageEntries.length - 1]
          const isRunning = Boolean(latest && !latest.finish_ts)
          const isDone = Boolean(latest?.finish_ts)

          return (
            <div
              key={stage}
              className={`flex flex-col items-center rounded-2xl border p-3 text-center ${
                isDone
                  ? 'border-emerald-500/40 bg-emerald-950/30'
                  : isRunning
                    ? 'border-amber-500/50 bg-amber-950/20'
                    : 'border-slate-700 bg-slate-800/60'
              }`}
            >
              <span className="text-3xl" aria-hidden>{meta.icon}</span>
              <p className="mt-2 text-sm font-bold text-slate-100">{t(meta.en, meta.hi)}</p>

              {isDone && latest ? (
                <div className="mt-3 w-full space-y-1">
                  <span
                    className="save-toast-check mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-on-accent"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <p className="text-xs font-semibold text-emerald-300">
                    {formatDuration(new Date(latest.finish_ts!).getTime() - new Date(latest.start_ts).getTime())}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(latest.start_ts).toLocaleTimeString()} – {new Date(latest.finish_ts!).toLocaleTimeString()}
                  </p>
                </div>
              ) : isRunning && latest ? (
                <>
                  <p className="mt-2 text-xs font-semibold text-amber-300" aria-live="polite">
                    {t('Running', 'चल रहा')}: {formatDuration(now - new Date(latest.start_ts).getTime())}
                  </p>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void onFinish(latest)}
                    className="mt-3 min-h-11 w-full rounded-xl bg-amber-500 text-sm font-semibold text-on-accent disabled:opacity-50"
                  >
                    {t('Finish', 'समाप्त')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => void onStart(stage)}
                  className="mt-3 min-h-11 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-on-accent disabled:opacity-50"
                >
                  {t('Start', 'शुरू')}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

import { useEffect, useMemo, useState } from 'react'
import type { CycleLogEntry, CycleStage } from '../../types/heat'
import { CYCLE_STAGES } from '../../types/heat'
import { CYCLE_STAGE_META } from '../../lib/heatLabels'
import { formatTargetMinutes, stageElapsedExceedsTarget } from '../../lib/cycleTimeService'
import type { CycleStageTimeStandardRow } from '../../types/cycleTime'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface CycleStageGridProps {
  entries: CycleLogEntry[]
  stageTimeStandards?: CycleStageTimeStandardRow[]
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

function formatTimeRange(startTs: string, finishTs: string | null): string {
  const start = new Date(startTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (!finishTs) return `${start} – …`
  const finish = new Date(finishTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${start} – ${finish}`
}

function pickStageEntry(stageEntries: CycleLogEntry[]): CycleLogEntry | undefined {
  if (stageEntries.length === 0) return undefined

  const finished = stageEntries.filter((e) => e.finish_ts)
  const open = stageEntries.filter((e) => !e.finish_ts)
  const activeOpen = open.filter(
    (o) => !finished.some((f) => entriesLinked(f, o)),
  )

  if (activeOpen.length > 0) return activeOpen[activeOpen.length - 1]
  if (finished.length > 0) return finished[finished.length - 1]
  return stageEntries[stageEntries.length - 1]
}

function entriesLinked(a: CycleLogEntry, b: CycleLogEntry): boolean {
  return (
    a.id === b.id ||
    a._localId === b.id ||
    b._localId === a.id ||
    (a._localId != null && a._localId === b._localId)
  )
}

function StageStatusBadge({ isDone, isRunning }: { isDone: boolean; isRunning: boolean }) {
  if (isDone) {
    return (
      <span
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold leading-none text-on-accent"
        aria-hidden
      >
        ✓
      </span>
    )
  }
  if (isRunning) {
    return (
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400"
        aria-hidden
      />
    )
  }
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-teal-500/60 bg-teal-900/40"
      aria-hidden
    />
  )
}

export function CycleStageGrid({
  entries,
  stageTimeStandards = [],
  disabled = false,
  onStart,
  onFinish,
}: CycleStageGridProps) {
  const { t } = useLanguage()
  const [now, setNow] = useState(() => Date.now())

  const targetByStage = useMemo(
    () => new Map(stageTimeStandards.map((row) => [row.stage, row.target_minutes])),
    [stageTimeStandards],
  )

  const hasOpenEntry = CYCLE_STAGES.some((stage) => {
    const latest = pickStageEntry(entries.filter((e) => e.stage === stage))
    return Boolean(latest && !latest.finish_ts)
  })

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
          const latest = pickStageEntry(stageEntries)
          const isRunning = Boolean(latest && !latest.finish_ts)
          const isDone = Boolean(latest?.finish_ts)
          const recordedDurationMs =
            isDone && latest?.finish_ts
              ? new Date(latest.finish_ts).getTime() - new Date(latest.start_ts).getTime()
              : null
          const targetMinutes = targetByStage.get(stage) ?? null
          const overTarget =
            isRunning && latest
              ? stageElapsedExceedsTarget(latest.start_ts, now, targetMinutes)
              : false

          const cardTone = isDone
            ? 'border-emerald-500/40 bg-emerald-950/30'
            : isRunning
              ? overTarget
                ? 'border-red-500/50 bg-red-950/25'
                : 'border-amber-500/50 bg-amber-950/20'
              : 'border-teal-600/40 bg-teal-950/20'

          return (
            <div
              key={stage}
              className={`flex flex-col rounded-2xl border p-3 ${cardTone}`}
            >
              <div className="flex w-full items-center gap-2">
                <span className="text-xl leading-none" aria-hidden>{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-bold text-slate-100">{t(meta.en, meta.hi)}</p>
                    <StageStatusBadge isDone={isDone} isRunning={isRunning} />
                  </div>
                </div>
              </div>

              {isDone && latest && recordedDurationMs != null ? (
                <div className="mt-3 w-full">
                  <p className="text-2xl font-bold tabular-nums leading-tight text-emerald-200">
                    {formatDuration(recordedDurationMs)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-300">
                    {formatTimeRange(latest.start_ts, latest.finish_ts)}
                  </p>
                </div>
              ) : isRunning && latest ? (
                <div className="mt-3 w-full">
                  <p
                    className={`text-2xl font-bold tabular-nums leading-tight ${
                      overTarget ? 'text-red-300' : 'text-amber-200'
                    }`}
                    aria-live="polite"
                  >
                    {formatDuration(now - new Date(latest.start_ts).getTime())}
                  </p>
                  <p className={`mt-1 text-sm font-medium ${overTarget ? 'text-red-200/90' : 'text-slate-300'}`}>
                    {t('Running', 'चल रहा')}: {formatTimeRange(latest.start_ts, null)}
                    {targetMinutes != null && (
                      <>
                        {' · '}
                        {t('Target', 'लक्ष्य')}: {formatTargetMinutes(targetMinutes)}
                      </>
                    )}
                  </p>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => void onFinish(latest)}
                    className="mt-3 min-h-11 w-full rounded-xl bg-amber-500 text-sm font-semibold text-on-accent disabled:opacity-50"
                  >
                    {t('Finish', 'समाप्त')}
                  </button>
                </div>
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

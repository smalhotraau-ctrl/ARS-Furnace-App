import { useState } from 'react'
import type { CycleStageTimeFlag } from '../../types/cycleTime'
import type { Heat } from '../../types/heat'
import { CYCLE_STAGE_META } from '../../lib/heatLabels'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface CycleTimeExceptionsPanelProps {
  flags: CycleStageTimeFlag[]
  heats: Heat[]
  onAcknowledge: (flag: CycleStageTimeFlag, note: string | null) => Promise<void>
}

export function CycleTimeExceptionsPanel({ flags, heats, onAcknowledge }: CycleTimeExceptionsPanelProps) {
  const { t } = useLanguage()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  function heatNoFor(heatId: string): string {
    return heats.find((h) => h.id === heatId)?.heat_no ?? heatId
  }

  async function handleAcknowledge(flag: CycleStageTimeFlag) {
    setBusyId(flag.id)
    try {
      await onAcknowledge(flag, notes[flag.id]?.trim() || null)
    } finally {
      setBusyId(null)
    }
  }

  if (flags.length === 0) return null

  return (
    <section className="space-y-3 rounded-2xl border-2 border-rose-500 bg-rose-950/30 p-5">
      <div className="flex items-center justify-between gap-3">
        <BilingualText
          as="h2"
          en="Cycle Time Exceptions"
          hi="साइकिल समय अपवाद"
          className="text-lg font-bold text-rose-200"
        />
        <span className="inline-flex items-center rounded-full bg-rose-500 px-3 py-1 text-sm font-extrabold text-on-accent">
          {flags.length} {t('open', 'खुला')}
        </span>
      </div>

      <ul className="space-y-3">
        {flags.map((flag) => {
          const meta = CYCLE_STAGE_META[flag.stage]
          return (
            <li key={flag.id} className="rounded-xl border border-rose-500/50 bg-rose-950/50 p-4">
              <div>
                <p className="font-bold text-rose-100">{heatNoFor(flag.heat_id)}</p>
                <p className="text-sm text-rose-200">
                  {t(meta.en, meta.hi)}: {flag.actual_minutes.toFixed(1)} {t('min', 'मिन')} ({t('target', 'लक्ष्य')}{' '}
                  {flag.target_minutes} {t('min', 'मिन')})
                </p>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={notes[flag.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [flag.id]: e.target.value }))}
                  placeholder={t('Note (optional)', 'टिप्पणी (वैकल्पिक)')}
                  className="min-h-11 flex-1 rounded-lg border border-rose-500/40 bg-slate-900 px-3 text-sm text-slate-100"
                />
                <button
                  type="button"
                  disabled={busyId === flag.id}
                  onClick={() => void handleAcknowledge(flag)}
                  className="min-h-11 rounded-lg bg-rose-500 px-4 text-sm font-semibold text-on-accent disabled:opacity-50"
                >
                  {t('Acknowledge', 'स्वीकार करें')}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

import { useState } from 'react'
import type { TempReading } from '../../types/heat'
import { TEMP_CHECKPOINT_META } from '../../lib/heatLabels'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface TempReadingsListProps {
  readings: TempReading[]
}

export function TempReadingsList({ readings }: TempReadingsListProps) {
  const { t } = useLanguage()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  if (readings.length === 0) return null

  const byCheckpoint = new Map<string, TempReading[]>()
  for (const r of readings) {
    const list = byCheckpoint.get(r.checkpoint) ?? []
    list.push(r)
    byCheckpoint.set(r.checkpoint, list)
  }
  // Most recent first within each checkpoint's own group.
  for (const list of byCheckpoint.values()) {
    list.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText as="h3" en="Recorded Temperatures" hi="दर्ज तापमान" className="mb-3 font-bold" />
      <ul className="space-y-3 text-sm">
        {[...byCheckpoint.entries()].map(([checkpoint, list]) => {
          const [latest, ...history] = list
          const meta = TEMP_CHECKPOINT_META[checkpoint]
          const isExpanded = expanded[checkpoint] ?? false

          return (
            <li key={checkpoint} className="rounded-lg bg-slate-900/50 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{meta ? t(meta.en, meta.hi) : checkpoint}</span>
                <span className="font-semibold text-slate-100">{latest.value}°</span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">{new Date(latest.recorded_at).toLocaleString()}</p>

              {history.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [checkpoint]: !isExpanded }))}
                    className="mt-2 text-xs font-semibold text-emerald-400 hover:underline"
                  >
                    {isExpanded
                      ? t('Hide history', 'इतिहास छुपाएँ')
                      : t(`View history (${history.length})`, `इतिहास देखें (${history.length})`)}
                  </button>

                  {isExpanded && (
                    <ul className="mt-2 space-y-1.5 border-t border-slate-700 pt-2">
                      {history.map((r) => (
                        <li key={r.id} className="flex justify-between text-xs text-slate-400">
                          <span>{new Date(r.recorded_at).toLocaleString()}</span>
                          <span>{r.value}°</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

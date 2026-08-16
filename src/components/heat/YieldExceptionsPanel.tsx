import { useState } from 'react'
import type { Heat } from '../../types/heat'
import type { HeatOutputFlag } from '../../types/output'
import { YIELD_METRIC_LABELS } from '../../types/output'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface YieldExceptionsPanelProps {
  flags: HeatOutputFlag[]
  heats: Heat[]
  onAcknowledge: (flag: HeatOutputFlag, note: string | null) => Promise<void>
  variant?: 'default' | 'hero'
}

// Visible exclusively to Plant Head / Owner — Supervisor and QA never see this panel, per
// 03f §4 / 03b. Global across every heat, not scoped to the currently selected one, so an
// open/unacknowledged count is impossible to miss.
export function YieldExceptionsPanel({ flags, heats, onAcknowledge, variant = 'default' }: YieldExceptionsPanelProps) {
  const { t } = useLanguage()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  function heatNoFor(heatId: string): string {
    return heats.find((h) => h.id === heatId)?.heat_no ?? heatId
  }

  async function handleAcknowledge(flag: HeatOutputFlag) {
    setBusyId(flag.id)
    try {
      await onAcknowledge(flag, notes[flag.id]?.trim() || null)
    } finally {
      setBusyId(null)
    }
  }

  const hero = variant === 'hero'

  return (
    <section
      className={`space-y-3 ${
        hero
          ? 'rounded-3xl border-4 border-amber-400 bg-gradient-to-br from-amber-950/90 to-orange-950/70 p-6 shadow-2xl shadow-amber-500/30'
          : 'rounded-2xl border-2 border-amber-500 bg-amber-950/30 p-5'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <BilingualText
          as="h2"
          en="Yield Exceptions"
          hi="यील्ड अपवाद"
          className={hero ? 'text-2xl font-extrabold text-amber-100 sm:text-3xl' : 'text-lg font-bold text-amber-200'}
        />
        <span
          className={`inline-flex items-center rounded-full bg-amber-500 font-extrabold text-on-accent ${
            hero ? 'px-4 py-2 text-lg' : 'px-3 py-1 text-sm'
          } ${flags.length > 0 && hero ? 'animate-pulse' : ''}`}
        >
          {flags.length} {t('open', 'खुला')}
        </span>
      </div>

      {flags.length === 0 ? (
        <p className="text-sm text-amber-200/70">{t('No open exceptions.', 'कोई खुला अपवाद नहीं।')}</p>
      ) : (
        <ul className="space-y-3">
          {flags.map((flag) => (
            <li key={flag.id} className="rounded-xl border border-amber-500/50 bg-amber-950/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-amber-100">{heatNoFor(flag.heat_id)}</p>
                  <p className="text-sm text-amber-200">
                    {t(YIELD_METRIC_LABELS[flag.metric].en, YIELD_METRIC_LABELS[flag.metric].hi)}: {flag.actual_pct.toFixed(1)}%
                  </p>
                  <p className="text-xs text-amber-300">
                    {t('Expected', 'अनुमानित')} {flag.expected_min_pct.toFixed(1)}–{flag.expected_max_pct.toFixed(1)}%
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={notes[flag.id] ?? ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [flag.id]: e.target.value }))}
                  placeholder={t('Note (optional)', 'टिप्पणी (वैकल्पिक)')}
                  className="min-h-11 flex-1 rounded-lg border border-amber-500/40 bg-slate-900 px-3 text-sm text-slate-100"
                />
                <button
                  type="button"
                  disabled={busyId === flag.id}
                  onClick={() => void handleAcknowledge(flag)}
                  className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-on-accent disabled:opacity-50"
                >
                  {t('Acknowledge', 'स्वीकार करें')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

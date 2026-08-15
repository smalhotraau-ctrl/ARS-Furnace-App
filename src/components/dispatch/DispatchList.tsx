import { useState } from 'react'
import type { Dispatch, DispatchLine } from '../../types/dispatch'
import { useLanguage } from '../../context/LanguageContext'
import { NumericField, parseNumericField } from '../ui/NumericField'

interface DispatchListProps {
  dispatches: Dispatch[]
  linesByDispatchId: Map<string, DispatchLine[]>
  heatNoById: Map<string, string>
  canEditShortage: boolean
  onUpdateShortage: (dispatch: Dispatch, shortageKg: number | null, reportedDate: string | null) => Promise<void>
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 1 })
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function DispatchList({ dispatches, linesByDispatchId, heatNoById, canEditShortage, onUpdateShortage }: DispatchListProps) {
  const { t } = useLanguage()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (dispatches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-600 p-6 text-center text-slate-400">
        <p>{t('No dispatches recorded yet', 'अभी कोई डिस्पैच दर्ज नहीं हुआ')}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {dispatches.map((dispatch) => {
        const lines = linesByDispatchId.get(dispatch.id) ?? []
        const expanded = expandedId === dispatch.id
        return (
          <li key={dispatch.id} className="rounded-2xl border border-emerald-600/30 bg-emerald-950/10 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : dispatch.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-100">
                    {dispatch.party_name} · {dispatch.invoice_no}
                  </p>
                  <p className="text-sm text-slate-400">
                    {dispatch.dispatch_date} · {fmt(dispatch.kg_dispatched)} kg · {lines.length}{' '}
                    {lines.length === 1 ? t('heat', 'हीट') : t('heats', 'हीट्स')}
                  </p>
                </div>
              </div>
              {dispatch._pending && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                  {t('Pending sync', 'सिंक बाकी')}
                </span>
              )}
            </button>

            {expanded && (
              <div className="space-y-4 border-t border-emerald-600/20 bg-slate-900/40 px-4 py-4">
                <div className="space-y-2">
                  {lines.map((line) => (
                    <div key={line.id} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
                      <span className="font-semibold text-slate-100">{heatNoById.get(line.heat_id) ?? line.heat_id}</span>
                      <span className="text-slate-300">{fmt(line.kg_dispatched)} kg</span>
                    </div>
                  ))}
                </div>

                <ShortageEditor
                  dispatch={dispatch}
                  editable={canEditShortage}
                  onSave={(shortageKg, reportedDate) => onUpdateShortage(dispatch, shortageKg, reportedDate)}
                />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ShortageEditor({
  dispatch,
  editable,
  onSave,
}: {
  dispatch: Dispatch
  editable: boolean
  onSave: (shortageKg: number | null, reportedDate: string | null) => Promise<void>
}) {
  const { t } = useLanguage()
  const [editing, setEditing] = useState(false)
  const [shortageKg, setShortageKg] = useState(dispatch.shortage_kg != null ? String(dispatch.shortage_kg) : '')
  const [saving, setSaving] = useState(false)

  if (!editable) {
    return dispatch.shortage_kg != null ? (
      <p className="text-sm text-amber-300">
        {t('Shortage', 'कमी')}: {fmt(dispatch.shortage_kg)} kg
        {dispatch.shortage_reported_date ? ` (${dispatch.shortage_reported_date})` : ''}
      </p>
    ) : (
      <p className="text-sm text-slate-500">{t('No shortage reported', 'कोई कमी दर्ज नहीं')}</p>
    )
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        {dispatch.shortage_kg != null ? (
          <p className="text-sm text-amber-300">
            {t('Shortage', 'कमी')}: {fmt(dispatch.shortage_kg)} kg
            {dispatch.shortage_reported_date ? ` (${dispatch.shortage_reported_date})` : ''}
          </p>
        ) : (
          <p className="text-sm text-slate-500">{t('No shortage reported', 'कोई कमी दर्ज नहीं')}</p>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200"
        >
          {t('Edit shortage', 'कमी संपादित करें')}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/60 p-3">
      <NumericField id={`shortage-${dispatch.id}`} labelEn="Shortage kg" labelHi="कमी किग्रा" value={shortageKg} onChange={setShortageKg} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="min-h-11 flex-1 rounded-lg border border-slate-600 text-sm font-semibold text-slate-200"
        >
          {t('Cancel', 'रद्द')}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            try {
              const parsed = parseNumericField(shortageKg)
              await onSave(parsed, parsed != null ? todayIsoDate() : null)
              setEditing(false)
            } finally {
              setSaving(false)
            }
          }}
          className="min-h-11 flex-1 rounded-lg bg-emerald-500 text-sm font-semibold text-on-accent disabled:opacity-50"
        >
          {t('Save', 'सहेजें')}
        </button>
      </div>
    </div>
  )
}

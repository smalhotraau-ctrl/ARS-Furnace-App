import type { Dispatch, DispatchLine } from '../../types/dispatch'
import { useLanguage } from '../../context/LanguageContext'

interface DispatchRecordedBannerProps {
  dispatch: Dispatch
  lines: DispatchLine[]
  heatNoById: Map<string, string>
  onDismiss: () => void
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 1 })
}

// Same unmistakable, satisfying completion treatment as HeatClosedBanner — big green card,
// checkmark, invoice details, and the per-heat breakdown that just shipped.
export function DispatchRecordedBanner({ dispatch, lines, heatNoById, onDismiss }: DispatchRecordedBannerProps) {
  const { t } = useLanguage()

  return (
    <section className="rounded-2xl border-2 border-emerald-500 bg-emerald-950/60 p-6 shadow-lg shadow-emerald-950/50">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-on-accent">
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="3.5">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-emerald-200">{t('Dispatch Recorded', 'डिस्पैच दर्ज हुआ')}</p>
            <p className="text-lg font-semibold text-emerald-100">
              {dispatch.party_name} · {dispatch.invoice_no}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg px-2 py-1 text-sm text-emerald-300 hover:bg-emerald-900/60"
        >
          {t('Close', 'बंद करें')}
        </button>
      </div>

      <div className="mt-5 rounded-xl bg-emerald-900/50 p-3">
        <p className="text-xs text-emerald-300">{t('Total dispatched', 'कुल डिस्पैच')}</p>
        <p className="text-2xl font-bold text-emerald-50">{fmt(dispatch.kg_dispatched)} kg</p>
      </div>

      <div className="mt-4 space-y-2">
        {lines.map((line) => (
          <div key={line.id} className="flex items-center justify-between rounded-lg bg-emerald-900/30 px-3 py-2 text-sm">
            <span className="font-semibold text-emerald-100">{heatNoById.get(line.heat_id) ?? line.heat_id}</span>
            <span className="text-emerald-200">{fmt(line.kg_dispatched)} kg</span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-emerald-300">
        {new Date(dispatch.created_at).toLocaleString('en-IN')}
      </p>
    </section>
  )
}

import type { Bundle } from '../../types/dispatch'
import { useLanguage } from '../../context/LanguageContext'

interface BundleListProps {
  bundles: Bundle[]
}

// Each saved bundle reads as a small completed record — a check icon, same visual language
// as the rest of the app's "done" states, even though bundling itself has no status field.
export function BundleList({ bundles }: BundleListProps) {
  const { t } = useLanguage()

  if (bundles.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-600 p-6 text-center text-slate-400">
        <p>{t('No bundles packed yet', 'अभी कोई बंडल पैक नहीं हुआ')}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {bundles.map((bundle) => (
        <li
          key={bundle.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-600/30 bg-emerald-950/20 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-100">{bundle.bundle_no}</p>
              <p className="text-sm text-slate-400">
                {bundle.pieces} {t('pieces', 'टुकड़े')} · {bundle.weight_kg.toFixed(2)} kg
              </p>
            </div>
          </div>
          <p className="whitespace-nowrap text-right text-xs text-slate-500">
            {new Date(bundle.packed_at).toLocaleString('en-IN')}
            {bundle._pending && (
              <span className="mt-1 block rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-300">
                {t('Pending sync', 'सिंक बाकी')}
              </span>
            )}
          </p>
        </li>
      ))}
    </ul>
  )
}

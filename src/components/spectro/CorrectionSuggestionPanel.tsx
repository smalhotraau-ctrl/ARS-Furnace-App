import type { CorrectionSuggestion } from '../../types/spectro'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface CorrectionSuggestionPanelProps {
  suggestions: CorrectionSuggestion[] | null
  meltKg: number
  onRequest: () => void
  loading?: boolean
  disabled?: boolean
  contextNote?: string
  compositionOutOfSpec?: boolean
}

export function CorrectionSuggestionPanel({
  suggestions,
  meltKg,
  onRequest,
  loading = false,
  disabled = false,
  contextNote,
  compositionOutOfSpec = false,
}: CorrectionSuggestionPanelProps) {
  const { t } = useLanguage()

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5 space-y-4">
      <BilingualText
        as="h3"
        en="Correction Suggestion"
        hi="सुधार सुझाव"
        className="text-lg font-bold text-slate-100"
      />
      <p className="text-sm text-slate-400">
        {t(
          'Estimate based on total charged net kg — not a precise melt weight',
          'कुल चार्ज नेट किग्रा पर आधारित अनुमान — सटीक पिघला वजन नहीं',
        )}
      </p>
      {contextNote && <p className="text-sm text-slate-500">{contextNote}</p>}
      <p className="text-sm text-slate-500">
        {t('Melt estimate', 'पिघला अनुमान')}: {meltKg.toFixed(1)} kg
      </p>

      <button
        type="button"
        disabled={disabled || loading || meltKg <= 0}
        onClick={onRequest}
        className="min-h-12 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-base font-semibold text-emerald-300 disabled:opacity-50"
      >
        {t('Compute suggestion', 'सुझाव गणना करें')}
      </button>

      {suggestions && suggestions.length > 0 && (
        <ul className="space-y-2">
          {suggestions.map((s, i) => (
            <li key={i} className="rounded-xl border border-slate-600 bg-slate-900/50 px-4 py-3 text-sm">
              <span className="font-semibold text-slate-100">{s.material_code}</span>
              <span className="ml-2 text-emerald-400">{s.suggested_kg} kg</span>
            </li>
          ))}
        </ul>
      )}

      {suggestions && suggestions.length === 0 && (
        <p className={`text-sm ${compositionOutOfSpec ? 'text-amber-300' : 'text-emerald-400'}`}>
          {compositionOutOfSpec
            ? meltKg <= 0
              ? t(
                  'Out-of-spec elements found but no charged weight — add charge lines first',
                  'मानक से बाहर तत्व हैं पर चार्ज वजन नहीं — पहले चार्ज पंक्तियाँ जोड़ें',
                )
              : t(
                  'Out-of-spec elements found but no correction material available — check standard composition in Master Admin',
                  'मानक से बाहर तत्व हैं पर कोई सुधार सामग्री नहीं — Master Admin में मानक संरचना जाँचें',
                )
            : t('All elements within spec', 'सभी तत्व मानक के अंदर')}
        </p>
      )}
    </section>
  )
}

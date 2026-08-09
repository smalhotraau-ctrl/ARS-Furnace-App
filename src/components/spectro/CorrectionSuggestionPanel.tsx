import type { CorrectionSuggestion } from '../../types/spectro'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface CorrectionSuggestionPanelProps {
  suggestions: CorrectionSuggestion[] | null
  meltKg: number
  onRequest: () => void
  loading?: boolean
  disabled?: boolean
}

export function CorrectionSuggestionPanel({
  suggestions,
  meltKg,
  onRequest,
  loading = false,
  disabled = false,
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
        <p className="text-sm text-emerald-400">{t('All elements within spec', 'सभी तत्व मानक के अंदर')}</p>
      )}
    </section>
  )
}

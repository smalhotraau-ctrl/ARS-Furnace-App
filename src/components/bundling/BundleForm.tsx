import { useState } from 'react'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'
import { NumericField, parseNumericField } from '../ui/NumericField'

interface BundleFormProps {
  disabled?: boolean
  onSubmit: (values: { bundle_no: string; pieces: number; weight_kg: number }) => Promise<void>
}

// Supervisor-only entry. Reference/traceability record — pieces is a data field, not a
// stock-driving quantity (03g §1).
export function BundleForm({ disabled = false, onSubmit }: BundleFormProps) {
  const { t } = useLanguage()
  const [bundleNo, setBundleNo] = useState('')
  const [pieces, setPieces] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const parsedPieces = parseNumericField(pieces)
  const parsedWeight = parseNumericField(weightKg)
  const valid = bundleNo.trim().length > 0 && parsedPieces != null && parsedPieces > 0 && parsedWeight != null && parsedWeight > 0

  async function handleSave() {
    if (!valid || parsedPieces == null || parsedWeight == null) return
    setSubmitting(true)
    try {
      await onSubmit({ bundle_no: bundleNo.trim(), pieces: Math.round(parsedPieces), weight_kg: parsedWeight })
      setBundleNo('')
      setPieces('')
      setWeightKg('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText as="h3" en="Add Bundle" hi="बंडल जोड़ें" className="text-lg font-bold text-slate-100" />

      <label className="block space-y-2">
        <BilingualText as="span" en="Bundle No *" hi="बंडल नंबर" className="font-semibold text-slate-100" />
        <input
          value={bundleNo}
          disabled={disabled}
          onChange={(e) => setBundleNo(e.target.value)}
          className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg text-slate-100 disabled:opacity-60"
        />
      </label>

      <NumericField id="pieces" labelEn="Pieces" labelHi="टुकड़े" value={pieces} onChange={setPieces} disabled={disabled} required />
      <NumericField id="weight_kg" labelEn="Weight kg" labelHi="वज़न किग्रा" value={weightKg} onChange={setWeightKg} disabled={disabled} required />

      <p className="text-xs text-slate-500">
        {t(
          'Pieces is a reference count only — it does not drive finished-goods stock.',
          'टुकड़े केवल संदर्भ के लिए हैं — यह तैयार माल स्टॉक को प्रभावित नहीं करता।',
        )}
      </p>

      <button
        type="button"
        disabled={disabled || submitting || !valid}
        onClick={() => void handleSave()}
        className="min-h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-on-accent disabled:opacity-50"
      >
        {t('Save Bundle', 'बंडल सहेजें')}
      </button>
    </section>
  )
}

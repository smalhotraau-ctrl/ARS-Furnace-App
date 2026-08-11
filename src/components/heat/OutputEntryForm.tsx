import { useMemo, useState } from 'react'
import { computeRecoveryBreakdown } from '../../lib/outputCalc'
import { BilingualText } from '../ui/BilingualText'
import { NumericField, parseNumericField } from '../ui/NumericField'
import { useLanguage } from '../../context/LanguageContext'

interface OutputEntryFormProps {
  chargedNetKg: number
  onSubmit: (values: {
    ingot_kg: number
    dross_kg: number
    rejection_kg: number
    exceptional_label: string | null
    exceptional_kg: number | null
  }) => Promise<void>
}

// Supervisor's output entry — numeric only, burn loss always derived, never entered (03f §1).
export function OutputEntryForm({ chargedNetKg, onSubmit }: OutputEntryFormProps) {
  const { t } = useLanguage()
  const [ingotKg, setIngotKg] = useState('')
  const [drossKg, setDrossKg] = useState('')
  const [rejectionKg, setRejectionKg] = useState('')
  const [exceptionalLabel, setExceptionalLabel] = useState('')
  const [exceptionalKg, setExceptionalKg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const parsed = useMemo(() => {
    const ingot = parseNumericField(ingotKg)
    const dross = parseNumericField(drossKg)
    const rejection = parseNumericField(rejectionKg)
    const exceptional = parseNumericField(exceptionalKg) ?? 0
    if (ingot == null || dross == null || rejection == null) return null
    return { ingot, dross, rejection, exceptional }
  }, [ingotKg, drossKg, rejectionKg, exceptionalKg])

  const recovery = useMemo(() => {
    if (!parsed || chargedNetKg <= 0) return null
    return computeRecoveryBreakdown(chargedNetKg, parsed.ingot, parsed.dross, parsed.rejection, parsed.exceptional)
  }, [parsed, chargedNetKg])

  const canSubmit = Boolean(parsed) && chargedNetKg > 0 && !submitting

  async function handleSave() {
    if (!parsed) return
    setSubmitting(true)
    try {
      await onSubmit({
        ingot_kg: parsed.ingot,
        dross_kg: parsed.dross,
        rejection_kg: parsed.rejection,
        exceptional_label: exceptionalLabel.trim() || null,
        exceptional_kg: exceptionalLabel.trim() ? parsed.exceptional : null,
      })
      setIngotKg('')
      setDrossKg('')
      setRejectionKg('')
      setExceptionalLabel('')
      setExceptionalKg('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText as="h3" en="Enter Output" hi="आउटपुट दर्ज करें" className="text-lg font-bold" />

      <div className="rounded-xl bg-slate-900/60 px-4 py-3">
        <p className="text-sm text-slate-400">{t('Charged net kg', 'चार्ज नेट किग्रा')}</p>
        <p className="text-2xl font-bold text-slate-100">{chargedNetKg.toFixed(2)}</p>
        {chargedNetKg <= 0 && (
          <p className="mt-1 text-sm text-rose-300">
            {t('No charge lines recorded for this heat yet.', 'इस हीट के लिए अभी कोई चार्ज पंक्ति दर्ज नहीं है।')}
          </p>
        )}
      </div>

      <NumericField id="ingot_kg" labelEn="Ingot kg" labelHi="इंगट किग्रा" value={ingotKg} onChange={setIngotKg} required />
      <NumericField id="dross_kg" labelEn="Dross kg" labelHi="ड्रॉस किग्रा" value={drossKg} onChange={setDrossKg} required />
      <NumericField id="rejection_kg" labelEn="Rejection kg" labelHi="रिजेक्शन किग्रा" value={rejectionKg} onChange={setRejectionKg} required />

      <div className="space-y-2 rounded-xl border border-dashed border-slate-600 p-4">
        <BilingualText as="p" en="Exceptional (optional)" hi="विशेष (वैकल्पिक)" className="text-sm font-semibold text-slate-300" />
        <label className="block space-y-2">
          <BilingualText as="span" en="Label" hi="लेबल" className="text-sm text-slate-400" />
          <input
            value={exceptionalLabel}
            onChange={(e) => setExceptionalLabel(e.target.value)}
            className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4 text-base"
          />
        </label>
        <NumericField id="exceptional_kg" labelEn="Exceptional kg" labelHi="विशेष किग्रा" value={exceptionalKg} onChange={setExceptionalKg} />
      </div>

      <div className="rounded-xl bg-slate-900/60 px-4 py-3">
        <p className="text-sm text-slate-400">{t('Burn loss (auto-calculated)', 'बर्न लॉस (स्वतः गणना)')}</p>
        <p className="text-2xl font-bold text-emerald-400">
          {recovery ? `${recovery.burn_loss_kg.toFixed(2)} kg · ${recovery.burn_loss_pct.toFixed(1)}%` : '—'}
        </p>
      </div>

      {recovery && (
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-xl bg-slate-900/60 py-2">
            <p className="text-slate-400">{t('Ingot %', 'इंगट %')}</p>
            <p className="font-bold text-slate-100">{recovery.ingot_pct.toFixed(1)}%</p>
          </div>
          <div className="rounded-xl bg-slate-900/60 py-2">
            <p className="text-slate-400">{t('Dross %', 'ड्रॉस %')}</p>
            <p className="font-bold text-slate-100">{recovery.dross_pct.toFixed(1)}%</p>
          </div>
          <div className="rounded-xl bg-slate-900/60 py-2">
            <p className="text-slate-400">{t('Rejection %', 'रिजेक्शन %')}</p>
            <p className="font-bold text-slate-100">{recovery.rejection_pct.toFixed(1)}%</p>
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void handleSave()}
        className="min-h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-slate-950 disabled:opacity-50"
      >
        {t('Save Output', 'आउटपुट सहेजें')}
      </button>
      <p className="text-center text-xs text-slate-500">
        {t('This does not close the heat — QA or Plant Head must verify.', 'यह हीट बंद नहीं करता — QA या प्लांट प्रमुख को सत्यापित करना होगा।')}
      </p>
    </section>
  )
}

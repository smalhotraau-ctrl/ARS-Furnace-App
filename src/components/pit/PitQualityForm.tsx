import { useEffect, useState } from 'react'
import { PIT_ELEMENTS, type CompositionEntry, type PitHeat } from '../../types/pitFurnace'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'
import { NumericField, parseNumericField } from '../ui/NumericField'

interface PitQualityFormProps {
  heat: PitHeat | null
  disabled?: boolean
  onSubmit: (composition: CompositionEntry[]) => Promise<void>
}

const ELEMENT_LABELS: Record<(typeof PIT_ELEMENTS)[number], { en: string; hi: string }> = {
  Si: { en: 'Silicon (Si)', hi: 'सिलिकॉन' },
  Fe: { en: 'Iron (Fe)', hi: 'लोहा' },
  Cu: { en: 'Copper (Cu)', hi: 'तांबा' },
  Mn: { en: 'Manganese (Mn)', hi: 'मैंगनीज' },
  Mg: { en: 'Magnesium (Mg)', hi: 'मैग्नीशियम' },
  Zn: { en: 'Zinc (Zn)', hi: 'जस्ता' },
}

export function PitQualityForm({ heat, disabled = false, onSubmit }: PitQualityFormProps) {
  const { t } = useLanguage()
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!heat) {
      setValues({})
      return
    }
    const next: Record<string, string> = {}
    for (const element of PIT_ELEMENTS) {
      const entry = heat.composition.find((c) => c.element === element)
      next[element] = entry?.pct != null ? String(entry.pct) : ''
    }
    setValues(next)
  }, [heat])

  if (!heat) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-600 p-6 text-center text-slate-400">
        <p>{t('Select a heat to record quality', 'गुणवत्ता दर्ज करने के लिए हीट चुनें')}</p>
      </section>
    )
  }

  const allValid = PIT_ELEMENTS.every((el) => parseNumericField(values[el] ?? '') != null)

  async function handleSave() {
    const composition: CompositionEntry[] = PIT_ELEMENTS.map((element) => ({
      element,
      pct: parseNumericField(values[element] ?? '') ?? 0,
    }))
    setSubmitting(true)
    try {
      await onSubmit(composition)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <div>
        <BilingualText
          as="h2"
          en="Quality Record"
          hi="गुणवत्ता रिकॉर्ड"
          className="text-xl font-bold text-slate-100"
        />
        <p className="mt-2 text-sm text-slate-400">
          {t('Record only — no pass/fail flag', 'केवल रिकॉर्ड — कोई पास/फेल नहीं')}
        </p>
        <p className="mt-3 text-lg font-semibold text-emerald-400">{heat.heat_no}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PIT_ELEMENTS.map((element) => (
          <NumericField
            key={element}
            id={`comp-${element}`}
            labelEn={ELEMENT_LABELS[element].en}
            labelHi={ELEMENT_LABELS[element].hi}
            value={values[element] ?? ''}
            onChange={(v) => setValues((prev) => ({ ...prev, [element]: v }))}
            disabled={disabled}
            required
          />
        ))}
      </div>

      <button
        type="button"
        disabled={disabled || !allValid || submitting}
        onClick={() => void handleSave()}
        className="min-h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-on-accent disabled:opacity-50"
      >
        {t('Save Quality', 'गुणवत्ता सहेजें')}
      </button>
    </section>
  )
}

import { useMemo, useState } from 'react'
import type { PitHeat } from '../../types/pitFurnace'
import { nextHeatNo } from '../../types/pitFurnace'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'
import { NumericField, parseNumericField } from '../ui/NumericField'

interface PitProductionFormProps {
  heats: PitHeat[]
  disabled?: boolean
  onSubmit: (values: {
    date: string
    weight_kg: number
    ingot_kg: number
    dross_kg: number
    pit_iron_kg: number
    wood_fuel_kg: number
    sale_kg: number
  }) => Promise<void>
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

export function PitProductionForm({ heats, disabled = false, onSubmit }: PitProductionFormProps) {
  const { t } = useLanguage()
  const [step, setStep] = useState(0)
  const [date, setDate] = useState(todayIsoDate())
  const [weightKg, setWeightKg] = useState('')
  const [ingotKg, setIngotKg] = useState('')
  const [drossKg, setDrossKg] = useState('')
  const [pitIronKg, setPitIronKg] = useState('')
  const [woodFuelKg, setWoodFuelKg] = useState('')
  const [saleKg, setSaleKg] = useState('0')
  const [submitting, setSubmitting] = useState(false)

  const heatNoPreview = useMemo(() => nextHeatNo(heats, new Date(date)), [heats, date])

  const stepOneValid = Boolean(date)
  const stepTwoValid = [weightKg, ingotKg, drossKg, pitIronKg, woodFuelKg].every((v) => parseNumericField(v) != null)
  const stepThreeValid = parseNumericField(saleKg) != null

  async function handleSave() {
    const weight_kg = parseNumericField(weightKg)
    const ingot_kg = parseNumericField(ingotKg)
    const dross_kg = parseNumericField(drossKg)
    const pit_iron_kg = parseNumericField(pitIronKg)
    const wood_fuel_kg = parseNumericField(woodFuelKg)
    const sale_kg = parseNumericField(saleKg)

    if (
      weight_kg == null ||
      ingot_kg == null ||
      dross_kg == null ||
      pit_iron_kg == null ||
      wood_fuel_kg == null ||
      sale_kg == null
    ) {
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({ date, weight_kg, ingot_kg, dross_kg, pit_iron_kg, wood_fuel_kg, sale_kg })
      setStep(0)
      setWeightKg('')
      setIngotKg('')
      setDrossKg('')
      setPitIronKg('')
      setWoodFuelKg('')
      setSaleKg('0')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText
        as="h2"
        en="Production Entry"
        hi="उत्पादन प्रविष्टि"
        className="text-xl font-bold text-slate-100"
      />

      <div className="flex gap-2">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className={`h-2 flex-1 rounded-full ${step >= index ? 'bg-emerald-500' : 'bg-slate-700'}`}
          />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <label className="block space-y-2">
            <BilingualText as="span" en="Date *" hi="तारीख" className="text-base font-semibold" />
            <input
              type="date"
              value={date}
              disabled={disabled}
              onChange={(e) => setDate(e.target.value)}
              className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg text-slate-100"
            />
          </label>
          <div className="rounded-xl bg-slate-900/70 px-4 py-3">
            <p className="text-sm text-slate-400">{t('Heat number (auto)', 'हीट नंबर (स्वचालित)')}</p>
            <p className="mt-1 text-2xl font-bold text-emerald-400">{heatNoPreview}</p>
          </div>
          <button
            type="button"
            disabled={disabled || !stepOneValid}
            onClick={() => setStep(1)}
            className="min-h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-slate-950 disabled:opacity-50"
          >
            {t('Next', 'आगे')}
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <NumericField id="weight" labelEn="Weight (kg)" labelHi="वज़न (किग्रा)" value={weightKg} onChange={setWeightKg} disabled={disabled} required />
          <NumericField id="ingot" labelEn="Ingot (kg)" labelHi="इंगट (किग्रा)" value={ingotKg} onChange={setIngotKg} disabled={disabled} required />
          <NumericField id="dross" labelEn="Dross (kg)" labelHi="ड्रॉस (किग्रा)" value={drossKg} onChange={setDrossKg} disabled={disabled} required />
          <NumericField id="pitIron" labelEn="Pit Iron (kg)" labelHi="पिट आयरन (किग्रा)" value={pitIronKg} onChange={setPitIronKg} disabled={disabled} required />
          <NumericField id="woodFuel" labelEn="Wood Fuel (kg)" labelHi="लकड़ी ईंधन (किग्रा)" value={woodFuelKg} onChange={setWoodFuelKg} disabled={disabled} required />
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(0)} className="min-h-14 flex-1 rounded-xl border border-slate-600 text-lg font-semibold">
              {t('Back', 'पीछे')}
            </button>
            <button
              type="button"
              disabled={disabled || !stepTwoValid}
              onClick={() => setStep(2)}
              className="min-h-14 flex-1 rounded-xl bg-emerald-500 text-lg font-semibold text-slate-950 disabled:opacity-50"
            >
              {t('Next', 'आगे')}
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <NumericField id="sale" labelEn="Sale (kg)" labelHi="बिक्री (किग्रा)" value={saleKg} onChange={setSaleKg} disabled={disabled} required />
          <div className="rounded-xl border border-slate-600 bg-slate-900/50 p-4 text-sm text-slate-300">
            <p className="font-semibold text-slate-100">{heatNoPreview}</p>
            <p>{date} · {ingotKg || '0'} kg ingot · {saleKg || '0'} kg sale</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="min-h-14 flex-1 rounded-xl border border-slate-600 text-lg font-semibold">
              {t('Back', 'पीछे')}
            </button>
            <button
              type="button"
              disabled={disabled || !stepThreeValid || submitting}
              onClick={() => void handleSave()}
              className="min-h-14 flex-1 rounded-xl bg-emerald-500 text-lg font-semibold text-slate-950 disabled:opacity-50"
            >
              {t('Save', 'सहेजें')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

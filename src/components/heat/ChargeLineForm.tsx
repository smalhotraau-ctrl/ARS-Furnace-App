import { useMemo, useState } from 'react'
import type { ChargeLine } from '../../types/heat'
import type { MaterialOption } from '../../types/batchPlan'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'
import { NumericField, parseNumericField } from '../ui/NumericField'

interface ChargeLineFormProps {
  materials: MaterialOption[]
  disabled?: boolean
  onSubmit: (values: {
    bin_bay: string
    material_code: string
    gross_kg: number
    tare_kg: number
    net_kg: number
    is_mid_heat_addition: boolean
  }) => Promise<void>
}

export function ChargeLineForm({ materials, disabled = false, onSubmit }: ChargeLineFormProps) {
  const { t } = useLanguage()
  const [binBay, setBinBay] = useState('')
  const [materialCode, setMaterialCode] = useState('')
  const [grossKg, setGrossKg] = useState('')
  const [tareKg, setTareKg] = useState('')
  const [midHeat, setMidHeat] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const netKg = useMemo(() => {
    const gross = parseNumericField(grossKg)
    const tare = parseNumericField(tareKg)
    if (gross == null || tare == null) return null
    return gross - tare
  }, [grossKg, tareKg])

  async function handleSave() {
    if (netKg == null || !binBay.trim() || !materialCode.trim()) return
    setSubmitting(true)
    try {
      await onSubmit({
        bin_bay: binBay.trim(),
        material_code: materialCode.trim(),
        gross_kg: parseNumericField(grossKg)!,
        tare_kg: parseNumericField(tareKg)!,
        net_kg: netKg,
        is_mid_heat_addition: midHeat,
      })
      setBinBay('')
      setMaterialCode('')
      setGrossKg('')
      setTareKg('')
      setMidHeat(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText as="h3" en="Add Charge Line" hi="चार्ज पंक्ति जोड़ें" className="text-lg font-bold" />

      <label className="block space-y-2">
        <BilingualText as="span" en="Bin / Bay *" hi="बिन / बे" className="font-semibold" />
        <input
          value={binBay}
          disabled={disabled}
          onChange={(e) => setBinBay(e.target.value)}
          className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg"
        />
      </label>

      <label className="block space-y-2">
        <BilingualText as="span" en="Material *" hi="सामग्री" className="font-semibold" />
        <select
          value={materialCode}
          disabled={disabled}
          onChange={(e) => setMaterialCode(e.target.value)}
          className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg"
        >
          <option value="">{t('Select', 'चुनें')}</option>
          {materials.map((m) => (
            <option key={m.code} value={m.code}>{m.code} — {m.name}</option>
          ))}
        </select>
      </label>

      <NumericField id="gross" labelEn="Gross kg" labelHi="ग्रॉस किग्रा" value={grossKg} onChange={setGrossKg} disabled={disabled} required />
      <NumericField id="tare" labelEn="Tare kg" labelHi="टेयर किग्रा" value={tareKg} onChange={setTareKg} disabled={disabled} required />

      <div className="rounded-xl bg-slate-900/60 px-4 py-3">
        <p className="text-sm text-slate-400">{t('Net kg (auto)', 'नेट किग्रा')}</p>
        <p className="text-2xl font-bold text-emerald-400">{netKg != null ? netKg.toFixed(2) : '—'}</p>
      </div>

      <label className="flex items-center gap-3">
        <input type="checkbox" checked={midHeat} disabled={disabled} onChange={(e) => setMidHeat(e.target.checked)} className="h-5 w-5" />
        <BilingualText en="Mid-heat addition" hi="मध्य-हीट addition" className="text-sm" />
      </label>

      <button
        type="button"
        disabled={disabled || submitting || netKg == null || netKg < 0}
        onClick={() => void handleSave()}
        className="min-h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-slate-950 disabled:opacity-50"
      >
        {t('Save Charge', 'चार्ज सहेजें')}
      </button>
    </section>
  )
}

export function ChargeLineList({ lines }: { lines: ChargeLine[] }) {
  const { t } = useLanguage()

  if (lines.length === 0) {
    return <p className="text-sm text-slate-400">{t('No charge lines', 'कोई चार्ज नहीं')}</p>
  }

  return (
    <ul className="space-y-2">
      {lines.map((line) => (
        <li key={line.id} className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm">
          <p className="font-semibold text-slate-100">{line.material_code} · {line.bin_bay}</p>
          <p className="text-slate-400">
            Gross {line.gross_kg} − Tare {line.tare_kg} = Net {line.net_kg} kg
            {line.is_mid_heat_addition ? t(' · Mid-heat', ' · मध्य-हीट') : ''}
          </p>
        </li>
      ))}
    </ul>
  )
}

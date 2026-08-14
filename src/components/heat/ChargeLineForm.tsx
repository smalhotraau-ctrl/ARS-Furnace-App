import { useState } from 'react'
import type { ChargeLine } from '../../types/heat'
import type { MaterialOption } from '../../types/batchPlan'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'
import { NumericField, parseNumericField } from '../ui/NumericField'

interface ChargeLineFormProps {
  materials: MaterialOption[]
  disabled?: boolean
  onSubmit: (values: {
    bin_bay: string | null
    material_code: string
    gross_kg: number | null
    tare_kg: number | null
    net_kg: number
    is_mid_heat_addition: boolean
  }) => Promise<void>
}

// Real floor usage is a single net weight per material pickup. Bin/bay and gross/tare are
// optional context, not required entry (03d_Furnace_Module_HeatCharging_Cycle.md §4) — a
// Supervisor should never be blocked from saving a charge line just because they only know the
// net weight. If gross and tare are both provided, net is auto-computed from them (and the
// direct net entry is disabled to avoid two conflicting sources of truth); otherwise net is
// typed in directly.
export function ChargeLineForm({ materials, disabled = false, onSubmit }: ChargeLineFormProps) {
  const { t } = useLanguage()
  const [binBay, setBinBay] = useState('')
  const [materialCode, setMaterialCode] = useState('')
  const [grossKg, setGrossKg] = useState('')
  const [tareKg, setTareKg] = useState('')
  const [netKgInput, setNetKgInput] = useState('')
  const [midHeat, setMidHeat] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const grossVal = parseNumericField(grossKg)
  const tareVal = parseNumericField(tareKg)
  const hasGrossTare = grossVal != null && tareVal != null
  const computedNetKg = hasGrossTare ? grossVal - tareVal : null
  const netKg = hasGrossTare ? computedNetKg : parseNumericField(netKgInput)

  async function handleSave() {
    if (netKg == null || !materialCode.trim()) return
    setSubmitting(true)
    try {
      await onSubmit({
        bin_bay: binBay.trim() || null,
        material_code: materialCode.trim(),
        gross_kg: grossVal,
        tare_kg: tareVal,
        net_kg: netKg,
        is_mid_heat_addition: midHeat,
      })
      setBinBay('')
      setMaterialCode('')
      setGrossKg('')
      setTareKg('')
      setNetKgInput('')
      setMidHeat(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText as="h3" en="Add Charge Line" hi="चार्ज पंक्ति जोड़ें" className="text-lg font-bold" />

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

      <NumericField
        id="net"
        labelEn="Net kg"
        labelHi="नेट किग्रा"
        value={hasGrossTare ? (computedNetKg != null ? computedNetKg.toFixed(2) : '') : netKgInput}
        onChange={setNetKgInput}
        disabled={disabled || hasGrossTare}
        required
      />
      {hasGrossTare && (
        <p className="text-xs text-slate-500">
          {t('Auto-computed from Gross − Tare below', 'नीचे ग्रॉस − टेयर से स्वतः गणना')}
        </p>
      )}

      <details className="rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-300">
          {t('Optional: Bin/Bay, Gross & Tare', 'वैकल्पिक: बिन/बे, ग्रॉस व टेयर')}
        </summary>
        <div className="mt-4 space-y-4">
          <label className="block space-y-2">
            <BilingualText as="span" en="Bin / Bay" hi="बिन / बे" className="font-semibold" />
            <input
              value={binBay}
              disabled={disabled}
              onChange={(e) => setBinBay(e.target.value)}
              className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg"
            />
          </label>

          <NumericField id="gross" labelEn="Gross kg" labelHi="ग्रॉस किग्रा" value={grossKg} onChange={setGrossKg} disabled={disabled} />
          <NumericField id="tare" labelEn="Tare kg" labelHi="टेयर किग्रा" value={tareKg} onChange={setTareKg} disabled={disabled} />
        </div>
      </details>

      <label className="flex items-center gap-3">
        <input type="checkbox" checked={midHeat} disabled={disabled} onChange={(e) => setMidHeat(e.target.checked)} className="h-5 w-5" />
        <BilingualText en="Mid-heat addition" hi="मध्य-हीट addition" className="text-sm" />
      </label>

      <button
        type="button"
        disabled={disabled || submitting || netKg == null || netKg < 0 || !materialCode.trim()}
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
          <p className="font-semibold text-slate-100">
            {line.material_code}{line.bin_bay ? ` · ${line.bin_bay}` : ''}
          </p>
          <p className="text-slate-400">
            {line.gross_kg != null && line.tare_kg != null
              ? `Gross ${line.gross_kg} − Tare ${line.tare_kg} = Net ${line.net_kg} kg`
              : `Net ${line.net_kg} kg`}
            {line.is_mid_heat_addition ? t(' · Mid-heat', ' · मध्य-हीट') : ''}
          </p>
        </li>
      ))}
    </ul>
  )
}

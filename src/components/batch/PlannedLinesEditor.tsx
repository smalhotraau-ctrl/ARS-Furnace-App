import { useState } from 'react'
import type { PlannedLine } from '../../types/batchPlan'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'
import { NumericField, parseNumericField } from '../ui/NumericField'

interface PlannedLinesEditorProps {
  lines: PlannedLine[]
  materialCodes: string[]
  disabled?: boolean
  onChange: (lines: PlannedLine[]) => void
}

export function PlannedLinesEditor({
  lines,
  materialCodes,
  disabled = false,
  onChange,
}: PlannedLinesEditorProps) {
  const { t } = useLanguage()
  const [materialCode, setMaterialCode] = useState('')
  const [plannedKg, setPlannedKg] = useState('')

  function addLine() {
    const kg = parseNumericField(plannedKg)
    const code = materialCode.trim()
    if (!code || kg == null || kg <= 0) return

    onChange([...lines, { material_code: code, planned_kg: kg }])
    setMaterialCode('')
    setPlannedKg('')
  }

  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index))
  }

  return (
    <section className="space-y-4">
      <BilingualText
        as="h3"
        en="Planned Materials"
        hi="योजना बनाई सामग्री"
        className="text-lg font-bold text-slate-100"
      />

      {!disabled && (
        <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
          <label className="block space-y-2">
            <BilingualText as="span" en="Material" hi="सामग्री" className="font-semibold" />
            {materialCodes.length > 0 ? (
              <select
                value={materialCode}
                onChange={(e) => setMaterialCode(e.target.value)}
                className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg"
              >
                <option value="">{t('Select material', 'सामग्री चुनें')}</option>
                {materialCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={materialCode}
                onChange={(e) => setMaterialCode(e.target.value)}
                placeholder="Material code"
                className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg"
              />
            )}
          </label>
          <NumericField
            id="planned-kg"
            labelEn="Planned kg"
            labelHi="योजना किग्रा"
            value={plannedKg}
            onChange={setPlannedKg}
            required
          />
          <button
            type="button"
            onClick={addLine}
            disabled={!materialCode.trim() || parseNumericField(plannedKg) == null}
            className="min-h-12 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-base font-semibold text-emerald-300 disabled:opacity-50"
          >
            {t('Add line', 'पंक्ति जोड़ें')}
          </button>
        </div>
      )}

      {lines.length === 0 ? (
        <p className="text-sm text-slate-400">{t('No material lines yet', 'अभी कोई सामग्री नहीं')}</p>
      ) : (
        <ul className="space-y-2">
          {lines.map((line, index) => (
            <li
              key={`${line.material_code}-${index}`}
              className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3"
            >
              <div>
                <p className="font-semibold text-slate-100">{line.material_code}</p>
                <p className="text-sm text-slate-400">{line.planned_kg} kg</p>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  className="rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-red-950/40"
                >
                  {t('Remove', 'हटाएं')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

import { useState } from 'react'
import type { MaterialOption, PlannedLine } from '../../types/batchPlan'
import { BilingualText } from '../ui/BilingualText'
import { DeskTd, DesktopTable } from '../ui/DesktopTable'
import { useLanguage } from '../../context/LanguageContext'
import { NumericField, parseNumericField } from '../ui/NumericField'

interface PlannedLinesEditorProps {
  lines: PlannedLine[]
  materials: MaterialOption[]
  disabled?: boolean
  onChange: (lines: PlannedLine[]) => void
}

// Material selection pulls from the same furnace.materials master used by Charging's Material
// dropdown (see ChargeLineForm) — a plan should never reference a material that doesn't
// actually exist in the materials master, so there is no free-text fallback here.
export function PlannedLinesEditor({
  lines,
  materials,
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
        <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-4 lg:grid lg:grid-cols-[1fr_12rem_auto] lg:items-end lg:gap-3 lg:space-y-0">
          <label className="block space-y-2">
            <BilingualText as="span" en="Material" hi="सामग्री" className="font-semibold" />
            <select
              value={materialCode}
              disabled={materials.length === 0}
              onChange={(e) => setMaterialCode(e.target.value)}
              className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg disabled:opacity-60"
            >
              <option value="">
                {materials.length > 0 ? t('Select material', 'सामग्री चुनें') : t('No materials available', 'कोई सामग्री उपलब्ध नहीं')}
              </option>
              {materials.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code} — {m.name}
                </option>
              ))}
            </select>
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
            className="min-h-12 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-base font-semibold text-emerald-300 disabled:opacity-50 lg:min-h-14"
          >
            {t('Add line', 'पंक्ति जोड़ें')}
          </button>
        </div>
      )}

      {lines.length === 0 ? (
        <p className="text-sm text-slate-400">{t('No material lines yet', 'अभी कोई सामग्री नहीं')}</p>
      ) : (
        <>
        <ul className="space-y-2 lg:hidden">
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
        <DesktopTable
          columns={[
            t('Material', 'सामग्री'),
            t('kg', 'किग्रा'),
            ...(!disabled ? [t('Actions', 'कार्रवाई')] : []),
          ]}
        >
          {lines.map((line, index) => (
            <tr key={`${line.material_code}-${index}`} className="hover:bg-slate-800/40">
              <DeskTd className="font-semibold text-slate-100">{line.material_code}</DeskTd>
              <DeskTd>{line.planned_kg}</DeskTd>
              {!disabled && (
                <DeskTd>
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="min-h-10 rounded-lg px-3 text-sm text-red-300 hover:bg-red-950/40"
                  >
                    {t('Remove', 'हटाएं')}
                  </button>
                </DeskTd>
              )}
            </tr>
          ))}
        </DesktopTable>
        </>
      )}
    </section>
  )
}

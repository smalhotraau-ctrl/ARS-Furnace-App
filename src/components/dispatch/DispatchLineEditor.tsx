import { useMemo, useState } from 'react'
import type { DispatchLineDraft } from '../../types/dispatch'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'
import { NumericField, parseNumericField } from '../ui/NumericField'

export interface HeatStockOption {
  heat_id: string
  heat_no: string
  available_kg: number
}

interface DispatchLineEditorProps {
  lines: DispatchLineDraft[]
  options: HeatStockOption[]
  disabled?: boolean
  onChange: (lines: DispatchLineDraft[]) => void
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 1 })
}

// One dispatch can cover a single heat or several combined into one invoice. Each line picks
// a heat with available fg_stock and a kg amount — over-drawing is flagged, never blocked
// (03g §2).
export function DispatchLineEditor({ lines, options, disabled = false, onChange }: DispatchLineEditorProps) {
  const { t } = useLanguage()
  const [heatId, setHeatId] = useState('')
  const [kg, setKg] = useState('')

  const availableOptions = useMemo(
    () => options.filter((o) => !lines.some((l) => l.heat_id === o.heat_id)),
    [options, lines],
  )

  const selectedOption = availableOptions.find((o) => o.heat_id === heatId) ?? null
  const parsedKg = parseNumericField(kg)
  const wouldOverDraw = selectedOption != null && parsedKg != null && parsedKg > selectedOption.available_kg

  function addLine() {
    if (!selectedOption || parsedKg == null || parsedKg <= 0) return
    onChange([
      ...lines,
      { heat_id: selectedOption.heat_id, heat_no: selectedOption.heat_no, kg_dispatched: parsedKg, available_kg: selectedOption.available_kg },
    ])
    setHeatId('')
    setKg('')
  }

  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index))
  }

  return (
    <section className="space-y-4">
      <BilingualText as="h3" en="Heats in this Dispatch" hi="इस डिस्पैच में हीट्स" className="text-lg font-bold text-slate-100" />

      {!disabled && (
        <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
          <label className="block space-y-2">
            <BilingualText as="span" en="Heat" hi="हीट" className="font-semibold text-slate-100" />
            <select
              value={heatId}
              disabled={availableOptions.length === 0}
              onChange={(e) => setHeatId(e.target.value)}
              className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg text-slate-100 disabled:opacity-60"
            >
              <option value="">
                {availableOptions.length > 0 ? t('Select heat', 'हीट चुनें') : t('No FG stock available', 'कोई FG स्टॉक उपलब्ध नहीं')}
              </option>
              {availableOptions.map((o) => (
                <option key={o.heat_id} value={o.heat_id}>
                  {o.heat_no} — {fmt(o.available_kg)} kg {t('available', 'उपलब्ध')}
                </option>
              ))}
            </select>
          </label>

          <NumericField id="dispatch-line-kg" labelEn="Kg dispatched" labelHi="डिस्पैच किग्रा" value={kg} onChange={setKg} required />

          {wouldOverDraw && (
            <p className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-300 ring-1 ring-amber-500/40">
              <span className="text-lg">⚠</span>
              {t(
                `This exceeds available stock (${fmt(selectedOption!.available_kg)} kg) — allowed, but flagged.`,
                `यह उपलब्ध स्टॉक (${fmt(selectedOption!.available_kg)} किग्रा) से अधिक है — अनुमति है, पर चिह्नित किया गया है।`,
              )}
            </p>
          )}

          <button
            type="button"
            onClick={addLine}
            disabled={!selectedOption || parsedKg == null || parsedKg <= 0}
            className="min-h-12 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-base font-semibold text-emerald-300 disabled:opacity-50"
          >
            {t('Add line', 'पंक्ति जोड़ें')}
          </button>
        </div>
      )}

      {lines.length === 0 ? (
        <p className="text-sm text-slate-400">{t('No heats added yet', 'अभी कोई हीट नहीं जोड़ी गई')}</p>
      ) : (
        <ul className="space-y-2">
          {lines.map((line, index) => {
            const overDrawn = line.kg_dispatched > line.available_kg
            return (
              <li
                key={`${line.heat_id}-${index}`}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  overDrawn ? 'border-amber-500/50 bg-amber-950/20' : 'border-slate-700 bg-slate-800/60'
                }`}
              >
                <div>
                  <p className="font-semibold text-slate-100">{line.heat_no}</p>
                  <p className="text-sm text-slate-400">
                    {fmt(line.kg_dispatched)} kg · {fmt(line.available_kg)} kg {t('was available', 'उपलब्ध था')}
                  </p>
                  {overDrawn && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-300">
                      <span>⚠</span> {t('Exceeds available stock', 'उपलब्ध स्टॉक से अधिक')}
                    </p>
                  )}
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
            )
          })}
        </ul>
      )}
    </section>
  )
}

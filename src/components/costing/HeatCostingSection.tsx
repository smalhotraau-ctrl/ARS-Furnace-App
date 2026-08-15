import { useEffect, useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { BilingualText } from '../ui/BilingualText'
import { fetchChargeLines } from '../../lib/heatService'
import { fetchHeatOutput } from '../../lib/outputService'
import {
  computeMaterialCostFromRates,
  fetchHeatCostingByHeatId,
  heatCloseDate,
  suggestFlatRateCost,
} from '../../lib/costingService'
import type { ChargeLine, Heat } from '../../types/heat'
import type { HeatOutput } from '../../types/output'
import type { HeatCostingBaseInputsPayload, HeatCostingRow, RateMasterRow } from '../../types/costing'

interface HeatCostingSectionProps {
  closedHeats: Heat[]
  rateMaster: RateMasterRow[]
  canManage: boolean
  canOverrideDirect: boolean
  overrideAutoApproved: boolean
  onCompute: (heat: Heat, chargeLines: ChargeLine[]) => Promise<void>
  onUpdateBaseInputs: (costing: HeatCostingRow, inputs: HeatCostingBaseInputsPayload, ingotKg: number) => Promise<void>
  onProposeOverride: (costing: HeatCostingRow, newFinal: number, reason: string) => Promise<void>
}

const emptyInputs: HeatCostingBaseInputsPayload = {
  fuel_cost: 0,
  manpower_cost: 0,
  consumables_cost: 0,
  electrical_cost: 0,
  transport_cost: 0,
  selling_price_per_kg: 0,
}

export function HeatCostingSection({
  closedHeats,
  rateMaster,
  canManage,
  canOverrideDirect,
  overrideAutoApproved,
  onCompute,
  onUpdateBaseInputs,
  onProposeOverride,
}: HeatCostingSectionProps) {
  const { t } = useLanguage()
  const [selectedHeatId, setSelectedHeatId] = useState<string | null>(null)
  const [chargeLines, setChargeLines] = useState<ChargeLine[]>([])
  const [output, setOutput] = useState<HeatOutput | null>(null)
  const [costing, setCosting] = useState<HeatCostingRow | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [computing, setComputing] = useState(false)
  const [inputs, setInputs] = useState<HeatCostingBaseInputsPayload>(emptyInputs)
  const [savingInputs, setSavingInputs] = useState(false)
  const [actualCost, setActualCost] = useState('')
  const [actualReason, setActualReason] = useState('')
  const [submittingActual, setSubmittingActual] = useState(false)

  const selectedHeat = closedHeats.find((h) => h.id === selectedHeatId) ?? null

  useEffect(() => {
    if (!selectedHeatId) {
      setChargeLines([])
      setOutput(null)
      setCosting(null)
      return
    }
    let cancelled = false
    setLoadingDetail(true)
    void Promise.all([fetchChargeLines(selectedHeatId), fetchHeatOutput(selectedHeatId), fetchHeatCostingByHeatId(selectedHeatId)])
      .then(([lines, out, existingCosting]) => {
        if (cancelled) return
        setChargeLines(lines)
        setOutput(out)
        setCosting(existingCosting)
        setInputs(
          existingCosting
            ? {
                fuel_cost: existingCosting.fuel_cost,
                manpower_cost: existingCosting.manpower_cost,
                consumables_cost: existingCosting.consumables_cost,
                electrical_cost: existingCosting.electrical_cost,
                transport_cost: existingCosting.transport_cost,
                selling_price_per_kg: existingCosting.selling_price_per_kg,
              }
            : emptyInputs,
        )
        setActualCost(existingCosting ? String(existingCosting.material_cost_final) : '')
        setActualReason(existingCosting?.material_cost_override_reason ?? '')
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedHeatId])

  const chargedNetKg = chargeLines.reduce((sum, l) => sum + l.net_kg, 0)
  const ratePreview =
    selectedHeat && !costing
      ? computeMaterialCostFromRates(chargeLines, rateMaster, heatCloseDate(selectedHeat))
      : null

  async function handleCompute() {
    if (!selectedHeat) return
    setComputing(true)
    try {
      await onCompute(selectedHeat, chargeLines)
      const fresh = await fetchHeatCostingByHeatId(selectedHeat.id)
      setCosting(fresh)
      if (fresh) {
        setActualCost(String(fresh.material_cost_final))
        setActualReason(fresh.material_cost_override_reason ?? '')
      }
    } finally {
      setComputing(false)
    }
  }

  async function handleSaveInputs() {
    if (!costing) return
    setSavingInputs(true)
    try {
      await onUpdateBaseInputs(costing, inputs, output?.ingot_kg ?? 0)
      const fresh = await fetchHeatCostingByHeatId(costing.heat_id)
      setCosting(fresh)
    } finally {
      setSavingInputs(false)
    }
  }

  async function handleSaveActual() {
    if (!costing || !actualReason.trim() || !Number.isFinite(Number(actualCost))) return
    setSubmittingActual(true)
    try {
      await onProposeOverride(costing, Number(actualCost), actualReason.trim())
      const fresh = await fetchHeatCostingByHeatId(costing.heat_id)
      setCosting(fresh)
      if (fresh) setActualCost(String(fresh.material_cost_final))
    } finally {
      setSubmittingActual(false)
    }
  }

  const needsOwnerForActual = !canOverrideDirect && !overrideAutoApproved

  return (
    <section className="space-y-4">
      <BilingualText as="h2" en="Heat Costing" hi="हीट कॉस्टिंग" className="text-lg font-semibold text-slate-100" />

      <div className="space-y-4 lg:grid lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-4">
          <label className="block space-y-2">
            <BilingualText as="span" en="Closed heat" hi="बंद हीट" className="font-semibold" />
            <select
              value={selectedHeatId ?? ''}
              onChange={(e) => setSelectedHeatId(e.target.value || null)}
              className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
            >
              <option value="">{t('Select a closed heat…', 'बंद हीट चुनें…')}</option>
              {closedHeats.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.heat_no} — {h.grade_code}
                </option>
              ))}
            </select>
          </label>

          {loadingDetail && <p className="text-sm text-slate-400">{t('Loading…', 'लोड हो रहा है…')}</p>}

          {selectedHeat && !loadingDetail && !costing && (
            <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
              <p className="text-sm text-slate-300">
                {t('Charged', 'चार्ज किया गया')}: {chargedNetKg.toFixed(1)} kg {t('across', 'में')} {chargeLines.length}{' '}
                {t('lines', 'लाइनें')}
              </p>
              {ratePreview && (
                <div className="space-y-2 text-sm text-slate-300">
                  <p>
                    {t('Estimated material cost', 'अनुमानित मैटेरियल लागत')}: ₹{ratePreview.materialCost.toFixed(2)}
                  </p>
                  {ratePreview.lines.length > 0 && (
                    <ul className="space-y-1 text-xs text-slate-400">
                      {ratePreview.lines.map((line) => (
                        <li key={line.material_code}>
                          {line.material_code}: {line.kg.toFixed(1)} kg
                          {line.rate_per_kg != null
                            ? ` @ ₹${line.rate_per_kg}/kg = ₹${line.cost.toFixed(2)}`
                            : ` — ${t('no rate', 'कोई रेट नहीं')}`}
                        </li>
                      ))}
                    </ul>
                  )}
                  {ratePreview.uncovered.length > 0 && (
                    <p className="text-amber-300">
                      {t('No rate on close date for', 'बंद तिथि पर रेट नहीं')}:{' '}
                      {ratePreview.uncovered.map((u) => `${u.material_code} (${u.kg.toFixed(1)} kg)`).join(', ')}
                    </p>
                  )}
                </div>
              )}
              {canManage && (
                <button
                  type="button"
                  disabled={computing}
                  onClick={() => void handleCompute()}
                  className="min-h-12 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-on-accent disabled:opacity-50"
                >
                  {computing ? t('Computing…', 'गणना हो रही है…') : t('Compute costing', 'कॉस्टिंग की गणना करें')}
                </button>
              )}
              <p className="text-xs text-slate-500">
                {t(
                  'Uses each material’s latest Rate Master rate on or before this heat’s close date. You can then enter the actual material cost below.',
                  'प्रत्येक मैटेरियल का इस हीट की बंद तिथि तक का नवीनतम रेट मास्टर रेट इस्तेमाल होता है। उसके बाद आप वास्तविक मैटेरियल लागत दर्ज कर सकते हैं।',
                )}
              </p>
            </div>
          )}
        </div>

        {costing && !loadingDetail && (
          <div className="space-y-4">
            {canManage && (
              <div className="space-y-3 rounded-2xl border-2 border-emerald-500/50 bg-emerald-950/20 p-5">
                <BilingualText
                  as="h3"
                  en="Actual material cost"
                  hi="वास्तविक मैटेरियल लागत"
                  className="text-lg font-bold text-emerald-100"
                />
                <p className="text-sm text-slate-300">
                  {t(
                    'Enter the known actual cost for this heat. The Rate Master figure is only the starting estimate.',
                    'इस हीट की ज्ञात वास्तविक लागत दर्ज करें। रेट मास्टर आंकड़ा केवल शुरुआती अनुमान है।',
                  )}
                </p>
                <p className="text-sm text-slate-400">
                  {t('Rate-master estimate', 'रेट-मास्टर अनुमान')}: ₹{costing.material_cost_computed.toFixed(2)}
                </p>
                {needsOwnerForActual && (
                  <p className="text-sm text-amber-200">
                    {t('This will need Owner approval before it applies.', 'यह लागू होने से पहले मालिक की स्वीकृति की आवश्यकता होगी।')}
                  </p>
                )}
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-200">{t('Actual cost (₹) *', 'वास्तविक लागत (₹) *')}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={actualCost}
                    onChange={(e) => setActualCost(e.target.value)}
                    className="w-full min-h-12 rounded-xl border border-emerald-500/40 bg-slate-800 px-4 text-lg"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-200">{t('Note *', 'टिप्पणी *')}</span>
                  <textarea
                    value={actualReason}
                    onChange={(e) => setActualReason(e.target.value)}
                    placeholder={t('e.g. invoice / known mix cost', 'जैसे इनवॉइस / ज्ञात मिक्स लागत')}
                    className="w-full min-h-20 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2"
                  />
                </label>
                {costing.material_cost_override_reason && (
                  <p className="text-xs text-emerald-200">
                    {t('Currently saved', 'वर्तमान में सहेजा गया')}: {costing.material_cost_override_reason}
                  </p>
                )}
                <button
                  type="button"
                  disabled={submittingActual || !actualReason.trim() || !actualCost}
                  onClick={() => void handleSaveActual()}
                  className="min-h-12 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-on-accent disabled:opacity-50"
                >
                  {t('Save actual cost', 'वास्तविक लागत सहेजें')}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-5">
              <Stat label={t('Material (estimate)', 'मैटेरियल (अनुमान)')} value={`₹${costing.material_cost_computed.toFixed(2)}`} />
              <Stat label={t('Material (actual)', 'मैटेरियल (वास्तविक)')} value={`₹${costing.material_cost_final.toFixed(2)}`} />
              <Stat label={t('Fuel', 'फ्यूल')} value={`₹${costing.fuel_cost.toFixed(2)}`} />
              <Stat label={t('Manpower', 'मैनपावर')} value={`₹${costing.manpower_cost.toFixed(2)}`} />
              <Stat label={t('Consumables', 'उपभोग्य')} value={`₹${costing.consumables_cost.toFixed(2)}`} />
              <Stat label={t('Electrical', 'इलेक्ट्रिकल')} value={`₹${costing.electrical_cost.toFixed(2)}`} />
              <Stat label={t('Transport', 'परिवहन')} value={`₹${costing.transport_cost.toFixed(2)}`} />
              <Stat label={t('Cost/kg', 'लागत/किग्रा')} value={`₹${costing.cost_per_kg.toFixed(2)}`} />
              <Stat label={t('Selling price/kg', 'बिक्री मूल्य/किग्रा')} value={`₹${costing.selling_price_per_kg.toFixed(2)}`} />
              <Stat
                label={t('Savings', 'बचत')}
                value={`₹${costing.savings.toFixed(2)}`}
                positive={costing.savings >= 0}
              />
            </div>

            {canManage && (
              <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
                <BilingualText as="h3" en="Base cost inputs (hand-entered)" hi="बेस लागत इनपुट (हाथ से दर्ज)" className="text-sm font-semibold text-slate-300" />
                <div className="space-y-3 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0">
                  {(['fuel_cost', 'manpower_cost', 'consumables_cost', 'electrical_cost', 'transport_cost'] as const).map((field) => {
                    const category = field.replace('_cost', '') as 'fuel' | 'manpower' | 'consumables' | 'electrical' | 'transport'
                    const closeDate = selectedHeat ? heatCloseDate(selectedHeat) : ''
                    const suggestion = suggestFlatRateCost(category, closeDate, chargedNetKg, rateMaster)
                    return (
                      <label key={field} className="block space-y-1">
                        <span className="text-sm font-semibold text-slate-300">{FIELD_LABELS[field].en}</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={inputs[field]}
                          onChange={(e) => setInputs({ ...inputs, [field]: Number(e.target.value) })}
                          className="w-full min-h-11 rounded-xl border border-slate-600 bg-slate-800 px-4"
                        />
                        {suggestion && (
                          <button
                            type="button"
                            onClick={() => setInputs({ ...inputs, [field]: Number(suggestion.suggested_cost.toFixed(2)) })}
                            className="text-xs text-emerald-300 underline"
                          >
                            {t('Suggested', 'सुझाया गया')}: ₹{suggestion.suggested_cost.toFixed(2)} ({suggestion.item} @ ₹
                            {suggestion.rate_per_kg}/kg)
                          </button>
                        )}
                      </label>
                    )
                  })}
                  <label className="block space-y-1">
                    <span className="text-sm font-semibold text-slate-300">{t('Selling price (₹/kg)', 'बिक्री मूल्य (₹/किग्रा)')}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={inputs.selling_price_per_kg}
                      onChange={(e) => setInputs({ ...inputs, selling_price_per_kg: Number(e.target.value) })}
                      className="w-full min-h-11 rounded-xl border border-slate-600 bg-slate-800 px-4"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={savingInputs}
                  onClick={() => void handleSaveInputs()}
                  className="min-h-12 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-on-accent disabled:opacity-50 lg:w-auto lg:px-6"
                >
                  {t('Save & recompute cost/kg', 'सहेजें व लागत/किग्रा फिर से गणना करें')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

const FIELD_LABELS: Record<string, { en: string; hi: string }> = {
  fuel_cost: { en: 'Fuel (₹)', hi: 'फ्यूल (₹)' },
  manpower_cost: { en: 'Manpower (₹)', hi: 'मैनपावर (₹)' },
  consumables_cost: { en: 'Consumables (₹)', hi: 'उपभोग्य (₹)' },
  electrical_cost: { en: 'Electrical (₹)', hi: 'इलेक्ट्रिकल (₹)' },
  transport_cost: { en: 'Transport (₹)', hi: 'परिवहन (₹)' },
}

function Stat({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`font-semibold ${positive === undefined ? 'text-slate-100' : positive ? 'text-emerald-300' : 'text-red-300'}`}>
        {value}
      </p>
    </div>
  )
}

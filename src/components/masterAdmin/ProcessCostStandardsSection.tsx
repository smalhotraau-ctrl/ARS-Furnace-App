import { useMemo, useState } from 'react'
import type { ProcessCostStandardCreatePayload, ProcessCostStandardRow } from '../../types/costing'
import { BilingualText } from '../ui/BilingualText'
import { DeskTd, DesktopTable } from '../ui/DesktopTable'
import { NumericField, parseNumericField } from '../ui/NumericField'
import { useLanguage } from '../../context/LanguageContext'
import { lookupLatestProcessCostStandard, processCostPerKg } from '../../lib/batchPlanEstimate'

interface ProcessCostStandardsSectionProps {
  rows: ProcessCostStandardRow[]
  canPropose: boolean
  autoApproved: boolean
  onCreate: (payload: ProcessCostStandardCreatePayload) => Promise<void>
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function ProcessCostStandardsSection({
  rows,
  canPropose,
  autoApproved,
  onCreate,
}: ProcessCostStandardsSectionProps) {
  const { t } = useLanguage()
  const [adding, setAdding] = useState(false)
  const [effectiveFrom, setEffectiveFrom] = useState(today)
  const [fuel, setFuel] = useState('')
  const [manpower, setManpower] = useState('')
  const [consumables, setConsumables] = useState('')
  const [electricalTransport, setElectricalTransport] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const todayIso = today()
  const current = useMemo(() => lookupLatestProcessCostStandard(todayIso, rows), [rows, todayIso])
  const currentTotal = processCostPerKg(current)

  const canSubmit =
    parseNumericField(fuel) != null &&
    parseNumericField(manpower) != null &&
    parseNumericField(consumables) != null &&
    parseNumericField(electricalTransport) != null &&
    effectiveFrom.length > 0

  async function submit() {
    const payload: ProcessCostStandardCreatePayload = {
      fuel_cost_per_kg: parseNumericField(fuel)!,
      manpower_cost_per_kg: parseNumericField(manpower)!,
      consumables_cost_per_kg: parseNumericField(consumables)!,
      electrical_transport_cost_per_kg: parseNumericField(electricalTransport)!,
      effective_from: effectiveFrom,
    }
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onCreate(payload)
      setFuel('')
      setManpower('')
      setConsumables('')
      setElectricalTransport('')
      setEffectiveFrom(today())
      setAdding(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BilingualText
          as="h2"
          en="Process Cost Standards"
          hi="प्रक्रिया लागत मानक"
          className="text-lg font-semibold text-slate-100"
        />
        {canPropose && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-11 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-on-accent"
          >
            {t('Propose new version', 'नया संस्करण प्रस्तावित करें')}
          </button>
        )}
      </div>

      {current ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-200">
          <p className="font-semibold text-slate-100">
            {t('Current (effective', 'वर्तमान (प्रभावी')} {current.effective_from})
          </p>
          <p className="mt-2">
            {t('Fuel', 'ईंधन')}: ₹{current.fuel_cost_per_kg}/kg · {t('Manpower', 'मशगूर')}: ₹
            {current.manpower_cost_per_kg}/kg
          </p>
          <p>
            {t('Consumables', 'उपभोग्य')}: ₹{current.consumables_cost_per_kg}/kg ·{' '}
            {t('Elec. + transport', 'बिजली + परिवहन')}: ₹{current.electrical_transport_cost_per_kg}/kg
          </p>
          <p className="mt-2 font-bold text-emerald-300">
            {t('Total process', 'कुल प्रक्रिया')}: ₹{currentTotal?.toFixed(2) ?? '—'}/kg
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-400">{t('No process cost standard configured yet.', 'अभी कोई प्रक्रिया लागत मानक नहीं।')}</p>
      )}

      {canPropose && adding && (
        <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/40 p-4">
          <label className="block space-y-1">
            <span className="text-sm font-semibold">{t('Effective from', 'प्रभावी तिथि')}</span>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-slate-600 bg-slate-900 px-3"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumericField id="pcs-fuel" labelEn="Fuel ₹/kg" labelHi="ईंधन ₹/kg" value={fuel} onChange={setFuel} />
            <NumericField id="pcs-manpower" labelEn="Manpower ₹/kg" labelHi="मशगूर ₹/kg" value={manpower} onChange={setManpower} />
            <NumericField id="pcs-consumables" labelEn="Consumables ₹/kg" labelHi="उपभोग्य ₹/kg" value={consumables} onChange={setConsumables} />
            <NumericField
              id="pcs-electrical"
              labelEn="Elec. + transport ₹/kg"
              labelHi="बिजली + परिवहन ₹/kg"
              value={electricalTransport}
              onChange={setElectricalTransport}
            />
          </div>
          {autoApproved && (
            <p className="text-xs text-amber-300">{t('Applies immediately (gate off)', 'तुरंत लागू (गेट बंद)')}</p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setAdding(false)} className="min-h-11 flex-1 rounded-xl border border-slate-600 font-semibold">
              {t('Cancel', 'रद्द')}
            </button>
            <button
              type="button"
              disabled={!canSubmit || submitting}
              onClick={() => void submit()}
              className="min-h-11 flex-1 rounded-xl bg-emerald-500 font-semibold text-on-accent disabled:opacity-50"
            >
              {t('Submit proposal', 'प्रस्ताव भेजें')}
            </button>
          </div>
        </div>
      )}

      <DesktopTable columns={[t('Effective', 'प्रभावी'), t('Fuel', 'ईंधन'), t('Manpower', 'मशगूर'), t('Consumables', 'उपभोग्य'), t('Elec.+Trans.', 'बिजली+परि.'), t('Total/kg', 'कुल/kg')]}>
        {[...rows]
          .sort((a, b) => b.effective_from.localeCompare(a.effective_from))
          .map((row) => {
            const total = processCostPerKg(row)
            return (
              <tr key={row.id} className="hover:bg-slate-800/40">
                <DeskTd>{row.effective_from}</DeskTd>
                <DeskTd>₹{row.fuel_cost_per_kg}</DeskTd>
                <DeskTd>₹{row.manpower_cost_per_kg}</DeskTd>
                <DeskTd>₹{row.consumables_cost_per_kg}</DeskTd>
                <DeskTd>₹{row.electrical_transport_cost_per_kg}</DeskTd>
                <DeskTd className="font-semibold">₹{total?.toFixed(2) ?? '—'}</DeskTd>
              </tr>
            )
          })}
      </DesktopTable>
    </section>
  )
}

import { useState } from 'react'
import type { BatchPlan } from '../../types/batchPlan'
import type { FurnaceOption } from '../../types/batchPlan'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'
import { NumericField, parseNumericField } from '../ui/NumericField'

interface StartHeatFormProps {
  furnaces: FurnaceOption[]
  batchPlans: BatchPlan[]
  gradeCodes: string[]
  disabled?: boolean
  onStart: (values: {
    furnace_code: string
    grade_code: string
    batch_plan_id: string | null
    customer: string | null
    fuel_reading: number | null
    emergency: boolean
  }) => Promise<{ error?: string }>
}

export function StartHeatForm({ furnaces, batchPlans, gradeCodes, disabled = false, onStart }: StartHeatFormProps) {
  const { t } = useLanguage()
  const [furnaceCode, setFurnaceCode] = useState('')
  const [batchPlanId, setBatchPlanId] = useState('')
  const [gradeCode, setGradeCode] = useState('')
  const [customer, setCustomer] = useState('')
  const [fuelReading, setFuelReading] = useState('')
  const [showEmergency, setShowEmergency] = useState(false)
  const [emergencyAck, setEmergencyAck] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const filteredPlans = batchPlans.filter((p) => !furnaceCode || p.furnace_code === furnaceCode)
  const selectedPlan = batchPlans.find((p) => p.id === batchPlanId)

  function handlePlanChange(planId: string) {
    setBatchPlanId(planId)
    const plan = batchPlans.find((p) => p.id === planId)
    if (plan) {
      setGradeCode(plan.grade_code)
      setFurnaceCode(plan.furnace_code)
    }
  }

  async function handleSubmit(emergency: boolean) {
    if (!furnaceCode || !gradeCode) {
      setError('Furnace and grade are required.')
      return
    }
    if (emergency && !emergencyAck) {
      setError('Acknowledge emergency start to continue.')
      return
    }

    setSubmitting(true)
    setError(null)
    const result = await onStart({
      furnace_code: furnaceCode,
      grade_code: gradeCode,
      batch_plan_id: batchPlanId || null,
      customer: customer.trim() || null,
      fuel_reading: parseNumericField(fuelReading),
      emergency,
    })
    if (result.error) setError(result.error)
    else {
      setFurnaceCode('')
      setBatchPlanId('')
      setGradeCode('')
      setCustomer('')
      setFuelReading('')
      setShowEmergency(false)
      setEmergencyAck(false)
    }
    setSubmitting(false)
  }

  const online = navigator.onLine

  return (
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText
        as="h2"
        en="Start New Heat"
        hi="नई हीट शुरू करें"
        className="text-xl font-bold text-slate-100"
      />
      <p className="text-sm text-slate-400">
        {t('Heat number is system-generated', 'हीट नंबर स्वचालित')}
      </p>

      <label className="block space-y-2">
        <BilingualText as="span" en="Furnace *" hi="फर्नेस" className="font-semibold" />
        <select
          value={furnaceCode}
          disabled={disabled}
          onChange={(e) => setFurnaceCode(e.target.value)}
          className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg"
        >
          <option value="">{t('Select', 'चुनें')}</option>
          {furnaces.map((f) => (
            <option key={f.code} value={f.code}>{f.code} — {f.name}</option>
          ))}
        </select>
      </label>

      <label className="block space-y-2">
        <BilingualText as="span" en="Batch plan (optional)" hi="बैच योजना (वैकल्पिक)" className="font-semibold" />
        <select
          value={batchPlanId}
          disabled={disabled}
          onChange={(e) => handlePlanChange(e.target.value)}
          className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg"
        >
          <option value="">{t('No plan', 'कोई योजना नहीं')}</option>
          {filteredPlans.map((p) => (
            <option key={p.id} value={p.id}>{p.furnace_code} · {p.grade_code} · {p.plan_date}</option>
          ))}
        </select>
      </label>

      <label className="block space-y-2">
        <BilingualText as="span" en="Grade *" hi="ग्रेड" className="font-semibold" />
        <select
          value={gradeCode}
          disabled={disabled || Boolean(selectedPlan)}
          onChange={(e) => setGradeCode(e.target.value)}
          className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg"
        >
          <option value="">{t('Select', 'चुनें')}</option>
          {gradeCodes.map((code) => (
            <option key={code} value={code}>{code}</option>
          ))}
          {/* A plan-linked grade may not be in the active grade_specs list (e.g. superseded) —
              keep it selectable/visible instead of silently resetting to blank. */}
          {gradeCode && !gradeCodes.includes(gradeCode) && (
            <option value={gradeCode}>{gradeCode}</option>
          )}
        </select>
      </label>

      <label className="block space-y-2">
        <BilingualText as="span" en="Customer" hi="ग्राहक" className="font-semibold" />
        <input
          value={customer}
          disabled={disabled}
          onChange={(e) => setCustomer(e.target.value)}
          className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg"
        />
      </label>

      <NumericField
        id="fuel-reading"
        labelEn="Fuel reading"
        labelHi="ईंधन रीडिंग"
        value={fuelReading}
        onChange={setFuelReading}
        disabled={disabled}
      />

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-red-200">{error}</p>
      )}

      {online ? (
        <button
          type="button"
          disabled={disabled || submitting}
          onClick={() => void handleSubmit(false)}
          className="min-h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-slate-950 disabled:opacity-50"
        >
          {t('Start Heat', 'हीट शुरू करें')}
        </button>
      ) : (
        <div className="space-y-3">
          {!showEmergency ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-950/30 px-4 py-3 text-amber-200">
              {t('Connection required to start a heat', 'कनेक्शन आवश्यक')}
            </p>
          ) : null}
          {!showEmergency ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowEmergency(true)}
              className="min-h-14 w-full rounded-xl border border-amber-500/50 bg-amber-950/40 text-lg font-semibold text-amber-200"
            >
              Emergency Start — No Connection
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-950/20 p-4">
              <BilingualText
                en="Emergency offline start uses a placeholder code until sync."
                hi="आपातकालीन ऑफलाइन शुरुआत में placeholder कोड लगेगा।"
                className="text-sm text-amber-100"
              />
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={emergencyAck}
                  onChange={(e) => setEmergencyAck(e.target.checked)}
                  className="mt-1 h-5 w-5"
                />
                <BilingualText
                  en="I acknowledge emergency start without connection"
                  hi="मैं बिना कनेक्शन आपातकालीन शुरुआत स्वीकार करता/करती हूँ"
                  className="text-sm"
                />
              </label>
              <button
                type="button"
                disabled={disabled || submitting || !emergencyAck}
                onClick={() => void handleSubmit(true)}
                className="min-h-14 w-full rounded-xl bg-amber-500 text-lg font-semibold text-slate-950 disabled:opacity-50"
              >
                {t('Confirm Emergency Start', 'पुष्टि करें')}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

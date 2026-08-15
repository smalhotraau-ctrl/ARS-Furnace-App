import { useState } from 'react'
import type { DispatchLineDraft } from '../../types/dispatch'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'
import { DispatchLineEditor, type HeatStockOption } from './DispatchLineEditor'

interface DispatchFormProps {
  options: HeatStockOption[]
  onSubmit: (values: {
    party_name: string
    invoice_no: string
    dispatch_date: string
    lines: DispatchLineDraft[]
  }) => Promise<void>
  onCancel?: () => void
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

// Supervisor, QA, and Plant Head can all create dispatch entries — widened from v1's
// supervisor-only design (03g §2, 03b).
export function DispatchForm({ options, onSubmit, onCancel }: DispatchFormProps) {
  const { t } = useLanguage()
  const [step, setStep] = useState(0)
  const [partyName, setPartyName] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('')
  const [dispatchDate, setDispatchDate] = useState(todayIsoDate())
  const [lines, setLines] = useState<DispatchLineDraft[]>([])
  const [submitting, setSubmitting] = useState(false)

  const stepOneValid = Boolean(partyName.trim() && invoiceNo.trim() && dispatchDate)
  const stepTwoValid = lines.length > 0

  async function handleSave() {
    if (!stepOneValid || !stepTwoValid) return
    setSubmitting(true)
    try {
      await onSubmit({
        party_name: partyName.trim(),
        invoice_no: invoiceNo.trim(),
        dispatch_date: dispatchDate,
        lines,
      })
      setPartyName('')
      setInvoiceNo('')
      setDispatchDate(todayIsoDate())
      setLines([])
      setStep(0)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText as="h2" en="New Dispatch" hi="नई डिस्पैच" className="text-xl font-bold text-slate-100" />

      <div className="flex gap-2">
        {[0, 1].map((index) => (
          <div key={index} className={`h-2 flex-1 rounded-full ${step >= index ? 'bg-emerald-500' : 'bg-slate-700'}`} />
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <label className="block space-y-2">
            <BilingualText as="span" en="Party name *" hi="पार्टी का नाम" className="font-semibold text-slate-100" />
            <input
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg text-slate-100"
            />
          </label>
          <label className="block space-y-2">
            <BilingualText as="span" en="Invoice no *" hi="इनवॉइस नंबर" className="font-semibold text-slate-100" />
            <input
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg text-slate-100"
            />
          </label>
          <label className="block space-y-2">
            <BilingualText as="span" en="Dispatch date *" hi="डिस्पैच तारीख" className="font-semibold text-slate-100" />
            <input
              type="date"
              value={dispatchDate}
              onChange={(e) => setDispatchDate(e.target.value)}
              className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg text-slate-100"
            />
          </label>
          <div className="flex gap-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="min-h-14 flex-1 rounded-xl border border-slate-600 text-lg font-semibold text-slate-100"
              >
                {t('Cancel', 'रद्द')}
              </button>
            )}
            <button
              type="button"
              disabled={!stepOneValid}
              onClick={() => setStep(1)}
              className="min-h-14 flex-1 rounded-xl bg-emerald-500 text-lg font-semibold text-on-accent disabled:opacity-50"
            >
              {t('Next', 'आगे')}
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <DispatchLineEditor lines={lines} options={options} onChange={setLines} />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="min-h-14 flex-1 rounded-xl border border-slate-600 text-lg font-semibold text-slate-100"
            >
              {t('Back', 'पीछे')}
            </button>
            <button
              type="button"
              disabled={!stepTwoValid || submitting}
              onClick={() => void handleSave()}
              className="min-h-14 flex-1 rounded-xl bg-emerald-500 text-lg font-semibold text-on-accent disabled:opacity-50"
            >
              {t('Save Dispatch', 'डिस्पैच सहेजें')}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

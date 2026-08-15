import { useState } from 'react'
import type { BatchPlan } from '../../types/batchPlan'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface OwnerReviewFormProps {
  plan: BatchPlan | null
  disabled?: boolean
  onSubmit: (note: string | null) => Promise<void>
}

export function OwnerReviewForm({ plan, disabled = false, onSubmit }: OwnerReviewFormProps) {
  const { t } = useLanguage()
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!plan) return null
  if (plan.owner_reviewed) return null

  async function handleAcknowledge() {
    setSubmitting(true)
    try {
      await onSubmit(note.trim() || null)
      setNote('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5">
      <BilingualText
        as="h3"
        en="Acknowledge for Costing"
        hi="लागत के लिए स्वीकृति"
        className="text-lg font-bold text-amber-100"
      />
      <p className="text-sm text-amber-200/80">
        {t('Informational only — does not affect plan usability', 'केवल जानकारी — योजना उपयोग पर असर नहीं')}
      </p>
      <label className="block space-y-2">
        <BilingualText as="span" en="Note (optional)" hi="नोट (वैकल्पिक)" className="font-semibold" />
        <textarea
          value={note}
          disabled={disabled}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-base"
        />
      </label>
      <button
        type="button"
        disabled={disabled || submitting}
        onClick={() => void handleAcknowledge()}
        className="min-h-14 w-full rounded-xl bg-amber-500 text-lg font-semibold text-on-accent disabled:opacity-50"
      >
        {t('Acknowledge', 'स्वीकार करें')}
      </button>
    </section>
  )
}

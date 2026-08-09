import { useState } from 'react'
import type { TempCheckpoint } from '../../types/heat'
import { TEMP_CHECKPOINTS } from '../../types/heat'
import { TEMP_CHECKPOINT_META } from '../../lib/heatLabels'
import { BilingualText } from '../ui/BilingualText'
import { NumericField, parseNumericField } from '../ui/NumericField'

interface TempReadingFormProps {
  disabled?: boolean
  onSubmit: (values: {
    checkpoint: TempCheckpoint
    value: number
    spec_min: number | null
    spec_max: number | null
  }) => Promise<void>
}

export function TempReadingForm({ disabled = false, onSubmit }: TempReadingFormProps) {
  const [checkpoint, setCheckpoint] = useState<TempCheckpoint>('melting')
  const [value, setValue] = useState('')
  const [specMin, setSpecMin] = useState('')
  const [specMax, setSpecMax] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSave() {
    const parsed = parseNumericField(value)
    if (parsed == null) return
    setSubmitting(true)
    try {
      await onSubmit({
        checkpoint,
        value: parsed,
        spec_min: parseNumericField(specMin),
        spec_max: parseNumericField(specMax),
      })
      setValue('')
      setSpecMin('')
      setSpecMax('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText as="h3" en="Temperature Reading" hi="तापमान रीडिंग" className="text-lg font-bold" />

      <label className="block space-y-2">
        <BilingualText as="span" en="Checkpoint" hi="चेकपॉइंट" className="font-semibold" />
        <select
          value={checkpoint}
          disabled={disabled}
          onChange={(e) => setCheckpoint(e.target.value as TempCheckpoint)}
          className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg"
        >
          {TEMP_CHECKPOINTS.map((cp) => (
            <option key={cp} value={cp}>
              {TEMP_CHECKPOINT_META[cp].en} · {TEMP_CHECKPOINT_META[cp].hi}
            </option>
          ))}
        </select>
      </label>

      <NumericField id="temp-value" labelEn="Temperature" labelHi="तापमान" value={value} onChange={setValue} disabled={disabled} required />
      <NumericField id="spec-min" labelEn="Spec min (optional)" labelHi="न्यूनतम" value={specMin} onChange={setSpecMin} disabled={disabled} />
      <NumericField id="spec-max" labelEn="Spec max (optional)" labelHi="अधिकतम" value={specMax} onChange={setSpecMax} disabled={disabled} />

      <button
        type="button"
        disabled={disabled || submitting || parseNumericField(value) == null}
        onClick={() => void handleSave()}
        className="min-h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-slate-950 disabled:opacity-50"
      >
        Save Temp · तापमान सहेजें
      </button>
    </section>
  )
}

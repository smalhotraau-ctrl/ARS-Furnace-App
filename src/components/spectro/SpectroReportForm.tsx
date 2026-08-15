import { useEffect, useMemo, useState } from 'react'
import type { GradeSpecRow } from '../../types/batchPlan'
import type { ChargeLine } from '../../types/heat'
import type { CorrectionSuggestion, ReportType, SpectroCompositionEntry } from '../../types/spectro'
import { buildCompositionEntries } from '../../lib/spectroCalc'
import { CompositionFlagPanel } from './CompositionFlagPanel'
import { BilingualText } from '../ui/BilingualText'
import { NumericField, parseNumericField } from '../ui/NumericField'
import { useLanguage } from '../../context/LanguageContext'

interface SpectroReportFormProps {
  gradeCode: string
  gradeSpecs: GradeSpecRow[]
  disabled?: boolean
  onCompositionChange?: (composition: SpectroCompositionEntry[]) => void
  onSubmit: (values: {
    report_type: ReportType
    composition: SpectroCompositionEntry[]
    sample_time: string
    correction_suggested: CorrectionSuggestion[] | null
  }) => Promise<void>
}

export function SpectroReportForm({
  gradeCode,
  gradeSpecs,
  disabled = false,
  onCompositionChange,
  onSubmit,
}: SpectroReportFormProps) {
  const { t } = useLanguage()
  const [reportType, setReportType] = useState<ReportType>('process')
  const [sampleTime, setSampleTime] = useState(() => new Date().toISOString().slice(0, 16))
  const [actualPcts, setActualPcts] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const elements = useMemo(
    () => gradeSpecs.filter((s) => s.grade_code === gradeCode && s.active).map((s) => s.element),
    [gradeSpecs, gradeCode],
  )

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const el of elements) next[el] = actualPcts[el] ?? ''
    setActualPcts(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements.join(','), gradeCode])

  const composition = useMemo(
    () => buildCompositionEntries(gradeSpecs, gradeCode, actualPcts),
    [gradeSpecs, gradeCode, actualPcts],
  )

  useEffect(() => {
    onCompositionChange?.(composition)
  }, [composition, onCompositionChange])

  const allFilled = elements.every((el) => parseNumericField(actualPcts[el] ?? '') != null)

  async function handleSave(correction: CorrectionSuggestion[] | null) {
    if (!allFilled) return
    setSubmitting(true)
    try {
      await onSubmit({
        report_type: reportType,
        composition,
        sample_time: new Date(sampleTime).toISOString(),
        correction_suggested: correction,
      })
      setActualPcts({})
      setSampleTime(new Date().toISOString().slice(0, 16))
    } finally {
      setSubmitting(false)
    }
  }

  if (elements.length === 0) {
    return (
      <p className="text-slate-400">
        {t('No grade specs available for this heat', 'इस हीट के लिए कोई ग्रेड मानक नहीं')}
      </p>
    )
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText as="h2" en="New Spectro Report" hi="नई स्पेक्ट्रो रिपोर्ट" className="text-xl font-bold" />

      <label className="block space-y-2">
        <BilingualText as="span" en="Report type" hi="रिपोर्ट प्रकार" className="font-semibold" />
        <select
          value={reportType}
          disabled={disabled}
          onChange={(e) => setReportType(e.target.value as ReportType)}
          className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg"
        >
          <option value="process">{t('Process', 'प्रक्रिया')}</option>
          <option value="final">{t('Final', 'अंतिम')}</option>
        </select>
      </label>

      <label className="block space-y-2">
        <BilingualText as="span" en="Sample time" hi="नमूना समय" className="font-semibold" />
        <input
          type="datetime-local"
          value={sampleTime}
          disabled={disabled}
          onChange={(e) => setSampleTime(e.target.value)}
          className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        {elements.map((element) => (
          <NumericField
            key={element}
            id={`spectro-${element}`}
            labelEn={`${element} (%)`}
            labelHi={`${element} (%)`}
            value={actualPcts[element] ?? ''}
            onChange={(v) => setActualPcts((prev) => ({ ...prev, [element]: v }))}
            disabled={disabled}
            required
          />
        ))}
      </div>

      <CompositionFlagPanel composition={composition} />

      <button
        type="button"
        disabled={disabled || submitting || !allFilled}
        onClick={() => void handleSave(null)}
        className="min-h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-on-accent disabled:opacity-50"
      >
        {t('Save Report', 'रिपोर्ट सहेजें')}
      </button>
    </section>
  )
}

export function ChargeLineContext({ lines }: { lines: ChargeLine[] }) {
  const { t } = useLanguage()

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <BilingualText as="h3" en="Charge Lines (context)" hi="चार्ज पंक्तियाँ (संदर्भ)" className="mb-3 font-bold" />
      {lines.length === 0 ? (
        <p className="text-sm text-slate-400">{t('No charge lines', 'कोई चार्ज नहीं')}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {lines.map((line) => (
            <li key={line.id} className="flex justify-between rounded-lg bg-slate-900/50 px-3 py-2">
              <span>{line.material_code}</span>
              <span>{line.net_kg} kg</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

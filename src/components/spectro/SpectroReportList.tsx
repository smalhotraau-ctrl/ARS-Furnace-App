import type { SpectroReport } from '../../types/spectro'
import { CompositionFlagPanel } from './CompositionFlagPanel'
import { CorrectionSuggestionPanel } from './CorrectionSuggestionPanel'
import { useLanguage } from '../../context/LanguageContext'

interface SpectroReportDetailProps {
  report: SpectroReport | null
  canComputeCorrection?: boolean
  meltKg?: number
  computingCorrection?: boolean
  onComputeCorrection?: (report: SpectroReport) => void | Promise<void>
}

interface SpectroReportListProps {
  reports: SpectroReport[]
  selectedId: string | null
  onSelect: (report: SpectroReport) => void
}

export function SpectroReportList({ reports, selectedId, onSelect }: SpectroReportListProps) {
  const { t } = useLanguage()

  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-600 p-6 text-center text-slate-400">
        <p>{t('No spectro reports yet', 'अभी कोई स्पेक्ट्रो रिपोर्ट नहीं')}</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {reports.map((report) => {
        const selected = selectedId === report.id
        const outOfSpec = report.composition.some((e) => e.flag === 'out_of_spec')
        return (
          <li key={report.id}>
            <button
              type="button"
              onClick={() => onSelect(report)}
              className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                selected
                  ? 'border-emerald-500 bg-emerald-950/40'
                  : 'border-slate-700 bg-slate-800/60 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold capitalize text-slate-100">{report.report_type}</p>
                  <p className="text-sm text-slate-400">{new Date(report.sample_time).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                      outOfSpec ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {outOfSpec ? t('Out of spec', 'मानक से बाहर') : t('In spec', 'मानक के अंदर')}
                  </span>
                  {outOfSpec && (
                    <p className="mt-1 text-xs text-slate-500">
                      {t('Select to compute correction', 'सुधार गणना के लिए चुनें')}
                    </p>
                  )}
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function SpectroReportDetail({
  report,
  canComputeCorrection = false,
  meltKg = 0,
  computingCorrection = false,
  onComputeCorrection,
}: SpectroReportDetailProps) {
  const { t } = useLanguage()

  if (!report) return null

  const outOfSpec = report.composition.some((e) => e.flag === 'out_of_spec')

  return (
    <section className="space-y-4 rounded-2xl border border-slate-700 bg-slate-800/60 p-5">
      <p className="text-lg font-bold capitalize text-emerald-400">{report.report_type}</p>
      <p className="text-sm text-slate-400">{new Date(report.sample_time).toLocaleString()}</p>
      <CompositionFlagPanel composition={report.composition} />

      {canComputeCorrection && onComputeCorrection ? (
        <CorrectionSuggestionPanel
          suggestions={report.correction_suggested}
          meltKg={meltKg}
          loading={computingCorrection}
          disabled={!outOfSpec}
          contextNote={t(
            'Applies to this saved report',
            'इस सहेजी गई रिपोर्ट पर लागू',
          )}
          onRequest={() => void onComputeCorrection?.(report)}
        />
      ) : (
        report.correction_suggested &&
        report.correction_suggested.length > 0 && (
          <div>
            <p className="mb-2 font-semibold">{t('Correction suggestion', 'सुधार सुझाव')}</p>
            <ul className="space-y-1 text-sm">
              {report.correction_suggested.map((s, i) => (
                <li key={i}>
                  {s.material_code}: {s.suggested_kg} kg
                </li>
              ))}
            </ul>
          </div>
        )
      )}
    </section>
  )
}

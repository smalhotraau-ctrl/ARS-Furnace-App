import type { PitHeat } from '../../types/pitFurnace'
import type { SpectroReport } from '../../types/spectro'
import { isCompositionOutOfSpec } from '../../lib/spectroCalc'
import { BilingualText } from '../ui/BilingualText'
import { StatCard } from './StatCard'
import { useLanguage } from '../../context/LanguageContext'

interface FlaggedSpectroReport {
  report: SpectroReport
  heatNo: string
}

interface QADashboardProps {
  flaggedReports: FlaggedSpectroReport[]
  pitQualityPending: PitHeat[]
  spectroQueue: FlaggedSpectroReport[]
}

export function QADashboard({ flaggedReports, pitQualityPending, spectroQueue }: QADashboardProps) {
  const { t } = useLanguage()

  return (
    <div className="space-y-6">
      <StatCard
        labelEn="Composition flags awaiting action"
        labelHi="कार्रवाई प्रतीक्षित संरचना फ्लैग"
        value={flaggedReports.length}
        tone={flaggedReports.length > 0 ? 'danger' : 'success'}
        sublabelEn={flaggedReports.length > 0 ? 'Out-of-spec spectro reports' : 'All clear'}
        sublabelHi={flaggedReports.length > 0 ? 'स्पेक से बाहर स्पेक्ट्रो रिपोर्ट' : 'सब ठीक'}
      />

      <section className="space-y-3">
        <BilingualText
          as="h2"
          en="Out-of-spec reports"
          hi="स्पेक से बाहर रिपोर्ट"
          className="text-lg font-bold text-slate-200"
        />
        {flaggedReports.length === 0 ? (
          <p className="rounded-2xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-6 text-center text-emerald-200">
            {t('No composition flags right now.', 'अभी कोई संरचना फ्लैग नहीं।')}
          </p>
        ) : (
          <ul className="space-y-3">
            {flaggedReports.slice(0, 8).map(({ report, heatNo }) => (
              <li
                key={report.id}
                className="rounded-2xl border-2 border-rose-500/60 bg-rose-950/30 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xl font-bold text-rose-100">{heatNo}</p>
                    <p className="text-sm capitalize text-rose-200/80">{report.report_type}</p>
                  </div>
                  <span className="rounded-full bg-rose-500 px-3 py-1 text-sm font-extrabold text-on-accent">
                    {t('Out of spec', 'स्पेक से बाहर')}
                  </span>
                </div>
                <p className="mt-2 text-xs text-rose-200/70">
                  {new Date(report.sample_time).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <StatCard
        labelEn="Pit quality pending"
        labelHi="पिट गुणवत्ता लंबित"
        value={pitQualityPending.length}
        tone={pitQualityPending.length > 0 ? 'warning' : 'neutral'}
      />

      {pitQualityPending.length > 0 && (
        <ul className="space-y-2">
          {pitQualityPending.slice(0, 6).map((heat) => (
            <li key={heat.id} className="rounded-xl border border-amber-500/50 bg-amber-950/25 px-4 py-3">
              <p className="font-bold text-amber-100">{heat.heat_no}</p>
              <p className="text-sm text-amber-200/80">
                {heat.date} · {heat.weight_kg.toFixed(0)} kg
              </p>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3">
        <BilingualText as="h2" en="Spectro queue" hi="स्पेक्ट्रो कतार" className="text-lg font-bold text-slate-200" />
        {spectroQueue.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-600 px-4 py-6 text-center text-slate-400">
            {t('No recent spectro samples on active heats.', 'सक्रिय हीट पर कोई हालिया स्पेक्ट्रो नमूना नहीं।')}
          </p>
        ) : (
          <ul className="space-y-2">
            {spectroQueue.slice(0, 8).map(({ report, heatNo }) => {
              const outOfSpec = report.composition.some((e) => isCompositionOutOfSpec(e))
              return (
                <li
                  key={report.id}
                  className={`rounded-xl border px-4 py-3 ${
                    outOfSpec ? 'border-rose-500/50 bg-rose-950/20' : 'border-slate-700 bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-100">{heatNo}</p>
                    <span
                      className={`text-xs font-bold uppercase ${
                        outOfSpec ? 'text-rose-300' : 'text-emerald-300'
                      }`}
                    >
                      {outOfSpec ? t('Action needed', 'कार्रवाई चाहिए') : t('In spec', 'स्पेक में')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 capitalize">
                    {report.report_type} · {new Date(report.sample_time).toLocaleString()}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

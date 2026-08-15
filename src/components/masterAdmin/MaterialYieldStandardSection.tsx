import { useMemo, useState } from 'react'
import type {
  Material,
  MaterialYieldStandardCreatePayload,
  MaterialYieldStandardRow,
  MaterialYieldStandardUpdatePayload,
  YieldMetric,
} from '../../types/masterAdmin'
import { YIELD_METRICS, YIELD_METRIC_LABELS } from '../../types/masterAdmin'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'
import { NumericField, parseNumericField } from '../ui/NumericField'

interface MaterialYieldStandardSectionProps {
  rows: MaterialYieldStandardRow[]
  materials: Material[]
  canPropose: boolean
  autoApproved: boolean
  onCreate: (payload: MaterialYieldStandardCreatePayload) => Promise<void>
  onUpdate: (rowId: string, payload: MaterialYieldStandardUpdatePayload) => Promise<void>
}

export function MaterialYieldStandardSection({
  rows,
  materials,
  canPropose,
  autoApproved,
  onCreate,
  onUpdate,
}: MaterialYieldStandardSectionProps) {
  const { t } = useLanguage()
  const [adding, setAdding] = useState(false)
  const [materialCode, setMaterialCode] = useState('')
  const [metric, setMetric] = useState<YieldMetric>('ingot_pct')
  const [minPct, setMinPct] = useState('')
  const [maxPct, setMaxPct] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMin, setEditMin] = useState('')
  const [editMax, setEditMax] = useState('')

  const byMaterial = useMemo(() => {
    const map = new Map<string, MaterialYieldStandardRow[]>()
    for (const row of rows) {
      const list = map.get(row.material_code) ?? []
      list.push(row)
      map.set(row.material_code, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [rows])

  const canSubmit = materialCode.trim().length > 0 && parseNumericField(minPct) != null && parseNumericField(maxPct) != null

  async function submit() {
    const min = parseNumericField(minPct)
    const max = parseNumericField(maxPct)
    if (!materialCode.trim() || min == null || max == null) return
    setSubmitting(true)
    try {
      await onCreate({ material_code: materialCode, metric, min_pct: min, max_pct: max })
      setMaterialCode('')
      setMetric('ingot_pct')
      setMinPct('')
      setMaxPct('')
      setAdding(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <BilingualText
          as="h2"
          en="Material Yield Standards"
          hi="मैटेरियल यील्ड स्टैंडर्ड"
          className="text-lg font-semibold text-slate-100"
        />
        {canPropose && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300"
          >
            {t('Add standard', 'स्टैंडर्ड जोड़ें')}
          </button>
        )}
      </div>

      {!autoApproved && canPropose && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2 text-sm text-amber-200">
          {t(
            'Changes need Owner approval before they take effect.',
            'बदलावों को लागू होने से पहले मालिक की स्वीकृति आवश्यक है।',
          )}
        </p>
      )}

      {adding && (
        <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
          <label className="block space-y-2">
            <BilingualText as="span" en="Material *" hi="मैटेरियल *" className="font-semibold" />
            <select
              value={materialCode}
              onChange={(e) => setMaterialCode(e.target.value)}
              className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
            >
              <option value="">{t('Select material', 'मैटेरियल चुनें')}</option>
              {materials.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.code} — {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <BilingualText as="span" en="Metric *" hi="मेट्रिक *" className="font-semibold" />
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as YieldMetric)}
              className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
            >
              {YIELD_METRICS.map((m) => (
                <option key={m} value={m}>
                  {t(YIELD_METRIC_LABELS[m].en, YIELD_METRIC_LABELS[m].hi)}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <NumericField id="yield-min" labelEn="Min %" labelHi="न्यूनतम %" value={minPct} onChange={setMinPct} required />
            <NumericField id="yield-max" labelEn="Max %" labelHi="अधिकतम %" value={maxPct} onChange={setMaxPct} required />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="flex-1 min-h-12 rounded-xl border border-slate-600 text-sm font-semibold text-slate-300"
            >
              {t('Cancel', 'रद्द करें')}
            </button>
            <button
              type="button"
              disabled={!canSubmit || submitting}
              onClick={() => void submit()}
              className="flex-1 min-h-12 rounded-xl bg-emerald-500 text-sm font-semibold text-slate-950 disabled:opacity-50"
            >
              {t('Submit', 'भेजें')}
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {byMaterial.map(([code, materialRows]) => (
          <li key={code} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
            <p className="mb-2 font-semibold text-slate-100">{code}</p>
            <ul className="space-y-1 text-sm text-slate-300">
              {materialRows.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  {editingId === r.id ? (
                    <div className="flex w-full items-center gap-2">
                      <span className="w-28 shrink-0">{t(YIELD_METRIC_LABELS[r.metric].en, YIELD_METRIC_LABELS[r.metric].hi)}</span>
                      <input
                        value={editMin}
                        onChange={(e) => setEditMin(e.target.value.replace(/[^\d.]/g, ''))}
                        className="w-16 min-h-9 rounded-lg border border-slate-600 bg-slate-900 px-2"
                      />
                      <span>–</span>
                      <input
                        value={editMax}
                        onChange={(e) => setEditMax(e.target.value.replace(/[^\d.]/g, ''))}
                        className="w-16 min-h-9 rounded-lg border border-slate-600 bg-slate-900 px-2"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void onUpdate(r.id, { min_pct: Number(editMin), max_pct: Number(editMax) }).then(() =>
                            setEditingId(null),
                          )
                        }
                        className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-semibold text-slate-950"
                      >
                        {t('Save', 'सहेजें')}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-xs text-slate-400">
                        {t('Cancel', 'रद्द करें')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>
                        {t(YIELD_METRIC_LABELS[r.metric].en, YIELD_METRIC_LABELS[r.metric].hi)}: {r.min_pct}–{r.max_pct}%
                        {!r.active && ` (${t('inactive', 'निष्क्रिय')})`}
                      </span>
                      {canPropose && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(r.id)
                              setEditMin(String(r.min_pct))
                              setEditMax(String(r.max_pct))
                            }}
                            className="text-xs font-semibold text-slate-400 hover:text-slate-200"
                          >
                            {t('Edit', 'संपादित करें')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void onUpdate(r.id, { active: !r.active })}
                            className={`text-xs font-semibold ${r.active ? 'text-red-300' : 'text-emerald-300'}`}
                          >
                            {r.active ? t('Deactivate', 'निष्क्रिय करें') : t('Reactivate', 'पुनः सक्रिय करें')}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
        {byMaterial.length === 0 && (
          <p className="text-sm text-slate-400">{t('No yield standards yet', 'अभी कोई यील्ड स्टैंडर्ड नहीं')}</p>
        )}
      </ul>
    </section>
  )
}

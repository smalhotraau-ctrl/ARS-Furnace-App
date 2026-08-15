import { useMemo, useState } from 'react'
import type { GradeSpecCreatePayload, GradeSpecElementInput, GradeSpecRow } from '../../types/masterAdmin'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'
import { NumericField, parseNumericField } from '../ui/NumericField'

interface GradeSpecSectionProps {
  gradeSpecs: GradeSpecRow[]
  canPropose: boolean
  autoApproved: boolean
  onCreate: (payload: GradeSpecCreatePayload) => Promise<void>
}

export function GradeSpecSection({ gradeSpecs, canPropose, autoApproved, onCreate }: GradeSpecSectionProps) {
  const { t } = useLanguage()
  const [adding, setAdding] = useState(false)
  const [gradeCode, setGradeCode] = useState('')
  const [supersedes, setSupersedes] = useState('')
  const [elements, setElements] = useState<GradeSpecElementInput[]>([])
  const [element, setElement] = useState('')
  const [minPct, setMinPct] = useState('')
  const [maxPct, setMaxPct] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const byGrade = useMemo(() => {
    const map = new Map<string, GradeSpecRow[]>()
    for (const row of gradeSpecs) {
      const list = map.get(row.grade_code) ?? []
      list.push(row)
      map.set(row.grade_code, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [gradeSpecs])

  const activeGradeCodes = useMemo(
    () => [...new Set(gradeSpecs.filter((g) => g.active).map((g) => g.grade_code))].sort(),
    [gradeSpecs],
  )

  function gradeCodeForId(id: string | null): string | null {
    if (!id) return null
    return gradeSpecs.find((g) => g.id === id)?.grade_code ?? null
  }

  function addElement() {
    const min = parseNumericField(minPct)
    const max = parseNumericField(maxPct)
    if (!element.trim() || min == null || max == null) return
    setElements([...elements, { element: element.trim(), min_pct: min, max_pct: max }])
    setElement('')
    setMinPct('')
    setMaxPct('')
  }

  function removeElement(index: number) {
    setElements(elements.filter((_, i) => i !== index))
  }

  const canSubmit = gradeCode.trim().length > 0 && elements.length > 0

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onCreate({
        grade_code: gradeCode.trim().toUpperCase(),
        elements,
        supersedes_grade_code: supersedes || null,
      })
      setGradeCode('')
      setSupersedes('')
      setElements([])
      setAdding(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <BilingualText as="h2" en="Grade Specs" hi="ग्रेड स्पेक" className="text-lg font-semibold text-slate-100" />
        {canPropose && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300"
          >
            {t('New grade / re-spec', 'नया ग्रेड / री-स्पेक')}
          </button>
        )}
      </div>

      <p className="text-sm text-slate-400">
        {t(
          'Grade specs are permanent once created. A re-spec always creates a brand new grade code — it never edits an existing one.',
          'ग्रेड स्पेक बनने के बाद स्थायी होते हैं। री-स्पेक हमेशा नया ग्रेड कोड बनाता है — मौजूदा को कभी संपादित नहीं करता।',
        )}
      </p>

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
            <BilingualText as="span" en="New grade code *" hi="नया ग्रेड कोड *" className="font-semibold" />
            <input
              value={gradeCode}
              onChange={(e) => setGradeCode(e.target.value)}
              placeholder="e.g. BG-14"
              className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4 uppercase"
            />
          </label>
          <label className="block space-y-2">
            <BilingualText
              as="span"
              en="Supersedes existing grade (optional)"
              hi="मौजूदा ग्रेड बदलें (वैकल्पिक)"
              className="font-semibold"
            />
            <select
              value={supersedes}
              onChange={(e) => setSupersedes(e.target.value)}
              className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
            >
              <option value="">{t('None — brand new grade', 'कोई नहीं — नया ग्रेड')}</option>
              {activeGradeCodes.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/40 p-3">
            <BilingualText as="span" en="Element" hi="तत्व" className="text-sm font-semibold text-slate-300" />
            <input
              value={element}
              onChange={(e) => setElement(e.target.value)}
              placeholder="e.g. Si"
              className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
            />
            <div className="grid grid-cols-2 gap-3">
              <NumericField id="min-pct" labelEn="Min %" labelHi="न्यूनतम %" value={minPct} onChange={setMinPct} />
              <NumericField id="max-pct" labelEn="Max %" labelHi="अधिकतम %" value={maxPct} onChange={setMaxPct} />
            </div>
            <button
              type="button"
              onClick={addElement}
              disabled={!element.trim() || parseNumericField(minPct) == null || parseNumericField(maxPct) == null}
              className="min-h-10 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-sm font-semibold text-emerald-300 disabled:opacity-50"
            >
              {t('Add element', 'तत्व जोड़ें')}
            </button>
          </div>

          {elements.length > 0 && (
            <ul className="space-y-1">
              {elements.map((el, index) => (
                <li
                  key={`${el.element}-${index}`}
                  className="flex items-center justify-between rounded-lg bg-slate-800 px-3 py-2 text-sm"
                >
                  <span>
                    {el.element}: {el.min_pct}–{el.max_pct}%
                  </span>
                  <button type="button" onClick={() => removeElement(index)} className="text-red-300">
                    {t('Remove', 'हटाएं')}
                  </button>
                </li>
              ))}
            </ul>
          )}

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
        {byGrade.map(([code, rows]) => {
          const isActive = rows.some((r) => r.active)
          const supersededByCode = gradeCodeForId(rows[0]?.superseded_by ?? null)
          return (
            <li
              key={code}
              className={`rounded-xl border p-4 ${
                isActive ? 'border-slate-700 bg-slate-800/60' : 'border-slate-800 bg-slate-900/40 opacity-70'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-slate-100">{code}</p>
                {isActive ? (
                  <span className="text-xs font-semibold text-emerald-400">{t('Active', 'सक्रिय')}</span>
                ) : (
                  <span className="text-xs font-semibold text-red-400">
                    {supersededByCode
                      ? t(`Replaced by ${supersededByCode}`, `${supersededByCode} द्वारा बदला गया`)
                      : t('Superseded', 'बदला गया')}
                  </span>
                )}
              </div>
              <ul className="space-y-1 text-sm text-slate-300">
                {rows.map((r) => (
                  <li key={r.id}>
                    {r.element}: {r.min_pct}–{r.max_pct}%
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
        {byGrade.length === 0 && (
          <p className="text-sm text-slate-400">{t('No grade specs yet', 'अभी कोई ग्रेड स्पेक नहीं')}</p>
        )}
      </ul>
    </section>
  )
}

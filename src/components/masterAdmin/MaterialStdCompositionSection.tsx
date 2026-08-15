import { useMemo, useState } from 'react'
import type {
  Material,
  MaterialStdCompositionCreatePayload,
  MaterialStdCompositionElementInput,
  MaterialStdCompositionRow,
  MaterialStdCompositionUpdatePayload,
} from '../../types/masterAdmin'
import { BilingualText } from '../ui/BilingualText'
import { DeskTd, DesktopTable } from '../ui/DesktopTable'
import { useLanguage } from '../../context/LanguageContext'
import { NumericField, parseNumericField } from '../ui/NumericField'

interface MaterialStdCompositionSectionProps {
  rows: MaterialStdCompositionRow[]
  materials: Material[]
  canPropose: boolean
  autoApproved: boolean
  onCreate: (payload: MaterialStdCompositionCreatePayload) => Promise<void>
  onUpdate: (rowId: string, payload: MaterialStdCompositionUpdatePayload) => Promise<void>
}

export function MaterialStdCompositionSection({
  rows,
  materials,
  canPropose,
  autoApproved,
  onCreate,
  onUpdate,
}: MaterialStdCompositionSectionProps) {
  const { t } = useLanguage()
  const [adding, setAdding] = useState(false)
  const [materialCode, setMaterialCode] = useState('')
  const [elements, setElements] = useState<MaterialStdCompositionElementInput[]>([])
  const [element, setElement] = useState('')
  const [stdPct, setStdPct] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editStdPct, setEditStdPct] = useState('')

  const byMaterial = useMemo(() => {
    const map = new Map<string, MaterialStdCompositionRow[]>()
    for (const row of rows) {
      const list = map.get(row.material_code) ?? []
      list.push(row)
      map.set(row.material_code, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [rows])

  function addElement() {
    const pct = parseNumericField(stdPct)
    if (!element.trim() || pct == null) return
    setElements([...elements, { element: element.trim(), std_pct: pct }])
    setElement('')
    setStdPct('')
  }

  function removeElement(index: number) {
    setElements(elements.filter((_, i) => i !== index))
  }

  const canSubmit = materialCode.trim().length > 0 && elements.length > 0

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onCreate({ material_code: materialCode, elements })
      setMaterialCode('')
      setElements([])
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
          en="Material Std. Composition"
          hi="मैटेरियल स्टैंडर्ड संरचना"
          className="text-lg font-semibold text-slate-100"
        />
        {canPropose && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300"
          >
            {t('Add composition', 'संरचना जोड़ें')}
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

          <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-800/40 p-3 lg:grid lg:grid-cols-[1fr_1fr_auto] lg:items-end lg:gap-3 lg:space-y-0">
            <label className="block space-y-2">
              <BilingualText as="span" en="Element" hi="तत्व" className="text-sm font-semibold text-slate-300" />
              <input
                value={element}
                onChange={(e) => setElement(e.target.value)}
                placeholder="e.g. Fe"
                className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
              />
            </label>
            <NumericField id="std-pct" labelEn="Std %" labelHi="स्टैंडर्ड %" value={stdPct} onChange={setStdPct} />
            <button
              type="button"
              onClick={addElement}
              disabled={!element.trim() || parseNumericField(stdPct) == null}
              className="min-h-10 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300 disabled:opacity-50 lg:min-h-12"
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
                    {el.element}: {el.std_pct}%
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
              className="flex-1 min-h-12 rounded-xl bg-emerald-500 text-sm font-semibold text-on-accent disabled:opacity-50"
            >
              {t('Submit', 'भेजें')}
            </button>
          </div>
        </div>
      )}

      {byMaterial.length === 0 && (
        <p className="text-sm text-slate-400">{t('No composition data yet', 'अभी कोई संरचना डेटा नहीं')}</p>
      )}

      <ul className="space-y-3 lg:hidden">
        {byMaterial.map(([code, materialRows]) => (
          <li key={code} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
            <p className="mb-2 font-semibold text-slate-100">{code}</p>
            <ul className="space-y-1 text-sm text-slate-300">
              {materialRows.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  {editingId === r.id ? (
                    <div className="flex w-full items-center gap-2">
                      <span className="w-16">{r.element}</span>
                      <input
                        value={editStdPct}
                        onChange={(e) => setEditStdPct(e.target.value.replace(/[^\d.]/g, ''))}
                        className="flex-1 min-h-9 rounded-lg border border-slate-600 bg-slate-900 px-2"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void onUpdate(r.id, { std_pct: Number(editStdPct) }).then(() => setEditingId(null))
                        }
                        className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-semibold text-on-accent"
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
                        {r.element}: {r.std_pct}%
                      </span>
                      {canPropose && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(r.id)
                            setEditStdPct(String(r.std_pct))
                          }}
                          className="text-xs font-semibold text-slate-400 hover:text-slate-200"
                        >
                          {t('Edit', 'संपादित करें')}
                        </button>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {byMaterial.length > 0 && (
        <DesktopTable
          columns={[
            t('Material', 'मैटेरियल'),
            t('Element', 'तत्व'),
            t('Std %', 'स्टैंडर्ड %'),
            ...(canPropose ? [t('Actions', 'कार्रवाई')] : []),
          ]}
        >
          {byMaterial.flatMap(([code, materialRows]) =>
            materialRows.map((r, i) => (
              <tr key={r.id} className="hover:bg-slate-800/40">
                <DeskTd className="font-semibold text-slate-100">{i === 0 ? code : ''}</DeskTd>
                <DeskTd>{r.element}</DeskTd>
                <DeskTd>
                  {editingId === r.id ? (
                    <input
                      value={editStdPct}
                      onChange={(e) => setEditStdPct(e.target.value.replace(/[^\d.]/g, ''))}
                      className="w-24 min-h-10 rounded-lg border border-slate-600 bg-slate-900 px-2"
                    />
                  ) : (
                    `${r.std_pct}%`
                  )}
                </DeskTd>
                {canPropose && (
                  <DeskTd>
                    {editingId === r.id ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void onUpdate(r.id, { std_pct: Number(editStdPct) }).then(() => setEditingId(null))
                          }
                          className="min-h-10 rounded-lg bg-emerald-500 px-3 text-sm font-semibold text-on-accent"
                        >
                          {t('Save', 'सहेजें')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="min-h-10 text-sm text-slate-400"
                        >
                          {t('Cancel', 'रद्द करें')}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(r.id)
                          setEditStdPct(String(r.std_pct))
                        }}
                        className="min-h-10 text-sm font-semibold text-slate-400 hover:text-slate-200"
                      >
                        {t('Edit', 'संपादित करें')}
                      </button>
                    )}
                  </DeskTd>
                )}
              </tr>
            )),
          )}
        </DesktopTable>
      )}
    </section>
  )
}

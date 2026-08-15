import { useState } from 'react'
import type { Material, MaterialCreatePayload, MaterialUpdatePayload } from '../../types/masterAdmin'
import { BilingualText } from '../ui/BilingualText'
import { DeskTd, DesktopTable } from '../ui/DesktopTable'
import { useLanguage } from '../../context/LanguageContext'

interface MaterialSectionProps {
  materials: Material[]
  canPropose: boolean
  autoApproved: boolean
  onCreate: (payload: MaterialCreatePayload) => Promise<void>
  onUpdate: (materialId: string, payload: MaterialUpdatePayload) => Promise<void>
}

export function MaterialSection({ materials, canPropose, autoApproved, onCreate, onUpdate }: MaterialSectionProps) {
  const { t } = useLanguage()
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const canSubmit = code.trim() && name.trim()

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onCreate({ code: code.trim().toUpperCase(), name: name.trim() })
      setCode('')
      setName('')
      setAdding(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <BilingualText as="h2" en="Materials" hi="मैटेरियल" className="text-lg font-semibold text-slate-100" />
        {canPropose && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300"
          >
            {t('Add material', 'मैटेरियल जोड़ें')}
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
          <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            <label className="block space-y-2">
              <BilingualText as="span" en="Code *" hi="कोड *" className="font-semibold" />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. INGOT"
                className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4 uppercase"
              />
            </label>
            <label className="block space-y-2">
              <BilingualText as="span" en="Name *" hi="नाम *" className="font-semibold" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
              />
            </label>
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
              className="flex-1 min-h-12 rounded-xl bg-emerald-500 text-sm font-semibold text-on-accent disabled:opacity-50"
            >
              {t('Submit', 'भेजें')}
            </button>
          </div>
        </div>
      )}

      {materials.length === 0 && <p className="text-sm text-slate-400">{t('No materials yet', 'अभी कोई मैटेरियल नहीं')}</p>}

      <ul className="space-y-2 lg:hidden">
        {materials.map((m) => (
          <li key={m.id} className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
            {editingId === m.id ? (
              <div className="flex items-center gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 min-h-10 rounded-lg border border-slate-600 bg-slate-900 px-3"
                />
                <button
                  type="button"
                  onClick={() => void onUpdate(m.id, { name: editName.trim() }).then(() => setEditingId(null))}
                  disabled={!editName.trim()}
                  className="min-h-10 rounded-lg bg-emerald-500 px-3 text-sm font-semibold text-on-accent disabled:opacity-50"
                >
                  {t('Save', 'सहेजें')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="min-h-10 rounded-lg border border-slate-600 px-3 text-sm text-slate-300"
                >
                  {t('Cancel', 'रद्द करें')}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-100">
                    {m.code} — {m.name}
                  </p>
                  <p className="text-sm">
                    {m.active ? (
                      <span className="text-emerald-400">{t('Active', 'सक्रिय')}</span>
                    ) : (
                      <span className="text-red-400">{t('Deactivated', 'निष्क्रिय')}</span>
                    )}
                  </p>
                </div>
                {canPropose && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(m.id)
                        setEditName(m.name)
                      }}
                      className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-300 hover:bg-slate-700"
                    >
                      {t('Rename', 'नाम बदलें')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onUpdate(m.id, { active: !m.active })}
                      className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${
                        m.active ? 'text-red-300 hover:bg-red-950/40' : 'text-emerald-300 hover:bg-emerald-950/40'
                      }`}
                    >
                      {m.active ? t('Deactivate', 'निष्क्रिय करें') : t('Reactivate', 'पुनः सक्रिय करें')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {materials.length > 0 && (
        <DesktopTable
          columns={[
            t('Code', 'कोड'),
            t('Name', 'नाम'),
            t('Status', 'स्थिति'),
            ...(canPropose ? [t('Actions', 'कार्रवाई')] : []),
          ]}
        >
          {materials.map((m) => (
            <tr key={m.id} className="hover:bg-slate-800/40">
              <DeskTd className="font-semibold text-slate-100">{m.code}</DeskTd>
              <DeskTd>
                {editingId === m.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full min-h-10 rounded-lg border border-slate-600 bg-slate-900 px-3"
                  />
                ) : (
                  m.name
                )}
              </DeskTd>
              <DeskTd>
                {m.active ? (
                  <span className="text-emerald-400">{t('Active', 'सक्रिय')}</span>
                ) : (
                  <span className="text-red-400">{t('Deactivated', 'निष्क्रिय')}</span>
                )}
              </DeskTd>
              {canPropose && (
                <DeskTd>
                  <div className="flex gap-1">
                    {editingId === m.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void onUpdate(m.id, { name: editName.trim() }).then(() => setEditingId(null))}
                          disabled={!editName.trim()}
                          className="min-h-10 rounded-lg bg-emerald-500 px-3 text-sm font-semibold text-on-accent disabled:opacity-50"
                        >
                          {t('Save', 'सहेजें')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="min-h-10 rounded-lg border border-slate-600 px-3 text-sm text-slate-300"
                        >
                          {t('Cancel', 'रद्द करें')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(m.id)
                            setEditName(m.name)
                          }}
                          className="min-h-10 rounded-lg px-3 text-sm font-semibold text-slate-300 hover:bg-slate-700"
                        >
                          {t('Rename', 'नाम बदलें')}
                        </button>
                        <button
                          type="button"
                          onClick={() => void onUpdate(m.id, { active: !m.active })}
                          className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${
                            m.active ? 'text-red-300 hover:bg-red-950/40' : 'text-emerald-300 hover:bg-emerald-950/40'
                          }`}
                        >
                          {m.active ? t('Deactivate', 'निष्क्रिय करें') : t('Reactivate', 'पुनः सक्रिय करें')}
                        </button>
                      </>
                    )}
                  </div>
                </DeskTd>
              )}
            </tr>
          ))}
        </DesktopTable>
      )}
    </section>
  )
}

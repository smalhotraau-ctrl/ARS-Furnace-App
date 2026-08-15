import { useState } from 'react'
import type { Furnace, FurnaceCreatePayload, FurnaceUpdatePayload } from '../../types/masterAdmin'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface FurnaceSectionProps {
  furnaces: Furnace[]
  canPropose: boolean
  autoApproved: boolean
  onCreate: (payload: FurnaceCreatePayload) => Promise<void>
  onUpdate: (furnaceId: string, payload: FurnaceUpdatePayload) => Promise<void>
}

export function FurnaceSection({ furnaces, canPropose, autoApproved, onCreate, onUpdate }: FurnaceSectionProps) {
  const { t } = useLanguage()
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'main' | 'pit'>('main')
  const [heatCodeLetter, setHeatCodeLetter] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = code.trim() && name.trim() && (type === 'pit' || heatCodeLetter.trim().length === 1)

  async function submit() {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onCreate({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        type,
        heat_code_letter: type === 'main' ? heatCodeLetter.trim().toUpperCase() : null,
      })
      setCode('')
      setName('')
      setType('main')
      setHeatCodeLetter('')
      setAdding(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <BilingualText as="h2" en="Furnaces" hi="फर्नेस" className="text-lg font-semibold text-slate-100" />
        {canPropose && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300"
          >
            {t('Add furnace', 'फर्नेस जोड़ें')}
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
            <BilingualText as="span" en="Code *" hi="कोड *" className="font-semibold" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. SF-02"
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
          <label className="block space-y-2">
            <BilingualText as="span" en="Type *" hi="प्रकार *" className="font-semibold" />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'main' | 'pit')}
              className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
            >
              <option value="main">{t('Main', 'मुख्य')}</option>
              <option value="pit">{t('Pit', 'पिट')}</option>
            </select>
          </label>
          {type === 'main' && (
            <label className="block space-y-2">
              <BilingualText as="span" en="Heat code letter *" hi="हीट कोड अक्षर *" className="font-semibold" />
              <input
                value={heatCodeLetter}
                maxLength={1}
                onChange={(e) => setHeatCodeLetter(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                placeholder="A"
                className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4 uppercase"
              />
              <p className="text-xs text-slate-400">
                {t('Used to build this furnace’s heat numbers.', 'इस फर्नेस के हीट नंबर बनाने में उपयोग होता है।')}
              </p>
            </label>
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

      <ul className="space-y-2">
        {furnaces.map((f) => (
          <li
            key={f.id}
            className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3"
          >
            <div>
              <p className="font-semibold text-slate-100">
                {f.code} — {f.name}
              </p>
              <p className="text-sm text-slate-400">
                {t(f.type === 'main' ? 'Main' : 'Pit', f.type === 'main' ? 'मुख्य' : 'पिट')}
                {f.heat_code_letter ? ` · ${t('letter', 'अक्षर')}: ${f.heat_code_letter}` : ''}
                {' · '}
                {f.active ? (
                  <span className="text-emerald-400">{t('Active', 'सक्रिय')}</span>
                ) : (
                  <span className="text-red-400">{t('Deactivated', 'निष्क्रिय')}</span>
                )}
              </p>
            </div>
            {canPropose && (
              <button
                type="button"
                onClick={() => void onUpdate(f.id, { active: !f.active })}
                className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${
                  f.active ? 'text-red-300 hover:bg-red-950/40' : 'text-emerald-300 hover:bg-emerald-950/40'
                }`}
              >
                {f.active ? t('Deactivate', 'निष्क्रिय करें') : t('Reactivate', 'पुनः सक्रिय करें')}
              </button>
            )}
          </li>
        ))}
        {furnaces.length === 0 && <p className="text-sm text-slate-400">{t('No furnaces yet', 'अभी कोई फर्नेस नहीं')}</p>}
      </ul>
    </section>
  )
}

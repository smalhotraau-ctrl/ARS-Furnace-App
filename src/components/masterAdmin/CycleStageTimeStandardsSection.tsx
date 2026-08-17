import { useState } from 'react'
import { CYCLE_STAGES } from '../../types/heat'
import { CYCLE_STAGE_META } from '../../lib/heatLabels'
import type {
  CycleStageTimeStandardCreatePayload,
  CycleStageTimeStandardRow,
  CycleStageTimeStandardUpdatePayload,
} from '../../types/cycleTime'
import type { CycleStage } from '../../types/heat'
import { BilingualText } from '../ui/BilingualText'
import { DeskTd, DesktopTable } from '../ui/DesktopTable'
import { useLanguage } from '../../context/LanguageContext'
import { parseNumericField } from '../ui/NumericField'

interface CycleStageTimeStandardsSectionProps {
  rows: CycleStageTimeStandardRow[]
  canPropose: boolean
  autoApproved: boolean
  onCreate: (payload: CycleStageTimeStandardCreatePayload) => Promise<void>
  onUpdate: (rowId: string, payload: CycleStageTimeStandardUpdatePayload) => Promise<void>
}

export function CycleStageTimeStandardsSection({
  rows,
  canPropose,
  autoApproved,
  onCreate,
  onUpdate,
}: CycleStageTimeStandardsSectionProps) {
  const { t } = useLanguage()
  const [editingStage, setEditingStage] = useState<CycleStage | null>(null)
  const [editMinutes, setEditMinutes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const byStage = new Map(rows.map((r) => [r.stage, r]))

  async function saveStage(stage: CycleStage) {
    const minutes = parseNumericField(editMinutes)
    if (minutes == null || minutes <= 0) return
    setSubmitting(true)
    try {
      const existing = byStage.get(stage)
      if (existing) {
        await onUpdate(existing.id, { target_minutes: minutes })
      } else {
        await onCreate({ stage, target_minutes: minutes })
      }
      setEditingStage(null)
      setEditMinutes('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4">
      <BilingualText
        as="h2"
        en="Cycle Stage Time Standards"
        hi="साइकिल चरण समय मानक"
        className="text-lg font-semibold text-slate-100"
      />
      <p className="text-sm text-slate-400">
        {t(
          'Designated target duration per cycle stage — shown as a nudge on the floor, flags when exceeded.',
          'प्रत्येक साइकिल चरण के लिए लक्ष्य अवधि — फ्लोर पर संकेत, पार होने पर फ्लैग।',
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

      <ul className="space-y-2 lg:hidden">
        {CYCLE_STAGES.map((stage) => {
          const meta = CYCLE_STAGE_META[stage]
          const row = byStage.get(stage)
          const isEditing = editingStage === stage
          return (
            <li key={stage} className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-slate-100">
                  {meta.icon} {t(meta.en, meta.hi)}
                </p>
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={editMinutes}
                      onChange={(e) => setEditMinutes(e.target.value.replace(/[^\d.]/g, ''))}
                      className="w-20 min-h-10 rounded-lg border border-slate-600 bg-slate-900 px-2 text-sm"
                      inputMode="decimal"
                    />
                    <span className="text-xs text-slate-400">{t('min', 'मिन')}</span>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void saveStage(stage)}
                      className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-semibold text-on-accent"
                    >
                      {t('Save', 'सहेजें')}
                    </button>
                    <button type="button" onClick={() => setEditingStage(null)} className="text-xs text-slate-400">
                      {t('Cancel', 'रद्द')}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">
                      {row ? `${row.target_minutes} ${t('min', 'मिन')}` : '—'}
                    </span>
                    {canPropose && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStage(stage)
                          setEditMinutes(row ? String(row.target_minutes) : '')
                        }}
                        className="text-xs font-semibold text-emerald-300"
                      >
                        {row ? t('Edit', 'संपादित') : t('Set', 'सेट')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="hidden lg:block">
      <DesktopTable
        columns={[
          t('Stage', 'चरण'),
          t('Target (minutes)', 'लक्ष्य (मिनट)'),
          ...(canPropose ? [t('Actions', 'कार्रवाई')] : []),
        ]}
      >
        {CYCLE_STAGES.map((stage) => {
          const meta = CYCLE_STAGE_META[stage]
          const row = byStage.get(stage)
          const isEditing = editingStage === stage
          return (
            <tr key={stage} className="hover:bg-slate-800/40">
              <DeskTd className="font-semibold text-slate-100">
                {meta.icon} {t(meta.en, meta.hi)}
              </DeskTd>
              <DeskTd>
                {isEditing ? (
                  <input
                    value={editMinutes}
                    onChange={(e) => setEditMinutes(e.target.value.replace(/[^\d.]/g, ''))}
                    className="w-24 min-h-10 rounded-lg border border-slate-600 bg-slate-900 px-2"
                    inputMode="decimal"
                  />
                ) : row ? (
                  row.target_minutes
                ) : (
                  '—'
                )}
              </DeskTd>
              {canPropose && (
                <DeskTd>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void saveStage(stage)}
                        className="min-h-10 rounded-lg bg-emerald-500 px-3 text-sm font-semibold text-on-accent"
                      >
                        {t('Save', 'सहेजें')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingStage(null)}
                        className="min-h-10 text-sm text-slate-400"
                      >
                        {t('Cancel', 'रद्द')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStage(stage)
                        setEditMinutes(row ? String(row.target_minutes) : '')
                      }}
                      className="min-h-10 text-sm font-semibold text-emerald-300"
                    >
                      {row ? t('Edit', 'संपादित करें') : t('Set target', 'लक्ष्य सेट')}
                    </button>
                  )}
                </DeskTd>
              )}
            </tr>
          )
        })}
      </DesktopTable>
      </div>
    </section>
  )
}

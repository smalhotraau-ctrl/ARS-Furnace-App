import { useLanguage } from '../../context/LanguageContext'
import { BilingualText } from '../ui/BilingualText'
import { APPROVAL_ACTION_LABELS, type ApprovalSetting } from '../../types/costing'

interface ApprovalSettingsSectionProps {
  settings: ApprovalSetting[]
  onToggle: (actionType: ApprovalSetting['action_type'], requiresOwnerApproval: boolean) => Promise<void>
}

// Owner-only (03i §6). Deliberately only ever renders the two configurable action_types present
// in `settings` — heat-cancel and heat-number-correction never have a row here at all, so there
// is nothing to accidentally expose even if this component were reused elsewhere.
export function ApprovalSettingsSection({ settings, onToggle }: ApprovalSettingsSectionProps) {
  const { t } = useLanguage()

  return (
    <section className="space-y-4">
      <BilingualText as="h2" en="Approval Settings" hi="स्वीकृति सेटिंग्स" className="text-lg font-semibold text-slate-100" />
      <p className="text-sm text-slate-400">
        {t(
          'Heat cancellation and heat-number correction are permanently fixed maker-checker and are not configurable here.',
          'हीट रद्दीकरण व हीट नंबर सुधार स्थायी रूप से निश्चित हैं और यहाँ बदले नहीं जा सकते।',
        )}
      </p>
      <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        {settings.map((s) => (
          <li key={s.id} className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-800/60 px-4 py-4">
            <div>
              <p className="font-semibold text-slate-100">{t(APPROVAL_ACTION_LABELS[s.action_type].en, APPROVAL_ACTION_LABELS[s.action_type].hi)}</p>
              <p className="text-sm text-slate-400">
                {s.requires_owner_approval
                  ? t('Gated — needs your approval before it applies', 'गेटेड — लागू होने से पहले आपकी स्वीकृति आवश्यक')
                  : t('Auto-approved — applies immediately', 'स्वतः स्वीकृत — तुरंत लागू होता है')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onToggle(s.action_type, !s.requires_owner_approval)}
              className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${
                s.requires_owner_approval
                  ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/40'
              }`}
            >
              {s.requires_owner_approval ? t('Turn off gate', 'गेट बंद करें') : t('Turn gate on', 'गेट चालू करें')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

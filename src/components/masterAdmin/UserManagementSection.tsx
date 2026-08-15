import { useState } from 'react'
import { useLanguage } from '../../context/LanguageContext'
import { BilingualText } from '../ui/BilingualText'
import { ROLE_LABELS, type UserRole } from '../../types/auth'
import type { ManagedUser, UserChangeRequest } from '../../types/userManagement'

interface UserManagementSectionProps {
  users: ManagedUser[]
  requests: UserChangeRequest[]
  canPropose: boolean
  canDecide: boolean
  revealedPin: { username: string; pin: string } | null
  onDismissPin: () => void
  onProposeCreate: (username: string, role: UserRole) => Promise<void>
  onProposeRevoke: (target: ManagedUser) => Promise<void>
  onDecide: (request: UserChangeRequest, approve: boolean, note: string | null) => Promise<void>
}

const ASSIGNABLE_ROLES: UserRole[] = ['supervisor', 'qa', 'plant_head', 'admin_owner']

export function UserManagementSection({
  users,
  requests,
  canPropose,
  canDecide,
  revealedPin,
  onDismissPin,
  onProposeCreate,
  onProposeRevoke,
  onDecide,
}: UserManagementSectionProps) {
  const { t } = useLanguage()
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<UserRole>('supervisor')
  const [submitting, setSubmitting] = useState(false)
  const [noteByRequest, setNoteByRequest] = useState<Record<string, string>>({})

  const pending = requests.filter((r) => r.status === 'pending')
  const decided = requests.filter((r) => r.status !== 'pending')
  const pendingRevokeIds = new Set(pending.filter((r) => r.action === 'revoke' && r.target_id).map((r) => r.target_id as string))

  async function submitCreate() {
    if (!username.trim()) return
    setSubmitting(true)
    try {
      await onProposeCreate(username, role)
      setUsername('')
      setRole('supervisor')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-6">
      <BilingualText as="h2" en="User Management" hi="यूज़र प्रबंधन" className="text-lg font-semibold text-slate-100" />
      <p className="text-sm text-slate-400">
        {t(
          'Plant Head proposes a new login or a revoke; Owner always approves. This cannot be auto-approved.',
          'प्लांट प्रमुख नया लॉगिन या रद्द करने का प्रस्ताव करता है; मालिक हमेशा स्वीकृति देते हैं। यह स्वतः स्वीकृत नहीं हो सकता।',
        )}
      </p>

      {revealedPin && (
        <div className="space-y-3 rounded-2xl border-2 border-emerald-400 bg-emerald-950/40 p-5">
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-300">
            {t('PIN — show once, then gone', 'पिन — एक बार दिखाएँ, फिर नहीं')}
          </p>
          <p className="text-slate-100">
            {t('Relay this PIN to', 'यह पिन दें')} <span className="font-semibold">{revealedPin.username}</span>
          </p>
          <p className="text-center font-mono text-5xl font-bold tracking-[0.3em] text-emerald-200">{revealedPin.pin}</p>
          <p className="text-xs text-slate-400">
            {t(
              'This PIN is the login password. It is not stored anywhere else and will not be shown again.',
              'यह पिन लॉगिन पासवर्ड है। यह कहीं और संग्रहीत नहीं है और फिर नहीं दिखाया जाएगा।',
            )}
          </p>
          <button
            type="button"
            onClick={onDismissPin}
            className="min-h-12 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-on-accent"
          >
            {t("I've written it down", 'मैंने लिख लिया है')}
          </button>
        </div>
      )}

      {canPropose && (
        <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-4">
          <BilingualText as="h3" en="Propose new login" hi="नया लॉगिन प्रस्तावित करें" className="font-semibold text-slate-100" />
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-300">{t('Username *', 'उपयोगकर्ता नाम *')}</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4 lowercase"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-300">{t('Role *', 'भूमिका *')}</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(ROLE_LABELS[r].en, ROLE_LABELS[r].hi)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!username.trim() || submitting}
            onClick={() => void submitCreate()}
            className="min-h-12 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-on-accent disabled:opacity-50"
          >
            {t('Submit for Owner approval', 'मालिक की स्वीकृति के लिए भेजें')}
          </button>
        </div>
      )}

      {(canDecide || pending.length > 0) && (
        <div className="space-y-3">
          <BilingualText as="h3" en="Pending user requests" hi="लंबित यूज़र अनुरोध" className="font-semibold text-slate-100" />
          {pending.length === 0 && <p className="text-sm text-slate-400">{t('Nothing pending', 'कुछ भी लंबित नहीं')}</p>}
          {pending.map((req) => (
            <div key={req.id} className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4">
              <p className="font-semibold text-slate-100">
                {req.action === 'create' ? t('New login', 'नया लॉगिन') : t('Revoke login', 'लॉगिन रद्द करें')} ·{' '}
                {req.payload.username} ({t(ROLE_LABELS[req.payload.role].en, ROLE_LABELS[req.payload.role].hi)})
              </p>
              <p className="text-xs text-slate-500">{new Date(req.requested_at).toLocaleString()}</p>
              {canDecide && (
                <>
                  <textarea
                    value={noteByRequest[req.id] ?? ''}
                    onChange={(e) => setNoteByRequest((prev) => ({ ...prev, [req.id]: e.target.value }))}
                    rows={2}
                    placeholder={t('Decision note (optional)', 'निर्णय टिप्पणी (वैकल्पिक)')}
                    className="w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void onDecide(req, false, noteByRequest[req.id] ?? null)}
                      className="flex-1 min-h-12 rounded-xl border border-red-500/40 text-sm font-semibold text-red-300"
                    >
                      {t('Reject', 'अस्वीकार')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDecide(req, true, noteByRequest[req.id] ?? null)}
                      className="flex-1 min-h-12 rounded-xl bg-emerald-500 text-sm font-semibold text-on-accent"
                    >
                      {t('Approve', 'स्वीकृत')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <BilingualText as="h3" en="Existing logins" hi="मौजूदा लॉगिन" className="font-semibold text-slate-100" />
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3">
              <div>
                <p className="font-semibold text-slate-100">{u.username}</p>
                <p className="text-sm text-slate-400">
                  {t(ROLE_LABELS[u.role].en, ROLE_LABELS[u.role].hi)} ·{' '}
                  {u.active ? (
                    <span className="text-emerald-400">{t('Active', 'सक्रिय')}</span>
                  ) : (
                    <span className="text-red-400">{t('Revoked', 'रद्द')}</span>
                  )}
                </p>
              </div>
              {canPropose && u.active && (
                <button
                  type="button"
                  disabled={pendingRevokeIds.has(u.id)}
                  onClick={() => void onProposeRevoke(u)}
                  className="min-h-10 rounded-lg px-3 text-sm font-semibold text-red-300 hover:bg-red-950/40 disabled:opacity-40"
                >
                  {pendingRevokeIds.has(u.id) ? t('Pending', 'लंबित') : t('Revoke', 'रद्द करें')}
                </button>
              )}
            </li>
          ))}
          {users.length === 0 && <p className="text-sm text-slate-400">{t('No users yet', 'अभी कोई यूज़र नहीं')}</p>}
        </ul>
      </div>

      {decided.length > 0 && (
        <div className="space-y-2">
          <BilingualText as="h3" en="History" hi="इतिहास" className="font-semibold text-slate-300" />
          <ul className="space-y-2">
            {decided.map((req) => (
              <li key={req.id} className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-400">
                {req.action === 'create' ? t('New login', 'नया लॉगिन') : t('Revoke', 'रद्द')} · {req.payload.username} ·{' '}
                {req.status === 'approved' ? (
                  <span className="text-emerald-400">{t('Approved', 'स्वीकृत')}</span>
                ) : (
                  <span className="text-red-400">{t('Rejected', 'अस्वीकृत')}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

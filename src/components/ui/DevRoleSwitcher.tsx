import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { UserRole } from '../../types/auth'
import { ROLE_LABELS } from '../../types/auth'
import { useLanguage } from '../../context/LanguageContext'

const ALL_ROLES: UserRole[] = ['supervisor', 'qa', 'plant_head', 'admin_owner']

interface DevRoleSwitcherProps {
  userId: string
  currentRole: UserRole
}

// ⚠️ DEV ONLY — temporary testing convenience.
//
// Lets the currently signed-in user change their own role, so different
// role views can be tested quickly without a real User Management module.
// This is only possible because of a matching DEV-ONLY RLS policy
// (database/09_common_users_update_own_role.sql) that allows a row in
// common.users to update its own role — self-service role changes are NOT
// safe once there's more than one real account.
//
// REMOVE this component and the matching RLS policy together once a real
// User Management module exists.
export function DevRoleSwitcher({ userId, currentRole }: DevRoleSwitcherProps) {
  const { t } = useLanguage()
  const [updating, setUpdating] = useState(false)

  async function handleChange(nextRole: UserRole) {
    if (nextRole === currentRole || updating) return
    setUpdating(true)
    const { error } = await supabase
      .schema('common')
      .from('users')
      .update({ role: nextRole })
      .eq('id', userId)

    if (error) {
      window.alert(`Failed to switch role: ${error.message}`)
      setUpdating(false)
      return
    }

    // Full reload so AuthContext re-fetches the profile with the new role
    // and every screen's role-gated view updates immediately.
    window.location.reload()
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-950/30 px-2 py-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-amber-300">
        {t('Dev only', 'केवल डेव')}
      </span>
      <select
        value={currentRole}
        disabled={updating}
        onChange={(e) => void handleChange(e.target.value as UserRole)}
        className="min-h-8 rounded-md border border-amber-500/40 bg-slate-900 px-2 text-xs font-semibold text-amber-100 disabled:opacity-50"
        aria-label="Switch role (dev only)"
      >
        {ALL_ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role].en}
          </option>
        ))}
      </select>
    </div>
  )
}

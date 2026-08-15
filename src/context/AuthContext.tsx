import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabaseClient'
import type { AppUser, UserRole } from '../types/auth'

interface AuthContextValue {
  user: AppUser | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  isReadOnly: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Transition-only bootstrap credentials for the original Sarthak / admin_owner
// account. Do not auto-sign-in with these on mount anymore — the real login
// screen is wired — but keep both so that account can still get in if the
// typed PIN fails (e.g. PIN was never rotated off the original value).
// Remove together with DevRoleSwitcher once User Management login is confirmed.
const BOOTSTRAP_EMAIL = 'sarthak@furnace.local'
const BOOTSTRAP_PASSWORD = '000333'

export const INACTIVE_LOGIN_MESSAGE = 'User profile not found or inactive.'
export const INVALID_LOGIN_MESSAGE = 'Wrong username or PIN.'

function toAuthEmail(username: string): string {
  const trimmed = username.trim().toLowerCase()
  return trimmed.includes('@') ? trimmed : `${trimmed}@furnace.local`
}

const DEV_USER_ID = import.meta.env.VITE_DEV_USER_ID as string | undefined
const DEV_ROLE = import.meta.env.VITE_DEV_ROLE as UserRole | undefined

function isUserRole(value: string): value is UserRole {
  return ['supervisor', 'qa', 'plant_head', 'admin_owner'].includes(value)
}

async function loadUserProfile(userId: string): Promise<AppUser | null> {
  const { data, error } = await supabase
    .schema('common')
    .from('users')
    .select('id, username, role, active')
    .eq('id', userId)
    .maybeSingle()

  // Revoked logins (common.users.active = false) must not get a session into the app — this is
  // the check User Management relies on. Returning null here makes signIn report "inactive" and
  // makes onAuthStateChange drop the user, even if the Auth password is still valid.
  if (error || !data || !data.active || !isUserRole(data.role)) return null

  return {
    id: data.id,
    username: data.username,
    role: data.role,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function init() {
      if (DEV_USER_ID && DEV_ROLE && isUserRole(DEV_ROLE)) {
        if (mounted) {
          setUser({ id: DEV_USER_ID, username: 'dev-user', role: DEV_ROLE })
          setLoading(false)
        }
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        const profile = await loadUserProfile(session.user.id)
        if (mounted) setUser(profile)
      }

      if (mounted) setLoading(false)
    }

    void init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await loadUserProfile(session.user.id)
        if (mounted) setUser(profile)
      } else if (!DEV_USER_ID) {
        if (mounted) setUser(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    const email = toAuthEmail(username)

    let { data, error } = await supabase.auth.signInWithPassword({ email, password })

    // Transition fallback for the original Sarthak/admin_owner account only:
    // if the typed PIN is rejected, retry once with the hardcoded bootstrap
    // password. New User Management logins never take this path. Remove with
    // BOOTSTRAP_* and DevRoleSwitcher once real login is confirmed.
    if (error && email === BOOTSTRAP_EMAIL && password !== BOOTSTRAP_PASSWORD) {
      ;({ data, error } = await supabase.auth.signInWithPassword({
        email: BOOTSTRAP_EMAIL,
        password: BOOTSTRAP_PASSWORD,
      }))
    }

    if (error) return INVALID_LOGIN_MESSAGE

    if (data.user) {
      const profile = await loadUserProfile(data.user.id)
      if (!profile) {
        await supabase.auth.signOut()
        return INACTIVE_LOGIN_MESSAGE
      }
      setUser(profile)
    }

    return null
  }, [])

  const signOut = useCallback(async () => {
    if (DEV_USER_ID) {
      setUser(null)
      return
    }
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  const isReadOnly = user?.role === 'plant_head' || user?.role === 'admin_owner'

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, isReadOnly }),
    [user, loading, signIn, signOut, isReadOnly],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

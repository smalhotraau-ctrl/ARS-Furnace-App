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

// Temporary: no login screen exists yet. Instead of a fake bypass user, we
// silently sign in a real Supabase Auth account on app load so a genuine
// session is established in the background. Remove when a real login
// screen is wired up.
const AUTO_SIGNIN_EMAIL = 'sarthak@furnace.local'
const AUTO_SIGNIN_PASSWORD = '000333'

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

      let { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        // No login screen exists yet — silently establish a real session.
        await supabase.auth.signInWithPassword({
          email: AUTO_SIGNIN_EMAIL,
          password: AUTO_SIGNIN_PASSWORD,
        })
        ;({ data: { session } } = await supabase.auth.getSession())
      }

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
    const email = username.includes('@') ? username : `${username.toLowerCase()}@furnace.local`

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message

    if (data.user) {
      const profile = await loadUserProfile(data.user.id)
      if (!profile) return 'User profile not found or inactive.'
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

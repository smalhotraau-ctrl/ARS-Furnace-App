import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { BilingualText } from '../components/ui/BilingualText'

export function LoginScreen() {
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const message = await signIn(username.trim(), password)
    if (message) setError(message)
    setSubmitting(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <form onSubmit={(e) => void handleSubmit(e)} className="w-full max-w-md space-y-5 rounded-2xl border border-slate-700 bg-slate-800 p-6">
        <BilingualText as="h1" en="Furnace Sign In" hi="फर्नेस साइन इन" className="text-2xl font-bold text-slate-100" />
        <label className="block space-y-2">
          <BilingualText as="span" en="Username" hi="उपयोगकर्ता नाम" className="font-semibold" />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-900 px-4 text-lg"
            autoComplete="username"
            required
          />
        </label>
        <label className="block space-y-2">
          <BilingualText as="span" en="Password" hi="पासवर्ड" className="font-semibold" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-900 px-4 text-lg"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-red-200">
            {error}
            <span className="block text-sm">त्रुटि · कृपया पुनः प्रयास करें</span>
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="min-h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-slate-950 disabled:opacity-50"
        >
          Sign In · साइन इन
        </button>
      </form>
    </main>
  )
}

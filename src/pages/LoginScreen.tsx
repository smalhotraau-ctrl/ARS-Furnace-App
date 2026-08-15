import { useState } from 'react'
import { INACTIVE_LOGIN_MESSAGE, INVALID_LOGIN_MESSAGE, useAuth } from '../context/AuthContext'
import { BilingualText } from '../components/ui/BilingualText'
import { LanguageToggle } from '../components/ui/LanguageToggle'
import { useLanguage } from '../context/LanguageContext'

function loginErrorCopy(message: string): { en: string; hi: string } {
  if (message === INACTIVE_LOGIN_MESSAGE) {
    return {
      en: 'User profile not found or inactive.',
      hi: 'यूज़र प्रोफ़ाइल नहीं मिली या निष्क्रिय है।',
    }
  }
  if (message === INVALID_LOGIN_MESSAGE) {
    return {
      en: 'Wrong username or PIN.',
      hi: 'गलत उपयोगकर्ता नाम या पिन।',
    }
  }
  return { en: message, hi: message }
}

export function LoginScreen() {
  const { t } = useLanguage()
  const { signIn } = useAuth()
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = username.trim().length > 0 && pin.length === 6

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const message = await signIn(username.trim(), pin)
    if (message) setError(message)
    setSubmitting(false)
  }

  const errorCopy = error ? loginErrorCopy(error) : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <form onSubmit={(e) => void handleSubmit(e)} className="w-full max-w-md space-y-6 rounded-2xl border border-slate-700 bg-slate-800 p-6">
        <div className="flex items-start justify-between gap-3">
          <BilingualText as="h1" en="Furnace Sign In" hi="फर्नेस साइन इन" className="text-3xl font-bold text-slate-100" />
          <LanguageToggle />
        </div>
        <p className="text-sm text-slate-400">
          {t('Enter your username and 6-digit PIN.', 'अपना उपयोगकर्ता नाम और 6 अंकों का पिन दर्ज करें।')}
        </p>

        <label className="block space-y-2">
          <BilingualText as="span" en="Username" hi="उपयोगकर्ता नाम" className="text-lg font-semibold" />
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-900 px-4 text-lg lowercase"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
          />
        </label>

        <label className="block space-y-2">
          <BilingualText as="span" en="PIN (6 digits)" hi="पिन (6 अंक)" className="text-lg font-semibold" />
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-900 px-4 text-center font-mono text-2xl tracking-[0.4em]"
            autoComplete="current-password"
            required
          />
        </label>

        {errorCopy && (
          <p className="rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-red-200">
            <span className="block font-semibold">{errorCopy.en}</span>
            <span className="block text-sm">{errorCopy.hi}</span>
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="min-h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-slate-950 disabled:opacity-50"
        >
          {submitting ? t('Signing in…', 'साइन इन हो रहा है…') : t('Sign In', 'साइन इन')}
        </button>
      </form>
    </main>
  )
}

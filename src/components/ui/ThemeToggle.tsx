import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-600 bg-slate-800 text-xl text-slate-100"
      aria-label={isDark ? t('Switch to light mode', 'लाइट मोड चालू करें') : t('Switch to dark mode', 'डार्क मोड चालू करें')}
      title={isDark ? t('Light mode', 'लाइट मोड') : t('Dark mode', 'डार्क मोड')}
    >
      <span aria-hidden>{isDark ? '☀️' : '🌙'}</span>
    </button>
  )
}

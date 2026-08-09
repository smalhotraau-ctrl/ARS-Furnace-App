import { useLanguage, type Language } from '../../context/LanguageContext'

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="inline-flex rounded-xl border border-slate-700 bg-slate-900 p-1">
      {(['en', 'hi'] as Language[]).map((code) => {
        const active = language === code
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLanguage(code)}
            className={`min-h-9 min-w-11 rounded-lg px-3 text-sm font-semibold transition ${
              active
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-pressed={active}
          >
            {code.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}

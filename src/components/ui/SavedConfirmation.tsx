import { useLanguage } from '../../context/LanguageContext'

interface SavedConfirmationProps {
  visible: boolean
}

export function SavedConfirmation({ visible }: SavedConfirmationProps) {
  const { t } = useLanguage()

  if (!visible) return null

  return (
    <div
      className="save-toast fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border-2 border-emerald-500 bg-emerald-950 px-5 py-4 shadow-xl"
      role="status"
      aria-live="polite"
    >
      <div className="save-toast-check flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-on-accent">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="3.5">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p className="text-xl font-extrabold text-emerald-100">{t('Saved', 'सहेजा गया')}</p>
        <p className="text-sm font-semibold text-emerald-200">{t('Done', 'हो गया')}</p>
      </div>
    </div>
  )
}

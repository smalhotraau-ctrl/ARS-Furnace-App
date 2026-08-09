interface SavedConfirmationProps {
  visible: boolean
}

export function SavedConfirmation({ visible }: SavedConfirmationProps) {
  if (!visible) return null

  return (
    <div
      className="fixed inset-x-4 bottom-6 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-950 px-5 py-4 shadow-xl"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-slate-950">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p className="text-lg font-semibold text-emerald-100">Saved</p>
        <p className="text-sm text-emerald-200/80">सहेजा गया</p>
      </div>
    </div>
  )
}

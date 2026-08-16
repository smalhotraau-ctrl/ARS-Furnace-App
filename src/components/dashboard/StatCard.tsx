import { BilingualText } from '../ui/BilingualText'

type StatTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

interface StatCardProps {
  labelEn: string
  labelHi: string
  value: number | string
  tone?: StatTone
  sublabelEn?: string
  sublabelHi?: string
  className?: string
}

const TONE_CLASSES: Record<StatTone, string> = {
  neutral: 'border-slate-600 bg-slate-800/70 text-slate-100',
  success: 'border-emerald-500/60 bg-emerald-950/40 text-emerald-100',
  warning: 'border-amber-500/60 bg-amber-950/40 text-amber-100',
  danger: 'border-rose-500/60 bg-rose-950/40 text-rose-100',
  info: 'border-sky-500/60 bg-sky-950/40 text-sky-100',
}

const VALUE_TONE_CLASSES: Record<StatTone, string> = {
  neutral: 'text-slate-50',
  success: 'text-emerald-300',
  warning: 'text-amber-300',
  danger: 'text-rose-300',
  info: 'text-sky-300',
}

export function StatCard({
  labelEn,
  labelHi,
  value,
  tone = 'neutral',
  sublabelEn,
  sublabelHi,
  className = '',
}: StatCardProps) {
  return (
    <div className={`rounded-2xl border-2 p-5 ${TONE_CLASSES[tone]} ${className}`}>
      <BilingualText as="p" en={labelEn} hi={labelHi} className="text-sm font-semibold opacity-90" />
      <p className={`mt-2 text-4xl font-extrabold tabular-nums sm:text-5xl ${VALUE_TONE_CLASSES[tone]}`}>{value}</p>
      {sublabelEn && sublabelHi && (
        <BilingualText as="p" en={sublabelEn} hi={sublabelHi} className="mt-1 text-xs opacity-75" />
      )}
    </div>
  )
}

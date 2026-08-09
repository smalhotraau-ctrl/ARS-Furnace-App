import { BilingualText } from './BilingualText'

interface NumericFieldProps {
  id: string
  labelEn: string
  labelHi: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
}

function sanitizeDecimalInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length <= 1) return cleaned
  return `${parts[0]}.${parts.slice(1).join('')}`
}

export function NumericField({
  id,
  labelEn,
  labelHi,
  value,
  onChange,
  disabled = false,
  required = false,
}: NumericFieldProps) {
  return (
    <label htmlFor={id} className="block space-y-2">
      <BilingualText
        as="span"
        en={`${labelEn}${required ? ' *' : ''}`}
        hi={labelHi}
        className="text-base font-semibold text-slate-100"
      />
      <input
        id={id}
        type="text"
        inputMode="decimal"
        pattern="[0-9]*[.]?[0-9]*"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(sanitizeDecimalInput(e.target.value))}
        className="w-full min-h-14 rounded-xl border border-slate-600 bg-slate-800 px-4 text-xl text-slate-100 outline-none focus:border-emerald-500 disabled:opacity-60"
      />
    </label>
  )
}

export function parseNumericField(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

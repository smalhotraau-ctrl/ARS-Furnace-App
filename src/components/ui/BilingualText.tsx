interface BilingualTextProps {
  en: string
  hi: string
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'label'
  className?: string
}

export function BilingualText({ en, hi, as = 'span', className = '' }: BilingualTextProps) {
  const Tag = as
  return (
    <Tag className={className}>
      <span className="block">{en}</span>
      <span className="block text-sm font-normal text-slate-400">{hi}</span>
    </Tag>
  )
}

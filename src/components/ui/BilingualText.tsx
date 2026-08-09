import { useLanguage } from '../../context/LanguageContext'

interface BilingualTextProps {
  en: string
  hi: string
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'label'
  className?: string
}

export function BilingualText({ en, hi, as = 'span', className = '' }: BilingualTextProps) {
  const { t } = useLanguage()
  const Tag = as
  return <Tag className={className}>{t(en, hi)}</Tag>
}

export function T({ en, hi }: { en: string; hi: string }) {
  const { t } = useLanguage()
  return <>{t(en, hi)}</>
}

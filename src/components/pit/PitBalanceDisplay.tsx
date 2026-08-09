import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface PitBalanceDisplayProps {
  balanceKg: number
  asOfDate: string
}

export function PitBalanceDisplay({ balanceKg, asOfDate }: PitBalanceDisplayProps) {
  const { t } = useLanguage()

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5">
      <BilingualText
        as="h2"
        en="Pit Balance"
        hi="पिट बैलेंस"
        className="text-lg font-bold text-slate-100"
      />
      <p className="mt-1 text-sm text-slate-400">
        {t(`Computed from history · ${asOfDate}`, `इतिहास से गणना · ${asOfDate}`)}
      </p>
      <p className="mt-4 text-4xl font-bold tracking-tight text-emerald-400">
        {balanceKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
      </p>
      <p className="mt-2 text-xs text-slate-500">
        {t('Read-only · never hand-edited', 'केवल पढ़ने योग्य · कभी हाथ से नहीं बदला जाता')}
      </p>
    </section>
  )
}

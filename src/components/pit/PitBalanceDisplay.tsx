import { BilingualText } from '../ui/BilingualText'

interface PitBalanceDisplayProps {
  balanceKg: number
  asOfDate: string
}

export function PitBalanceDisplay({ balanceKg, asOfDate }: PitBalanceDisplayProps) {
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5">
      <BilingualText
        as="h2"
        en="Pit Balance"
        hi="पिट बैलेंस"
        className="text-lg font-bold text-slate-100"
      />
      <p className="mt-1 text-sm text-slate-400">
        Computed from history · {asOfDate}
        <span className="block">इतिहास से गणना · {asOfDate}</span>
      </p>
      <p className="mt-4 text-4xl font-bold tracking-tight text-emerald-400">
        {balanceKg.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Read-only · never hand-edited
        <span className="block">केवल पढ़ने योग्य · कभी हाथ से नहीं बदला जाता</span>
      </p>
    </section>
  )
}

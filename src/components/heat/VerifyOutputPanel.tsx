import { useMemo, useState } from 'react'
import { computeYieldFlags } from '../../lib/outputCalc'
import type { ChargeLine } from '../../types/heat'
import type { HeatOutput, MaterialYieldStandardRow } from '../../types/output'
import { YIELD_METRIC_LABELS } from '../../types/output'
import { BilingualText } from '../ui/BilingualText'
import { useLanguage } from '../../context/LanguageContext'

interface VerifyOutputPanelProps {
  output: HeatOutput
  chargeLines: ChargeLine[]
  yieldStandards: MaterialYieldStandardRow[]
  showFlagPreview: boolean
  onVerify: () => Promise<void>
}

// QA or Plant Head verification (either one, not both) — moves the heat to Closed and posts
// fg_stock. The yield-exceptions preview here is only ever shown to Plant Head, never QA,
// matching the Yield Exceptions panel visibility rule in 03b/03f §4.
export function VerifyOutputPanel({ output, chargeLines, yieldStandards, showFlagPreview, onVerify }: VerifyOutputPanelProps) {
  const { t } = useLanguage()
  const [submitting, setSubmitting] = useState(false)

  const flagCandidates = useMemo(() => {
    if (!showFlagPreview) return []
    const recovery = {
      charged_net_kg: 0,
      burn_loss_kg: output.burn_loss_kg,
      ingot_pct: output.ingot_pct,
      dross_pct: output.dross_pct,
      rejection_pct: output.rejection_pct,
      iron_pct: output.iron_pct,
      burn_loss_pct: output.burn_loss_pct,
    }
    return computeYieldFlags(recovery, chargeLines, yieldStandards)
  }, [showFlagPreview, output, chargeLines, yieldStandards])

  async function handleVerify() {
    setSubmitting(true)
    try {
      await onVerify()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-purple-500/40 bg-purple-950/20 p-5">
      <BilingualText as="h3" en="Verify Output" hi="आउटपुट सत्यापित करें" className="text-lg font-bold text-purple-200" />
      <p className="text-sm text-slate-300">
        {t(
          'Review the figures above, then verify to close the heat and post FG stock.',
          'ऊपर दिए आंकड़ों की जांच करें, फिर हीट बंद करने व FG स्टॉक जमा करने हेतु सत्यापित करें।',
        )}
      </p>

      {showFlagPreview && flagCandidates.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-950/30 p-4">
          <BilingualText
            as="p"
            en="Yield standard exceptions will be flagged"
            hi="यील्ड मानक अपवाद चिह्नित होंगे"
            className="text-sm font-semibold text-amber-200"
          />
          <ul className="space-y-1 text-sm text-amber-100">
            {flagCandidates.map((c) => (
              <li key={c.metric}>
                {t(YIELD_METRIC_LABELS[c.metric].en, YIELD_METRIC_LABELS[c.metric].hi)}: {c.actual_pct.toFixed(1)}%
                {' '}({t('expected', 'अनुमानित')} {c.expected_min_pct.toFixed(1)}–{c.expected_max_pct.toFixed(1)}%)
              </li>
            ))}
          </ul>
          <p className="text-xs text-amber-300">
            {t('This is non-blocking — the heat will still close.', 'यह रोकता नहीं है — हीट फिर भी बंद होगी।')}
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={submitting}
        onClick={() => void handleVerify()}
        className="min-h-14 w-full rounded-xl bg-purple-500 text-lg font-semibold text-on-accent disabled:opacity-50"
      >
        {t('Verify & Close', 'सत्यापित करें व बंद करें')}
      </button>
    </section>
  )
}

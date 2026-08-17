import { useState } from 'react'
import type { ChargeLine, CycleLogEntry, Heat, TempReading } from '../../types/heat'
import { fetchBatchPlansForHeat } from '../../lib/heatService'
import { getCachedBatchPlans } from '../../lib/batchPlanOfflineStore'
import { fetchHeatOutput } from '../../lib/outputService'
import { fetchSpectroReports } from '../../lib/spectroService'
import { getCachedSpectroReports } from '../../lib/spectroOfflineStore'
import { getCachedHeatOutputs } from '../../lib/outputOfflineStore'
import { BilingualText } from '../ui/BilingualText'

interface DownloadHeatSheetButtonProps {
  heat: Heat
  chargeLines: ChargeLine[]
  cycleEntries: CycleLogEntry[]
  tempReadings: TempReading[]
}

export function DownloadHeatSheetButton({
  heat,
  chargeLines,
  cycleEntries,
  tempReadings,
}: DownloadHeatSheetButtonProps) {
  const [busy, setBusy] = useState(false)

  async function handleDownload() {
    setBusy(true)
    try {
      const { downloadHeatSheetPdf, pickSpectroReports } = await import('../../lib/heatSheetPdf')

      const cachedReports = getCachedSpectroReports().filter((r) => r.heat_id === heat.id)
      let { process: processSpectro, final: finalSpectro } = pickSpectroReports(cachedReports)
      let heatOutput = getCachedHeatOutputs().find((o) => o.heat_id === heat.id) ?? null
      let batchPlan = heat.batch_plan_id
        ? (getCachedBatchPlans().find((p) => p.id === heat.batch_plan_id) ?? null)
        : null

      if (navigator.onLine) {
        const [reports, output, plans] = await Promise.all([
          fetchSpectroReports(heat.id).catch(() => cachedReports),
          fetchHeatOutput(heat.id).catch(() => null),
          fetchBatchPlansForHeat().catch(() => getCachedBatchPlans()),
        ])
        const picked = pickSpectroReports(reports)
        processSpectro = picked.process
        finalSpectro = picked.final
        heatOutput = output ?? heatOutput
        batchPlan = heat.batch_plan_id ? (plans.find((p) => p.id === heat.batch_plan_id) ?? null) : null
      }

      downloadHeatSheetPdf({
        heat,
        chargeLines,
        cycleEntries,
        tempReadings,
        processSpectro,
        finalSpectro,
        heatOutput,
        batchPlan,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void handleDownload()}
      className="min-h-11 rounded-xl border border-slate-500 bg-slate-800 px-4 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
    >
      <BilingualText
        as="span"
        en={busy ? 'Preparing PDF…' : 'Download Heat Sheet'}
        hi={busy ? 'PDF तैयार…' : 'हीट शीट डाउनलोड'}
      />
    </button>
  )
}

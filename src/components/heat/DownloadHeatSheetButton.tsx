import { useState } from 'react'
import type { ChargeLine, CycleLogEntry, Heat, TempReading } from '../../types/heat'
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
      const { downloadHeatSheetPdf, pickSpectroReport } = await import('../../lib/heatSheetPdf')

      let spectroReport = pickSpectroReport(getCachedSpectroReports().filter((r) => r.heat_id === heat.id))
      let heatOutput = getCachedHeatOutputs().find((o) => o.heat_id === heat.id) ?? null

      if (navigator.onLine) {
        const [reports, output] = await Promise.all([
          fetchSpectroReports(heat.id).catch(() => []),
          fetchHeatOutput(heat.id).catch(() => null),
        ])
        spectroReport = pickSpectroReport(reports)
        heatOutput = output ?? heatOutput
      }

      downloadHeatSheetPdf({
        heat,
        chargeLines,
        cycleEntries,
        tempReadings,
        spectroReport,
        heatOutput,
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

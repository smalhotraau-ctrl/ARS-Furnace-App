import { jsPDF } from 'jspdf'
import { CYCLE_STAGE_META, TEMP_CHECKPOINT_META } from './heatLabels'
import { HEAT_STATUS_META } from './heatStatusMeta'
import type { ChargeLine, CycleLogEntry, Heat, TempReading } from '../types/heat'
import { CYCLE_STAGES } from '../types/heat'
import type { HeatOutput } from '../types/output'
import { YIELD_METRIC_LABELS, YIELD_METRICS } from '../types/output'
import type { SpectroReport } from '../types/spectro'

export interface HeatSheetData {
  heat: Heat
  chargeLines: ChargeLine[]
  cycleEntries: CycleLogEntry[]
  tempReadings: TempReading[]
  spectroReport: SpectroReport | null
  heatOutput: HeatOutput | null
}

const MARGIN = 14
const PAGE_W = 210
const CONTENT_W = PAGE_W - MARGIN * 2

function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight()
  if (y + needed > pageH - MARGIN) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function sectionHeading(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 12)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(30, 41, 59)
  doc.text(title, MARGIN, y)
  doc.setDrawColor(148, 163, 184)
  doc.line(MARGIN, y + 1.5, MARGIN + CONTENT_W, y + 1.5)
  return y + 8
}

function bodyText(doc: jsPDF, text: string, y: number, opts?: { bold?: boolean; size?: number }): number {
  doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
  doc.setFontSize(opts?.size ?? 9)
  doc.setTextColor(51, 65, 85)
  const lines = doc.splitTextToSize(text, CONTENT_W)
  y = ensureSpace(doc, y, lines.length * 4.5 + 2)
  doc.text(lines, MARGIN, y)
  return y + lines.length * 4.5 + 2
}

function pickSpectroReport(reports: SpectroReport[]): SpectroReport | null {
  if (reports.length === 0) return null
  const finalReport = reports.find((r) => r.report_type === 'final')
  if (finalReport) return finalReport
  return reports.sort((a, b) => b.sample_time.localeCompare(a.sample_time))[0]
}

export function downloadHeatSheetPdf(data: HeatSheetData): void {
  const { heat, chargeLines, cycleEntries, tempReadings, spectroReport, heatOutput } = data
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(15, 118, 110)
  doc.text('Heat Sheet', MARGIN, y)
  y += 10

  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  const statusLabel = HEAT_STATUS_META[heat.status]?.en ?? heat.status
  const headerLines = [
    `Heat No: ${heat.heat_no}`,
    `Furnace: ${heat.furnace_code}    Grade: ${heat.grade_code}`,
    `Date: ${formatDate(heat.created_at)}    Status: ${statusLabel}`,
  ]
  for (const line of headerLines) {
    doc.setFont('helvetica', 'normal')
    doc.text(line, MARGIN, y)
    y += 5
  }
  y += 4

  y = sectionHeading(doc, 'Charge Lines', y)
  if (chargeLines.length === 0) {
    y = bodyText(doc, 'No charge lines recorded.', y)
  } else {
    const sortedLines = [...chargeLines].sort((a, b) => a.added_at.localeCompare(b.added_at))
    for (const line of sortedLines) {
      y = ensureSpace(doc, y, 8)
      const mid = line.is_mid_heat_addition ? ' · mid-heat' : ''
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(`${line.material_code}`, MARGIN, y)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `${line.net_kg.toFixed(1)} kg${mid} · ${formatDateTime(line.added_at)}`,
        MARGIN + 36,
        y,
      )
      y += 5.5
    }
    y += 2
  }

  y = sectionHeading(doc, 'Cycle Log', y)
  for (const stage of CYCLE_STAGES) {
    const meta = CYCLE_STAGE_META[stage]
    const stageEntries = cycleEntries.filter((e) => e.stage === stage)
    const latest = stageEntries[stageEntries.length - 1]

    y = ensureSpace(doc, y, 7)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(meta.en, MARGIN, y)

    if (latest?.finish_ts) {
      const duration = formatDurationMs(new Date(latest.finish_ts).getTime() - new Date(latest.start_ts).getTime())
      doc.setFont('helvetica', 'normal')
      doc.text(
        `${duration}   ${formatTime(latest.start_ts)} – ${formatTime(latest.finish_ts)}`,
        MARGIN + 38,
        y,
      )
    } else if (latest) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(180, 83, 9)
      doc.text(`Running · started ${formatTime(latest.start_ts)}`, MARGIN + 38, y)
      doc.setTextColor(51, 65, 85)
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(100, 116, 139)
      doc.text('Not started', MARGIN + 38, y)
      doc.setTextColor(51, 65, 85)
    }
    y += 5.5
  }
  y += 2

  if (tempReadings.length > 0) {
    y = sectionHeading(doc, 'Temperature Readings', y)
    const sortedTemps = [...tempReadings].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at))
    for (const reading of sortedTemps) {
      const label = TEMP_CHECKPOINT_META[reading.checkpoint]?.en ?? reading.checkpoint
      y = ensureSpace(doc, y, 7)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.text(label, MARGIN, y)
      doc.setFont('helvetica', 'normal')
      const spec =
        reading.spec_min != null && reading.spec_max != null
          ? ` (spec ${reading.spec_min}–${reading.spec_max}°C)`
          : ''
      doc.text(`${reading.value}°C${spec} · ${formatDateTime(reading.recorded_at)}`, MARGIN + 38, y)
      y += 5.5
    }
    y += 2
  }

  if (spectroReport) {
    y = sectionHeading(doc, `Spectro — ${spectroReport.report_type === 'final' ? 'Final' : 'Process'}`, y)
    y = bodyText(doc, `Sample: ${formatDateTime(spectroReport.sample_time)}`, y, { size: 8 })
    for (const entry of spectroReport.composition) {
      y = ensureSpace(doc, y, 6)
      const flag = entry.flag === 'out_of_spec' ? ' *' : ''
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(
        `${entry.element}: ${entry.actual_pct.toFixed(3)}%  (${entry.spec_min}–${entry.spec_max})${flag}`,
        MARGIN + 2,
        y,
      )
      y += 4.5
    }
    y += 2
  }

  if (heatOutput) {
    y = sectionHeading(doc, 'Output', y)
    const kgLines = [
      `Ingot: ${heatOutput.ingot_kg.toFixed(1)} kg`,
      `Dross: ${heatOutput.dross_kg.toFixed(1)} kg`,
      `Rejection: ${heatOutput.rejection_kg.toFixed(1)} kg`,
      `Iron: ${heatOutput.iron_kg.toFixed(1)} kg`,
      `Burn loss: ${heatOutput.burn_loss_kg.toFixed(1)} kg`,
    ]
    for (const line of kgLines) {
      y = bodyText(doc, line, y, { size: 9 })
    }
    const pctParts = YIELD_METRICS.map((m) => {
      const label = YIELD_METRIC_LABELS[m].en.replace(' %', '')
      const val = heatOutput[m]
      return `${label} ${Number(val).toFixed(1)}%`
    })
    y = bodyText(doc, pctParts.join(' · '), y, { size: 8 })
    y += 2
  }

  y = ensureSpace(doc, y, 28)
  y = sectionHeading(doc, 'Notes / Signatures', y)
  doc.setDrawColor(203, 213, 225)
  doc.rect(MARGIN, y, CONTENT_W, 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('Supervisor / QA sign-off', MARGIN + 2, y + 6)

  const safeName = heat.heat_no.replace(/[^\w-]+/g, '_')
  doc.save(`HeatSheet_${safeName}.pdf`)
}

export { pickSpectroReport }

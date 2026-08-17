import { jsPDF } from 'jspdf'
import { computePlanVariance } from './heatService'
import { TEMP_CHECKPOINT_META } from './heatLabels'
import type { BatchPlan } from '../types/batchPlan'
import type { ChargeLine, CycleLogEntry, CycleStage, Heat, TempReading } from '../types/heat'
import { CYCLE_STAGES, TEMP_CHECKPOINTS } from '../types/heat'
import type { HeatOutput } from '../types/output'
import type { SpectroReport } from '../types/spectro'

export interface HeatSheetData {
  heat: Heat
  chargeLines: ChargeLine[]
  cycleEntries: CycleLogEntry[]
  tempReadings: TempReading[]
  processSpectro: SpectroReport | null
  finalSpectro: SpectroReport | null
  heatOutput: HeatOutput | null
  batchPlan: BatchPlan | null
}

const COMPANY_NAME = 'AUTO RECYCLING SYSTEMS'
const DOC_NO = 'F/PRD/01'
const ISSUE_DATE = '01/04/2024'
const REV_NO = '01'
const REV_DATE = '14/11/2025'
const FORM_TITLE = 'Daily Production Sheet'

/** Fixed stage-range labels from controlled document F/PRD/01 — not derived from live targets. */
const STAGE_RANGE_LABELS: Record<CycleStage, string> = {
  preheating: 'PREHETING (30-45 Minutes)',
  charging: 'CHARGING (180 to 230 Minutes)',
  melting: 'MELTING (50 to 70 Minutes)',
  drossing: 'DROSSING (50 to 80 Minutes)',
  iron_removal: 'IRON REMOVAL (35 to 55 Minutes)',
  alloying: 'ALLOYING & CORRECTION (90 to 120 Minutes)',
  degassing: 'DEGASSING (5 to 8 Minutes)',
  casting: 'CASTING (70 to 90 Minutes)',
  cleaning: 'FURNACE CLEANING (10 to 20 Minutes)',
}

const MARGIN = 8
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - MARGIN * 2
const ROW_H = 5.2
const HDR_H = 5.8
const FONT = 'helvetica'

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function fmtDurationMinutes(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60_000))
  return `${mins} Min`
}

function fmtDurationHms(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return ''
  return n.toFixed(digits)
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return ''
  return `${n.toFixed(2)}%`
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage()
    return MARGIN
  }
  return y
}

function setFont(doc: jsPDF, size: number, style: 'normal' | 'bold' = 'normal') {
  doc.setFont(FONT, style)
  doc.setFontSize(size)
  doc.setTextColor(0, 0, 0)
}

function clipText(doc: jsPDF, text: string, maxW: number): string {
  if (!text) return ''
  if (doc.getTextWidth(text) <= maxW) return text
  let clipped = text
  while (clipped.length > 1 && doc.getTextWidth(`${clipped}…`) > maxW) {
    clipped = clipped.slice(0, -1)
  }
  return `${clipped}…`
}

function drawCell(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  opts?: { bold?: boolean; align?: 'left' | 'center' | 'right'; size?: number; pad?: number },
) {
  const pad = opts?.pad ?? 1.2
  setFont(doc, opts?.size ?? 7, opts?.bold ? 'bold' : 'normal')
  doc.setDrawColor(0, 0, 0)
  doc.rect(x, y, w, h)
  const content = clipText(doc, text ?? '', w - pad * 2)
  const tw = doc.getTextWidth(content)
  let tx = x + pad
  if (opts?.align === 'center') tx = x + (w - tw) / 2
  if (opts?.align === 'right') tx = x + w - pad - tw
  doc.text(content, tx, y + h / 2 + 2.1)
}

function drawTable(
  doc: jsPDF,
  x: number,
  y: number,
  colWidths: number[],
  rows: string[][],
  opts?: { headerRows?: number; rowHeight?: number; fontSize?: number; letterCol?: boolean },
): number {
  const rowH = opts?.rowHeight ?? ROW_H
  const headerRows = opts?.headerRows ?? 0
  const letterW = opts?.letterCol ? 6 : 0
  const widths = letterW > 0 ? [letterW, ...colWidths] : colWidths

  for (let ri = 0; ri < rows.length; ri++) {
    y = ensureSpace(doc, y, rowH)
    let cx = x
    const row = opts?.letterCol ? rows[ri] : rows[ri]
    for (let ci = 0; ci < widths.length; ci++) {
      const isLetterCol = opts?.letterCol && ci === 0
      drawCell(doc, cx, y, widths[ci], rowH, row[ci] ?? '', {
        bold: ri < headerRows || isLetterCol,
        align: isLetterCol || ci === (opts?.letterCol ? 1 : 0) ? 'left' : 'center',
        size: opts?.fontSize ?? 7,
      })
      cx += widths[ci]
    }
    y += rowH
  }

  return y
}

/** Controlled-document stage label (fixed ranges on F/PRD/01). */
function stageRangeLabel(stage: CycleStage): string {
  return STAGE_RANGE_LABELS[stage]
}

function pickStageEntry(entries: CycleLogEntry[]): CycleLogEntry | undefined {
  if (entries.length === 0) return undefined
  const finished = entries.filter((e) => e.finish_ts)
  const open = entries.filter((e) => !e.finish_ts)
  if (open.length > 0) return open[open.length - 1]
  if (finished.length > 0) return finished[finished.length - 1]
  return entries[entries.length - 1]
}

function heatTimeBounds(cycleEntries: CycleLogEntry[]): {
  start: string | null
  finish: string | null
  totalMs: number
} {
  const starts = cycleEntries.map((e) => e.start_ts)
  const finishes = cycleEntries.filter((e) => e.finish_ts).map((e) => e.finish_ts!)
  if (starts.length === 0) {
    return { start: null, finish: null, totalMs: 0 }
  }
  const start = starts.sort()[0]
  const finish = finishes.length > 0 ? finishes.sort().slice(-1)[0] : null
  const totalMs =
    start && finish ? Math.max(0, new Date(finish).getTime() - new Date(start).getTime()) : 0
  return { start, finish, totalMs }
}

function aggregateMaterials(chargeLines: ChargeLine[], batchPlan: BatchPlan | null) {
  const variance = computePlanVariance(batchPlan, chargeLines)
  const codes = new Set<string>()
  for (const row of variance) codes.add(row.material_code)
  for (const line of chargeLines) codes.add(line.material_code)
  return [...codes].sort().map((code) => {
    const row = variance.find((r) => r.material_code === code)
    return {
      material_code: code,
      planned_kg: row?.planned_kg ?? 0,
      actual_kg: row?.actual_kg ?? chargeLines.filter((l) => l.material_code === code).reduce((s, l) => s + l.net_kg, 0),
    }
  })
}

function spectroElements(process: SpectroReport | null, finalReport: SpectroReport | null): string[] {
  const set = new Set<string>()
  for (const r of [process, finalReport]) {
    r?.composition.forEach((c) => set.add(c.element))
  }
  if (set.size === 0) return ['Si', 'Fe', 'Cu', 'Mn', 'Mg', 'Zn', 'Ni', 'Pb', 'Sn', 'Ti']
  return [...set].sort()
}

function pctForElement(report: SpectroReport | null, element: string): string {
  if (!report) return ''
  const entry = report.composition.find((c) => c.element === element)
  return entry ? entry.actual_pct.toFixed(3) : ''
}

function tempForCheckpoint(readings: TempReading[], checkpoint: string): TempReading | undefined {
  const matches = readings.filter((r) => r.checkpoint === checkpoint)
  return matches.sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0]
}

function drawHeader(doc: jsPDF, heat: Heat): number {
  let y = MARGIN
  const boxW = 52
  const boxH = 20
  const boxX = PAGE_W - MARGIN - boxW

  setFont(doc, 11, 'bold')
  doc.text(COMPANY_NAME, MARGIN, y + 4)

  doc.setDrawColor(0, 0, 0)
  doc.rect(boxX, y, boxW, boxH)
  setFont(doc, 6.5, 'normal')
  doc.text(`Doc No.: ${DOC_NO}`, boxX + 2, y + 4)
  doc.text(`Issue Date: ${ISSUE_DATE}`, boxX + 2, y + 8)
  doc.text(`Rev No.: ${REV_NO}`, boxX + 2, y + 12)
  doc.text(`Rev Date: ${REV_DATE}`, boxX + 2, y + 16)

  y += 10
  setFont(doc, 13, 'bold')
  doc.text(FORM_TITLE.toUpperCase(), PAGE_W / 2, y, { align: 'center' })
  y += 7

  const half = CONTENT_W / 2
  drawTable(
    doc,
    MARGIN,
    y,
    [half * 0.35, half * 0.65, half * 0.35, half * 0.65],
    [['Furnace No.', heat.furnace_code, 'Date', fmtDate(heat.created_at)]],
    { rowHeight: HDR_H, fontSize: 8 },
  )
  return y + HDR_H + 2
}

function drawHeatIdentity(doc: jsPDF, y: number, heat: Heat): number {
  const w = (CONTENT_W - 6) / 6
  return drawTable(
    doc,
    MARGIN,
    y,
    [w, w, w, w, w, w],
    [
      ['A', 'Heat No.', 'Customer Name', 'Alloy Grade', 'Shift', 'Shift Incharge', 'Operator / Helper'],
      [
        '',
        heat.heat_no,
        heat.customer ?? '',
        heat.grade_code,
        heat.shift_id ?? '',
        '',
        heat.crew.length > 0 ? heat.crew.join(', ') : '',
      ],
    ],
    { headerRows: 1, rowHeight: HDR_H, fontSize: 7, letterCol: true },
  ) + 2
}

function drawSection3(doc: jsPDF, y: number, data: HeatSheetData): number {
  const elements = spectroElements(data.processSpectro, data.finalSpectro)
  const bounds = heatTimeBounds(data.cycleEntries)
  const cw = CONTENT_W - 6

  const chemRows: string[][] = [
    ['B', 'Chemical Composition', 'Process Report (%)', 'Final Report (%)'],
    ...elements.map((el) => ['', el, pctForElement(data.processSpectro, el), pctForElement(data.finalSpectro, el)]),
  ]
  y = drawTable(
    doc,
    MARGIN,
    y,
    [cw * 0.22, cw * 0.39, cw * 0.39],
    chemRows,
    { headerRows: 1, rowHeight: ROW_H, letterCol: true },
  )

  y = drawTable(
    doc,
    MARGIN,
    y,
    [cw / 3, cw / 3, cw / 3],
    [
      ['', 'Heat Start Time', 'Heat Finish Time', 'Total Heat Time'],
      [
        '',
        bounds.start ? fmtTime(bounds.start) : '',
        bounds.finish ? fmtTime(bounds.finish) : '',
        bounds.totalMs > 0 ? fmtDurationHms(bounds.totalMs) : '',
      ],
    ],
    { rowHeight: HDR_H, fontSize: 7, letterCol: true },
  )

  const tempRows: string[][] = [['', 'Specified Temperature', 'Spec (°C)', 'Actual (°C)']]
  for (const cp of TEMP_CHECKPOINTS) {
    const reading = tempForCheckpoint(data.tempReadings, cp)
    const label = TEMP_CHECKPOINT_META[cp].en
    const spec =
      reading?.spec_min != null && reading?.spec_max != null
        ? `${reading.spec_min}–${reading.spec_max}`
        : reading?.spec_min != null
          ? `≥ ${reading.spec_min}`
          : reading?.spec_max != null
            ? `≤ ${reading.spec_max}`
            : ''
    tempRows.push(['', label, spec, reading ? String(reading.value) : ''])
  }

  y = drawTable(doc, MARGIN, y, [cw * 0.4, cw * 0.3, cw * 0.3], tempRows, {
    rowHeight: ROW_H,
    letterCol: true,
  })

  return y + 2
}

function drawMaterialInput(doc: jsPDF, y: number, data: HeatSheetData): number {
  const materials = aggregateMaterials(data.chargeLines, data.batchPlan)
  const cw = CONTENT_W - 6
  const rows: string[][] = [['C', 'Material Input', 'Planned (kg)', 'Actual (kg)']]
  if (materials.length === 0) {
    rows.push(['', '', '', ''])
  } else {
    for (const m of materials) {
      rows.push([
        '',
        m.material_code,
        m.planned_kg > 0 ? fmtNum(m.planned_kg, 0) : '',
        fmtNum(m.actual_kg, 1),
      ])
    }
  }
  return drawTable(doc, MARGIN, y, [cw * 0.46, cw * 0.27, cw * 0.27], rows, {
    headerRows: 1,
    rowHeight: ROW_H,
    letterCol: true,
  }) + 2
}

function drawCycleAnalysis(doc: jsPDF, y: number, data: HeatSheetData): number {
  const cw = CONTENT_W - 6
  const rows: string[][] = [['D', 'Cycle Time Analysis', 'Start Time', 'Finish Time', 'Total Time']]
  for (const stage of CYCLE_STAGES) {
    const entry = pickStageEntry(data.cycleEntries.filter((e) => e.stage === stage))
    const label = stageRangeLabel(stage)
    if (!entry) {
      rows.push(['', label, '', '', ''])
      continue
    }
    const totalMs =
      entry.finish_ts != null
        ? new Date(entry.finish_ts).getTime() - new Date(entry.start_ts).getTime()
        : 0
    rows.push([
      '',
      label,
      fmtTime(entry.start_ts),
      entry.finish_ts ? fmtTime(entry.finish_ts) : '',
      entry.finish_ts ? fmtDurationMinutes(totalMs) : '',
    ])
  }
  return drawTable(
    doc,
    MARGIN,
    y,
    [cw * 0.46, cw * 0.18, cw * 0.18, cw * 0.18],
    rows,
    { headerRows: 1, rowHeight: ROW_H, fontSize: 6.5, letterCol: true },
  ) + 2
}

function drawOutputAnalysis(doc: jsPDF, y: number, output: HeatOutput | null): number {
  const cw = CONTENT_W - 6
  const ingotKg = output?.ingot_kg
  const ironKg = output?.iron_kg
  const rejKg = output?.rejection_kg
  const burnKg = output?.burn_loss_kg

  const rows: string[][] = [
    ['E', 'Output Analysis', 'kg', '%'],
    ['', 'Finish Ingots', ingotKg != null ? fmtNum(ingotKg, 1) : '', output ? fmtPct(output.ingot_pct) : ''],
    ['', 'Iron', ironKg != null ? fmtNum(ironKg, 1) : '', output ? fmtPct(output.iron_pct) : ''],
    ['', 'Rejection', rejKg != null ? fmtNum(rejKg, 1) : '', output ? fmtPct(output.rejection_pct) : ''],
    ['', 'Burning Loss', burnKg != null ? fmtNum(burnKg, 1) : '', output ? fmtPct(output.burn_loss_pct) : ''],
    ['', 'Cover Flux', '', ''],
    ['', 'Degasser (count)', '', ''],
    ['', 'Die Coat', '', ''],
  ]

  return drawTable(doc, MARGIN, y, [cw * 0.5, cw * 0.25, cw * 0.25], rows, {
    headerRows: 1,
    rowHeight: ROW_H,
    letterCol: true,
  }) + 2
}

function drawFooterSections(doc: jsPDF, y: number, data: HeatSheetData): number {
  const cw = CONTENT_W - 6
  const totalInput = data.chargeLines.reduce((s, l) => s + l.net_kg, 0)
  const out = data.heatOutput
  const totalOutput =
    out != null
      ? out.ingot_kg +
        out.dross_kg +
        out.rejection_kg +
        out.iron_kg +
        out.burn_loss_kg +
        (out.exceptional_kg ?? 0)
      : null
  const variation =
    totalOutput != null && totalInput > 0 ? fmtNum(totalOutput - totalInput, 1) : ''

  y = drawTable(
    doc,
    MARGIN,
    y,
    [cw * 0.55, cw * 0.45],
    [
      ['F', 'Input vs Output Variation (kg)', variation],
      ['', 'Total Input (kg)', totalInput > 0 ? fmtNum(totalInput, 1) : ''],
      ['', 'Total Output (kg)', totalOutput != null ? fmtNum(totalOutput, 1) : ''],
    ],
    { rowHeight: ROW_H, letterCol: true },
  )

  y = drawTable(
    doc,
    MARGIN,
    y,
    [cw * 0.32, cw * 0.68],
    [
      ['', 'Man Power / Crew', data.heat.crew.length > 0 ? data.heat.crew.join(', ') : ''],
      ['', 'Remarks', ''],
    ],
    { rowHeight: 8, letterCol: true },
  )

  y = ensureSpace(doc, y, 14)
  doc.setDrawColor(0, 0, 0)
  doc.rect(MARGIN, y, CONTENT_W, 12)
  setFont(doc, 7, 'normal')
  doc.text('Supervisor / Shift Incharge Signature', MARGIN + 2, y + 4)
  doc.line(MARGIN + 2, y + 10, MARGIN + CONTENT_W * 0.55, y + 10)

  return y + 14
}

export function pickSpectroReports(reports: SpectroReport[]): {
  process: SpectroReport | null
  final: SpectroReport | null
} {
  const process = reports.find((r) => r.report_type === 'process') ?? null
  const final = reports.find((r) => r.report_type === 'final') ?? null
  return { process, final }
}

/** @deprecated use pickSpectroReports */
export function pickSpectroReport(reports: SpectroReport[]): SpectroReport | null {
  const { final, process } = pickSpectroReports(reports)
  return final ?? process
}

export function downloadHeatSheetPdf(data: HeatSheetData): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = drawHeader(doc, data.heat)
  y = drawHeatIdentity(doc, y, data.heat)
  y = drawSection3(doc, y, data)
  y = drawMaterialInput(doc, y, data)
  y = drawCycleAnalysis(doc, y, data)
  y = drawOutputAnalysis(doc, y, data.heatOutput)
  drawFooterSections(doc, y, data)

  const safeName = data.heat.heat_no.replace(/[^\w-]+/g, '_')
  doc.save(`DailyProductionSheet_${safeName}.pdf`)
}

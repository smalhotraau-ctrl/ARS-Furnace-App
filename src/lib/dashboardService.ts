import type { HeatOutput } from '../types/output'

export function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function isToday(iso: string): boolean {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10)
}

export interface AggregatedRecovery {
  heatCount: number
  ingot_kg: number
  dross_kg: number
  rejection_kg: number
  iron_kg: number
  burn_loss_kg: number
  ingot_pct: number
  dross_pct: number
  rejection_pct: number
  iron_pct: number
  burn_loss_pct: number
}

export function aggregateRecovery(outputs: HeatOutput[]): AggregatedRecovery | null {
  if (outputs.length === 0) return null

  const totals = outputs.reduce(
    (acc, o) => ({
      ingot_kg: acc.ingot_kg + o.ingot_kg,
      dross_kg: acc.dross_kg + o.dross_kg,
      rejection_kg: acc.rejection_kg + o.rejection_kg,
      iron_kg: acc.iron_kg + o.iron_kg,
      burn_loss_kg: acc.burn_loss_kg + o.burn_loss_kg,
    }),
    { ingot_kg: 0, dross_kg: 0, rejection_kg: 0, iron_kg: 0, burn_loss_kg: 0 },
  )

  const charged =
    totals.ingot_kg + totals.dross_kg + totals.rejection_kg + totals.iron_kg + totals.burn_loss_kg
  const pct = (kg: number) => (charged > 0 ? (kg / charged) * 100 : 0)

  return {
    heatCount: outputs.length,
    ...totals,
    ingot_pct: pct(totals.ingot_kg),
    dross_pct: pct(totals.dross_kg),
    rejection_pct: pct(totals.rejection_kg),
    iron_pct: pct(totals.iron_kg),
    burn_loss_pct: pct(totals.burn_loss_kg),
  }
}

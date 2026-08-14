export const PIT_ELEMENTS = ['Si', 'Fe', 'Cu', 'Mn', 'Mg', 'Zn'] as const

export type PitElement = (typeof PIT_ELEMENTS)[number]

export interface CompositionEntry {
  element: PitElement
  pct: number | null
}

export interface PitHeat {
  id: string
  date: string
  heat_no: string
  weight_kg: number
  ingot_kg: number
  dross_kg: number
  pit_iron_kg: number
  wood_fuel_kg: number
  composition: CompositionEntry[]
  sale_kg: number
  quality_recorded_by: string | null
  quality_recorded_at: string | null
  created_by: string
  created_at: string
  _localId?: string
  _pending?: boolean
}

export interface PitHeatInsert {
  date: string
  heat_no: string
  weight_kg: number
  ingot_kg: number
  dross_kg: number
  pit_iron_kg: number
  wood_fuel_kg: number
  composition: CompositionEntry[]
  sale_kg: number
  created_by: string
  idempotency_key: string
}

export interface PitBalanceRow {
  as_of_date: string
  balance_kg: number
}

export function emptyComposition(): CompositionEntry[] {
  return PIT_ELEMENTS.map((element) => ({ element, pct: null }))
}

export function isCompositionComplete(composition: CompositionEntry[]): boolean {
  return PIT_ELEMENTS.every((el) => {
    const entry = composition.find((c) => c.element === el)
    return entry?.pct != null && !Number.isNaN(entry.pct)
  })
}

export function computeBalanceFromHeats(heats: PitHeat[], asOfDate: string): number {
  return heats
    .filter((h) => h.date <= asOfDate)
    .reduce((sum, h) => sum + h.ingot_kg - h.sale_kg, 0)
}

export function nextHeatNo(existingHeats: PitHeat[], referenceDate = new Date()): string {
  const year = referenceDate.getFullYear() % 100
  const prefix = `PT-${String(year).padStart(2, '0')}-`
  const nums = existingHeats
    .filter((h) => h.heat_no.startsWith(prefix))
    .map((h) => parseInt(h.heat_no.slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n))
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

export function parseComposition(raw: unknown): CompositionEntry[] {
  if (!Array.isArray(raw)) return emptyComposition()
  return PIT_ELEMENTS.map((element) => {
    const found = raw.find(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        'element' in entry &&
        entry.element === element,
    ) as { pct?: number | null } | undefined
    return { element, pct: found?.pct ?? null }
  })
}

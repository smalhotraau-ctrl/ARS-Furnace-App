import type { PitHeat, PitHeatInsert } from '../types/pitFurnace'
import { parseComposition } from '../types/pitFurnace'

const CACHE_KEY = 'furnace:pit_heats'
const QUEUE_KEY = 'furnace:pit_heats_queue'

export interface PendingInsert {
  kind: 'insert'
  localId: string
  payload: PitHeatInsert
  createdAt: string
}

export interface PendingQualityUpdate {
  kind: 'quality_update'
  heatId: string
  localId?: string
  composition: PitHeat['composition']
  qualityRecordedBy: string
  qualityRecordedAt: string
}

export type PendingAction = PendingInsert | PendingQualityUpdate

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getCachedPitHeats(): PitHeat[] {
  return readJson<PitHeat[]>(CACHE_KEY, [])
}

export function setCachedPitHeats(heats: PitHeat[]) {
  writeJson(CACHE_KEY, heats)
}

export function mergeCachedPitHeats(serverHeats: PitHeat[]): PitHeat[] {
  const cached = getCachedPitHeats()
  const pending = getPendingActions()
  const pendingLocalIds = new Set(
    pending.filter((p) => p.kind === 'insert').map((p) => p.localId),
  )

  const merged = new Map<string, PitHeat>()

  for (const heat of serverHeats) {
    merged.set(heat.id, heat)
  }

  for (const heat of cached) {
    if (heat._localId && pendingLocalIds.has(heat._localId)) {
      merged.set(heat._localId, heat)
    }
  }

  return [...merged.values()].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
}

export function getPendingActions(): PendingAction[] {
  return readJson<PendingAction[]>(QUEUE_KEY, [])
}

export function setPendingActions(actions: PendingAction[]) {
  writeJson(QUEUE_KEY, actions)
}

export function enqueueAction(action: PendingAction) {
  setPendingActions([...getPendingActions(), action])
}

export function removePendingByLocalId(localId: string) {
  setPendingActions(getPendingActions().filter((a) => {
    if (a.kind === 'insert') return a.localId !== localId
    return a.localId !== localId
  }))
}

export function removePendingQualityUpdate(heatId: string) {
  setPendingActions(
    getPendingActions().filter(
      (a) => !(a.kind === 'quality_update' && a.heatId === heatId),
    ),
  )
}

export function addLocalPitHeat(heat: PitHeat) {
  const cached = getCachedPitHeats()
  setCachedPitHeats([heat, ...cached.filter((h) => h.id !== heat.id && h._localId !== heat._localId)])
}

export function updateLocalPitHeat(id: string, patch: Partial<PitHeat>) {
  const cached = getCachedPitHeats()
  setCachedPitHeats(
    cached.map((h) => (h.id === id || h._localId === id ? { ...h, ...patch } : h)),
  )
}

export function rowToPitHeat(row: Record<string, unknown>): PitHeat {
  return {
    id: String(row.id),
    date: String(row.date),
    heat_no: String(row.heat_no),
    weight_kg: Number(row.weight_kg),
    ingot_kg: Number(row.ingot_kg),
    dross_kg: Number(row.dross_kg),
    pit_iron_kg: Number(row.pit_iron_kg),
    wood_fuel_kg: Number(row.wood_fuel_kg),
    composition: parseComposition(row.composition),
    sale_kg: Number(row.sale_kg),
    quality_recorded_by: row.quality_recorded_by ? String(row.quality_recorded_by) : null,
    quality_recorded_at: row.quality_recorded_at ? String(row.quality_recorded_at) : null,
    created_by: String(row.created_by),
    created_at: String(row.created_at),
  }
}

export function getPendingCount(): number {
  return getPendingActions().length
}

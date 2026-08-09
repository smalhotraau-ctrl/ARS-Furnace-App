import { supabase } from './supabaseClient'
import {
  addLocalPitHeat,
  enqueueAction,
  getCachedPitHeats,
  getPendingActions,
  mergeCachedPitHeats,
  removePendingByLocalId,
  removePendingQualityUpdate,
  rowToPitHeat,
  setCachedPitHeats,
  setPendingActions,
  updateLocalPitHeat,
} from './offlineStore'
import type { AppUser } from '../types/auth'
import {
  computeBalanceFromHeats,
  emptyComposition,
  nextHeatNo,
  type CompositionEntry,
  type PitHeat,
  type PitHeatInsert,
} from '../types/pitFurnace'

const furnace = () => supabase.schema('furnace')

export async function fetchPitHeats(): Promise<PitHeat[]> {
  const { data, error } = await furnace().from('pit_heats').select('*').order('date', { ascending: false }).order('created_at', { ascending: false })

  if (error) throw error

  const serverHeats = (data ?? []).map((row) => rowToPitHeat(row as Record<string, unknown>))
  const merged = mergeCachedPitHeats(serverHeats)
  setCachedPitHeats(merged)
  return merged
}

export async function fetchPitBalance(asOfDate: string): Promise<number> {
  const { data, error } = await furnace()
    .from('pit_balance')
    .select('balance_kg')
    .eq('as_of_date', asOfDate)
    .maybeSingle()

  if (!error && data) {
    return Number(data.balance_kg)
  }

  const heats = getCachedPitHeats()
  return computeBalanceFromHeats(heats, asOfDate)
}

export async function saveProductionEntry(
  user: AppUser,
  payload: Omit<PitHeatInsert, 'created_by' | 'composition' | 'heat_no'> & { heat_no?: string },
  heats: PitHeat[],
): Promise<PitHeat> {
  const heatNo = payload.heat_no ?? nextHeatNo(heats, new Date(payload.date))

  const insert: PitHeatInsert = {
    ...payload,
    heat_no: heatNo,
    composition: emptyComposition(),
    created_by: user.id,
  }

  const localId = crypto.randomUUID()
  const localHeat: PitHeat = {
    id: localId,
    _localId: localId,
    _pending: true,
    date: insert.date,
    heat_no: insert.heat_no,
    weight_kg: insert.weight_kg,
    ingot_kg: insert.ingot_kg,
    dross_kg: insert.dross_kg,
    pit_iron_kg: insert.pit_iron_kg,
    wood_fuel_kg: insert.wood_fuel_kg,
    composition: insert.composition,
    sale_kg: insert.sale_kg,
    quality_recorded_by: null,
    quality_recorded_at: null,
    created_by: user.id,
    created_at: new Date().toISOString(),
  }

  addLocalPitHeat(localHeat)
  enqueueAction({ kind: 'insert', localId, payload: insert, createdAt: new Date().toISOString() })

  void syncPendingActions(user)

  return localHeat
}

export async function saveQualityEntry(user: AppUser, heat: PitHeat, composition: CompositionEntry[]): Promise<PitHeat> {
  const now = new Date().toISOString()
  const updated: PitHeat = {
    ...heat,
    composition,
    quality_recorded_by: user.id,
    quality_recorded_at: now,
    _pending: true,
  }

  updateLocalPitHeat(heat.id, updated)

  if (heat._localId) {
    const pending = getPendingActions()
    const insertAction = pending.find((a) => a.kind === 'insert' && a.localId === heat._localId)
    if (insertAction && insertAction.kind === 'insert') {
      insertAction.payload.composition = composition
    }
    setPendingActions(pending)
  } else {
    enqueueAction({
      kind: 'quality_update',
      heatId: heat.id,
      composition,
      qualityRecordedBy: user.id,
      qualityRecordedAt: now,
    })
  }

  void syncPendingActions(user)

  return updated
}

export async function syncPendingActions(_user: AppUser): Promise<number> {
  if (!navigator.onLine) return getPendingActions().length

  const pending = [...getPendingActions()]
  let remaining = pending.length

  for (const action of pending) {
    if (action.kind === 'insert') {
      const { data, error } = await furnace()
        .from('pit_heats')
        .insert(action.payload)
        .select('*')
        .single()

      if (error) continue

      const synced = rowToPitHeat(data as Record<string, unknown>)
      removePendingByLocalId(action.localId)
      updateLocalPitHeat(action.localId, { ...synced, _localId: undefined, _pending: false })
      remaining -= 1
    }

    if (action.kind === 'quality_update') {
      const { error } = await furnace()
        .from('pit_heats')
        .update({
          composition: action.composition,
          quality_recorded_by: action.qualityRecordedBy,
          quality_recorded_at: action.qualityRecordedAt,
        })
        .eq('id', action.heatId)

      if (error) continue

      removePendingQualityUpdate(action.heatId)
      updateLocalPitHeat(action.heatId, {
        composition: action.composition,
        quality_recorded_by: action.qualityRecordedBy,
        quality_recorded_at: action.qualityRecordedAt,
        _pending: false,
      })
      remaining -= 1
    }
  }

  setCachedPitHeats(getCachedPitHeats())
  return remaining
}

export function loadLocalPitHeats(): PitHeat[] {
  return getCachedPitHeats()
}

export { getPendingCount } from './offlineStore'

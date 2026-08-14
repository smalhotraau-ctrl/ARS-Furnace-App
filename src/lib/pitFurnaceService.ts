import { supabase } from './supabaseClient'
import { createInFlightLock, insertIdempotent } from './offlineQueueSync'
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
  payload: Omit<PitHeatInsert, 'created_by' | 'composition' | 'heat_no' | 'idempotency_key'> & { heat_no?: string },
  heats: PitHeat[],
): Promise<PitHeat> {
  const heatNo = payload.heat_no ?? nextHeatNo(heats, new Date(payload.date))
  const localId = crypto.randomUUID()

  const insert: PitHeatInsert = {
    ...payload,
    heat_no: heatNo,
    composition: emptyComposition(),
    created_by: user.id,
    idempotency_key: localId,
  }
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

// Only one flush of the pit-furnace queue may run at a time — same rationale as every other
// module's sync lock: without it, concurrent triggers (online listener, post-save fire-and-forget
// sync, another tab) could each read their own snapshot of the queue and double-submit an action
// before either flush had a chance to remove it.
const withPitSyncLock = createInFlightLock<number>()

export function syncPendingActions(user: AppUser): Promise<number> {
  return withPitSyncLock(() => runPitSync(user))
}

async function runPitSync(_user: AppUser): Promise<number> {
  if (!navigator.onLine) return getPendingActions().length

  const pending = [...getPendingActions()]
  let remaining = pending.length

  for (const action of pending) {
    if (action.kind === 'insert') {
      const { row, error } = await insertIdempotent(furnace, 'pit_heats', action.payload as unknown as Record<string, unknown>)
      if (error || !row) continue

      const synced = rowToPitHeat(row)
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

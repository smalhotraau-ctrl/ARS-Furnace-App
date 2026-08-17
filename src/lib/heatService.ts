import { supabase } from './supabaseClient'
import { maybeFlagCycleStageOvertime } from './cycleTimeService'
import { insertIdempotent } from './offlineQueueSync'
import {
  addLocalChargeLine,
  addLocalCycleEntry,
  addLocalTempReading,
  clearHeatSyncErrors,
  enqueueHeatAction,
  getCachedChargeLines,
  getCachedCycleLog,
  getCachedHeats,
  getCachedTempReadings,
  getHeatIdAliases,
  getHeatQueue,
  getHeatSyncErrors,
  removeHeatQueueAction,
  repointHeatDependents,
  resolveHeatId,
  rowToCancelRequest,
  rowToChargeLine,
  rowToCycleEntry,
  rowToHeat,
  rowToHeatNoCorrection,
  rowToTempReading,
  setCachedChargeLines,
  setCachedCycleLog,
  setCachedHeats,
  setCachedTempReadings,
  setHeatSyncErrors,
  updateLocalCycleEntry,
  updateLocalHeat,
  upsertLocalHeat,
} from './heatOfflineStore'
import {
  formatHeatNo,
  heatNoPrefix,
  isPendingSyncHeatNo,
  nextSequenceFromHeatNos,
  pendingSyncHeatNo,
} from './heatNumber'
import type { AppUser } from '../types/auth'
import type {
  ChargeLine,
  ChargeLineInsert,
  CycleLogEntry,
  CycleLogInsert,
  CycleStage,
  Heat,
  HeatCancelRequest,
  HeatInsert,
  HeatNoCorrection,
  HeatStatus,
  TempReading,
  TempReadingInsert,
} from '../types/heat'
import { isActiveHeat } from '../types/heat'
import type { BatchPlan } from '../types/batchPlan'
import type { FurnaceOption, MaterialOption } from '../types/batchPlan'
import { parseExpectedComposition, parsePlannedLines } from '../types/batchPlan'
import {
  deriveHeatStatus,
  heatStatusForCycleStage,
  shouldAdvanceHeatStatus,
} from './heatStatus'

const furnace = () => supabase.schema('furnace')

function mergeFetchedHeats(serverHeats: Heat[], localPending: Heat[]): Heat[] {
  const merged = new Map<string, Heat>()
  const byHeatNo = new Map<string, Heat>()

  for (const heat of serverHeats) {
    merged.set(heat.id, heat)
    byHeatNo.set(heat.heat_no, heat)
  }

  for (const local of localPending) {
    const serverMatch =
      byHeatNo.get(local.heat_no) ??
      merged.get(local.id) ??
      (local._localId ? merged.get(local._localId) : undefined) ??
      [...merged.values()].find((h) => h._localId === local.id || h._localId === local._localId)

    if (serverMatch) {
      merged.set(serverMatch.id, {
        ...serverMatch,
        ...local,
        id: serverMatch.id,
        _localId: local._localId ?? serverMatch._localId,
      })
      continue
    }
    merged.set(local.id, local)
  }

  const dedupedByHeatNo = new Map<string, Heat>()
  for (const heat of merged.values()) {
    const existing = dedupedByHeatNo.get(heat.heat_no)
    if (!existing) {
      dedupedByHeatNo.set(heat.heat_no, heat)
      continue
    }
    if (existing._pending && !heat._pending) {
      dedupedByHeatNo.set(heat.heat_no, heat)
    } else if (!existing._pending && heat._pending) {
      continue
    } else if ((heat.updated_at ?? heat.created_at) > (existing.updated_at ?? existing.created_at)) {
      dedupedByHeatNo.set(heat.heat_no, heat)
    }
  }

  return [...dedupedByHeatNo.values()].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

function entriesLinked(a: CycleLogEntry, b: CycleLogEntry): boolean {
  return (
    a.id === b.id ||
    a._localId === b.id ||
    b._localId === a.id ||
    (a._localId != null && a._localId === b._localId)
  )
}

function mergeFetchedCycleEntries(serverEntries: CycleLogEntry[], localPending: CycleLogEntry[]): CycleLogEntry[] {
  const merged = new Map<string, CycleLogEntry>()

  for (const entry of serverEntries) {
    merged.set(entry.id, entry)
  }

  for (const local of localPending) {
    const serverMatch = [...merged.values()].find((e) => entriesLinked(e, local))
    if (serverMatch) {
      merged.set(serverMatch.id, {
        ...serverMatch,
        ...local,
        id: serverMatch.id,
        finish_ts: local.finish_ts ?? serverMatch.finish_ts,
        _localId: local._localId ?? serverMatch._localId,
      })
      if (local.id !== serverMatch.id) merged.delete(local.id)
    } else {
      merged.set(local.id, local)
    }
  }

  // One row per heat+stage — prefer finished over orphan pending duplicates.
  const byStage = new Map<string, CycleLogEntry>()
  for (const entry of merged.values()) {
    const key = `${entry.heat_id}:${entry.stage}`
    const existing = byStage.get(key)
    if (!existing) {
      byStage.set(key, entry)
      continue
    }
    if (!existing.finish_ts && entry.finish_ts) {
      byStage.set(key, entry)
      continue
    }
    if (existing.finish_ts && !entry.finish_ts) continue
    if (existing._pending && !entry._pending) {
      byStage.set(key, entry)
      continue
    }
    if (!existing._pending && entry._pending) continue
    if (entry.start_ts >= existing.start_ts) byStage.set(key, entry)
  }

  return [...byStage.values()].sort((a, b) => a.start_ts.localeCompare(b.start_ts))
}

async function reconcileStaleHeatStatuses(heats: Heat[]): Promise<Heat[]> {
  if (!navigator.onLine) return heats

  const candidates = heats.filter((h) => isActiveHeat(h.status) && h.status !== 'Output Entered')
  if (candidates.length === 0) return heats

  const ids = candidates.map((h) => h.id)
  const [{ data: cycleRows, error: cycleErr }, { data: chargeRows, error: chargeErr }] =
    await Promise.all([
      furnace().from('cycle_log').select('heat_id, stage').in('heat_id', ids),
      furnace().from('charge_lines').select('heat_id').in('heat_id', ids),
    ])

  if (cycleErr || chargeErr) return heats

  const cyclesByHeat = new Map<string, CycleLogEntry[]>()
  for (const row of cycleRows ?? []) {
    const heatId = String(row.heat_id)
    const entry = rowToCycleEntry(row as Record<string, unknown>)
    const list = cyclesByHeat.get(heatId) ?? []
    list.push(entry)
    cyclesByHeat.set(heatId, list)
  }

  const heatsWithCharges = new Set((chargeRows ?? []).map((row) => String(row.heat_id)))
  const now = new Date().toISOString()
  const patched = new Map<string, HeatStatus>()

  for (const heat of candidates) {
    const derived = deriveHeatStatus(
      heat.status,
      cyclesByHeat.get(heat.id) ?? [],
      heatsWithCharges.has(heat.id),
    )
    if (shouldAdvanceHeatStatus(heat.status, derived)) {
      patched.set(heat.id, derived)
      updateLocalHeat(heat.id, { status: derived, updated_at: now })
      enqueueHeatAction({
        kind: 'heat_update',
        heatId: heat.id,
        localId: heat._localId,
        payload: { status: derived, updated_at: now },
      })
    }
  }

  if (patched.size > 0) {
    void syncHeatQueue()
  }

  return heats.map((heat) => {
    const status = patched.get(heat.id)
    return status ? { ...heat, status, updated_at: now } : heat
  })
}

function advanceHeatStatusFromStage(user: AppUser, heatId: string, stage: CycleStage): void {
  const heat = getCachedHeats().find((h) => h.id === heatId || h._localId === heatId)
  if (!heat) return

  const target = heatStatusForCycleStage(stage)
  if (!shouldAdvanceHeatStatus(heat.status, target)) return

  const now = new Date().toISOString()
  updateLocalHeat(heat.id, { status: target, updated_at: now, updated_by: user.id })
  enqueueHeatAction({
    kind: 'heat_update',
    heatId: heat.id,
    localId: heat._localId,
    payload: { status: target, updated_at: now, updated_by: user.id },
  })
}

function advanceHeatStatusToCharging(user: AppUser, heatId: string): void {
  advanceHeatStatusFromStage(user, heatId, 'charging')
}

function formatQueueSyncError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Sync failed — try again.'
  const e = error as { code?: string; message?: string }
  if (e.code === '23503') {
    return 'Could not save — the heat is still syncing to the server. Wait a moment, then reload.'
  }
  if (e.code === '42501') {
    return 'Permission denied — your role cannot save this entry.'
  }
  if (e.message) return e.message
  return 'Sync failed — try again.'
}

export { getHeatSyncErrors }

export async function fetchHeats(): Promise<Heat[]> {
  const { data, error } = await furnace()
    .from('heats')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  const previousById = new Map(getCachedHeats().map((h) => [h.id, h]))
  const serverHeats = (data ?? []).map((row) => {
    const heat = rowToHeat(row as Record<string, unknown>)
    const previousLocalId = previousById.get(heat.id)?._localId
    return previousLocalId ? { ...heat, _localId: previousLocalId } : heat
  })
  const localPending = getCachedHeats().filter((h) => h._pending)
  let result = mergeFetchedHeats(serverHeats, localPending)
  result = await reconcileStaleHeatStatuses(result)
  setCachedHeats(result)
  return result
}

export async function fetchChargeLines(heatId?: string): Promise<ChargeLine[]> {
  let query = furnace().from('charge_lines').select('*').order('added_at', { ascending: false })
  if (heatId) query = query.eq('heat_id', heatId)

  const { data, error } = await query
  if (error) throw error

  const serverLines = (data ?? []).map((row) => rowToChargeLine(row as Record<string, unknown>))
  const heatAliases = heatId ? getHeatIdAliases(heatId) : null
  const localLines = getCachedChargeLines().filter(
    (l) => l._pending && (!heatId || heatAliases!.has(l.heat_id)),
  )
  const merged = new Map<string, ChargeLine>()
  for (const l of serverLines) merged.set(l.id, l)
  for (const l of localLines) merged.set(l.id, l)

  const result = [...merged.values()]
  setCachedChargeLines(result)
  return heatId ? result.filter((l) => getHeatIdAliases(heatId).has(l.heat_id)) : result
}

export async function fetchCycleLog(heatId?: string): Promise<CycleLogEntry[]> {
  let query = furnace().from('cycle_log').select('*').order('start_ts', { ascending: true })
  if (heatId) query = query.eq('heat_id', heatId)

  const { data, error } = await query
  if (error) throw error

  // A server-authoritative refresh (page load, the `online` reconnect listener, etc.) must not
  // erase `_localId` from an entry that's already synced — a `cycle_finish` action queued before
  // this refresh (or before its own sync ran) only knows the row by that old client-generated id,
  // and relies on `_localId` still being on the cache entry to resolve the real row later (see the
  // cycle_finish handler in runHeatQueueSync). Carrying it forward here closes that gap.
  const previousById = new Map(getCachedCycleLog().map((e) => [e.id, e]))
  const serverEntries = (data ?? []).map((row) => {
    const entry = rowToCycleEntry(row as Record<string, unknown>)
    const previousLocalId = previousById.get(entry.id)?._localId
    return previousLocalId ? { ...entry, _localId: previousLocalId } : entry
  })
  const localEntries = getCachedCycleLog().filter(
    (e) => e._pending && (!heatId || getHeatIdAliases(heatId).has(e.heat_id)),
  )
  const result = mergeFetchedCycleEntries(serverEntries, localEntries)
  setCachedCycleLog(result)
  return heatId ? result.filter((e) => getHeatIdAliases(heatId).has(e.heat_id)) : result
}

export async function fetchTempReadings(heatId?: string): Promise<TempReading[]> {
  let query = furnace().from('temp_readings').select('*').order('recorded_at', { ascending: false })
  if (heatId) query = query.eq('heat_id', heatId)

  const { data, error } = await query
  if (error) throw error

  const serverReadings = (data ?? []).map((row) => rowToTempReading(row as Record<string, unknown>))
  const localReadings = getCachedTempReadings().filter(
    (r) => r._pending && (!heatId || getHeatIdAliases(heatId).has(r.heat_id)),
  )
  const merged = new Map<string, TempReading>()
  for (const r of serverReadings) merged.set(r.id, r)
  for (const r of localReadings) merged.set(r.id, r)

  const result = [...merged.values()]
  setCachedTempReadings(result)
  return heatId ? result.filter((r) => getHeatIdAliases(heatId).has(r.heat_id)) : result
}

export async function fetchFurnaceWithLetter(code: string): Promise<{ code: string; heat_code_letter: string | null } | null> {
  const { data, error } = await furnace()
    .from('furnaces')
    .select('code, heat_code_letter')
    .eq('code', code)
    .maybeSingle()

  if (error || !data) return null
  return { code: String(data.code), heat_code_letter: data.heat_code_letter ? String(data.heat_code_letter) : null }
}

export async function generateNextHeatNo(furnaceCode: string, furnaceLetter: string, startDate = new Date()): Promise<string> {
  const prefix = heatNoPrefix(furnaceLetter, startDate)
  const { data, error } = await furnace()
    .from('heats')
    .select('heat_no')
    .eq('furnace_code', furnaceCode)
    .like('heat_no', `${prefix}%`)

  if (error) throw error

  const heatNos = (data ?? []).map((row) => String(row.heat_no))
  const localNos = getCachedHeats()
    .filter((h) => h.furnace_code === furnaceCode && h.heat_no.startsWith(prefix))
    .map((h) => h.heat_no)

  return formatHeatNo(furnaceLetter, startDate, nextSequenceFromHeatNos([...heatNos, ...localNos], prefix))
}

export function getActiveHeatForFurnace(furnaceCode: string, heats: Heat[]): Heat | undefined {
  return heats.find((h) => h.furnace_code === furnaceCode && isActiveHeat(h.status))
}

export async function startHeat(
  user: AppUser,
  params: {
    furnace_code: string
    grade_code: string
    batch_plan_id: string | null
    customer: string | null
    fuel_reading: number | null
    emergency: boolean
  },
  heats: Heat[],
): Promise<{ heat: Heat; error?: string }> {
  const active = getActiveHeatForFurnace(params.furnace_code, heats)
  if (active) {
    return { heat: active, error: 'An active heat already exists on this furnace.' }
  }

  if (params.batch_plan_id && heats.some((h) => h.batch_plan_id === params.batch_plan_id)) {
    return { heat: {} as Heat, error: 'That batch plan is already linked to a heat.' }
  }

  const localId = crypto.randomUUID()
  const now = new Date().toISOString()
  let heatNo: string
  let emergency = params.emergency

  if (params.emergency || !navigator.onLine) {
    if (!params.emergency) {
      return { heat: {} as Heat, error: 'Connection required to start a heat. Use Emergency Start if offline.' }
    }
    heatNo = pendingSyncHeatNo(localId)
    emergency = true
  } else {
    const furnaceInfo = await fetchFurnaceWithLetter(params.furnace_code)
    if (!furnaceInfo?.heat_code_letter) {
      return { heat: {} as Heat, error: 'Furnace has no heat code letter configured.' }
    }
    heatNo = await generateNextHeatNo(params.furnace_code, furnaceInfo.heat_code_letter)
  }

  const insert: HeatInsert = {
    heat_no: heatNo,
    furnace_code: params.furnace_code,
    batch_plan_id: params.batch_plan_id,
    grade_code: params.grade_code,
    customer: params.customer,
    crew: [],
    status: 'Planned',
    fuel_reading: params.fuel_reading,
    created_by: user.id,
    idempotency_key: localId,
  }

  const localHeat: Heat = {
    id: localId,
    _localId: localId,
    _pending: true,
    _emergency: emergency,
    ...insert,
    shift_id: null,
    verified_by: null,
    verified_at: null,
    created_at: now,
    updated_by: null,
    updated_at: null,
  }

  upsertLocalHeat(localHeat)
  enqueueHeatAction({ kind: 'heat_insert', localId, payload: insert, emergency })

  if (navigator.onLine) void syncHeatQueue()

  return { heat: localHeat }
}

export async function addChargeLine(
  user: AppUser,
  insert: Omit<ChargeLineInsert, 'created_by' | 'added_at' | 'idempotency_key'>,
): Promise<ChargeLine> {
  const now = new Date().toISOString()
  const localId = crypto.randomUUID()
  const heatId = resolveHeatId(insert.heat_id)
  const payload: ChargeLineInsert = {
    ...insert,
    heat_id: heatId,
    added_at: now,
    created_by: user.id,
    idempotency_key: localId,
  }

  const line: ChargeLine = {
    id: localId,
    _localId: localId,
    _pending: true,
    ...payload,
    created_at: now,
  }

  addLocalChargeLine(line)
  enqueueHeatAction({ kind: 'charge_insert', localId, payload: payload as unknown as Record<string, unknown> })

  advanceHeatStatusToCharging(user, heatId)

  if (navigator.onLine) void syncHeatQueue()
  return line
}

export async function startCycleStage(user: AppUser, heatId: string, stage: CycleStage): Promise<CycleLogEntry> {
  const now = new Date().toISOString()
  const localId = crypto.randomUUID()
  const resolvedHeatId = resolveHeatId(heatId)
  const payload: CycleLogInsert = {
    heat_id: resolvedHeatId,
    stage,
    start_ts: now,
    finish_ts: null,
    recorded_by: user.id,
    idempotency_key: localId,
  }

  const entry: CycleLogEntry = {
    id: localId,
    _localId: localId,
    _pending: true,
    ...payload,
    recorded_at: now,
  }

  addLocalCycleEntry(entry)
  enqueueHeatAction({ kind: 'cycle_insert', localId, payload: payload as unknown as Record<string, unknown> })
  advanceHeatStatusFromStage(user, heatId, stage)
  if (navigator.onLine) void syncHeatQueue()
  return entry
}

export async function finishCycleStage(entry: CycleLogEntry): Promise<CycleLogEntry> {
  const finish_ts = new Date().toISOString()
  updateLocalCycleEntry(entry.id, { finish_ts, _pending: true })
  enqueueHeatAction({
    kind: 'cycle_finish',
    entryId: entry.id,
    localId: entry._localId,
    finish_ts,
  })
  maybeFlagCycleStageOvertime(entry, finish_ts)
  if (navigator.onLine) void syncHeatQueue()
  return { ...entry, finish_ts, _pending: true }
}

export async function addTempReading(
  user: AppUser,
  insert: Omit<TempReadingInsert, 'recorded_by' | 'idempotency_key'>,
): Promise<TempReading> {
  const now = new Date().toISOString()
  const localId = crypto.randomUUID()
  const payload: TempReadingInsert = {
    ...insert,
    heat_id: resolveHeatId(insert.heat_id),
    recorded_by: user.id,
    idempotency_key: localId,
  }

  const reading: TempReading = {
    id: localId,
    _localId: localId,
    _pending: true,
    ...payload,
    recorded_at: now,
  }

  addLocalTempReading(reading)
  enqueueHeatAction({ kind: 'temp_insert', localId, payload: payload as unknown as Record<string, unknown> })
  if (navigator.onLine) void syncHeatQueue()
  return reading
}

export async function submitCancelRequest(user: AppUser, heatId: string, reason: string): Promise<void> {
  const localId = crypto.randomUUID()
  const payload = {
    heat_id: heatId,
    requested_by: user.id,
    reason,
    status: 'pending',
    idempotency_key: localId,
  }
  enqueueHeatAction({ kind: 'cancel_request', localId, payload })
  if (navigator.onLine) void syncHeatQueue()
}

export async function decideCancelRequest(
  user: AppUser,
  requestId: string,
  heatId: string,
  approve: boolean,
  decision_note: string | null,
): Promise<void> {
  const payload = {
    status: approve ? 'approved' : 'rejected',
    decided_by: user.id,
    decided_at: new Date().toISOString(),
    decision_note,
  }
  enqueueHeatAction({ kind: 'cancel_decide', requestId, payload })
  if (approve) {
    updateLocalHeat(heatId, { status: 'Cancelled' })
    enqueueHeatAction({
      kind: 'heat_update',
      heatId,
      payload: { status: 'Cancelled', updated_at: new Date().toISOString() },
    })
  }
  if (navigator.onLine) void syncHeatQueue()
}

export async function submitHeatNoCorrection(
  user: AppUser,
  heatId: string,
  original_heat_no: string,
  requested_heat_no: string,
  reason: string,
): Promise<void> {
  const localId = crypto.randomUUID()
  enqueueHeatAction({
    kind: 'correction_request',
    localId,
    payload: {
      heat_id: heatId,
      original_heat_no,
      requested_heat_no,
      requested_by: user.id,
      reason,
      status: 'pending',
      idempotency_key: localId,
    },
  })
  if (navigator.onLine) void syncHeatQueue()
}

export async function decideHeatNoCorrection(
  user: AppUser,
  requestId: string,
  heatId: string,
  requested_heat_no: string,
  approve: boolean,
): Promise<void> {
  enqueueHeatAction({
    kind: 'correction_decide',
    requestId,
    payload: {
      status: approve ? 'approved' : 'rejected',
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    },
  })
  if (approve) {
    updateLocalHeat(heatId, { heat_no: requested_heat_no })
    enqueueHeatAction({
      kind: 'heat_update',
      heatId,
      payload: { heat_no: requested_heat_no, updated_at: new Date().toISOString() },
    })
  }
  if (navigator.onLine) void syncHeatQueue()
}

export async function fetchCancelRequests(): Promise<HeatCancelRequest[]> {
  const { data, error } = await furnace()
    .from('heat_cancel_requests')
    .select('*')
    .order('requested_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => rowToCancelRequest(row as Record<string, unknown>))
}

export async function fetchHeatNoCorrections(): Promise<HeatNoCorrection[]> {
  const { data, error } = await furnace()
    .from('heat_no_corrections')
    .select('*')
    .order('requested_at', { ascending: false })

  if (error) throw error
  return (data ?? []).map((row) => rowToHeatNoCorrection(row as Record<string, unknown>))
}

export async function fetchMainFurnacesForHeat(): Promise<FurnaceOption[]> {
  const { data, error } = await furnace()
    .from('furnaces')
    .select('code, name, type')
    .eq('active', true)
    .eq('type', 'main')
    .order('code')

  if (error) throw error
  return (data ?? []) as FurnaceOption[]
}

export async function fetchActiveMaterials(): Promise<MaterialOption[]> {
  const { data, error } = await furnace()
    .from('materials')
    .select('code, name')
    .eq('active', true)
    .order('code')

  if (error) throw error
  return (data ?? []) as MaterialOption[]
}

export async function fetchBatchPlansForHeat(): Promise<BatchPlan[]> {
  const { data, error } = await furnace()
    .from('batch_plans')
    .select('*')
    .order('plan_date', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: String(row.id),
    furnace_code: row.furnace_code != null ? String(row.furnace_code) : null,
    grade_code: String(row.grade_code),
    plan_date: String(row.plan_date),
    planned_lines: parsePlannedLines(row.planned_lines),
    expected_composition: parseExpectedComposition(row.expected_composition),
    status: String(row.status),
    owner_reviewed: Boolean(row.owner_reviewed),
    owner_reviewed_by: row.owner_reviewed_by ? String(row.owner_reviewed_by) : null,
    owner_reviewed_at: row.owner_reviewed_at ? String(row.owner_reviewed_at) : null,
    owner_review_note: row.owner_review_note ? String(row.owner_review_note) : null,
    created_by: String(row.created_by),
    created_at: String(row.created_at),
    updated_by: row.updated_by ? String(row.updated_by) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  }))
}

export function computePlanVariance(
  batchPlan: BatchPlan | null,
  chargeLines: ChargeLine[],
): Array<{ material_code: string; planned_kg: number; actual_kg: number; flag: 'in_spec' | 'out_of_spec' }> {
  if (!batchPlan) return []

  const actualByMaterial = new Map<string, number>()
  for (const line of chargeLines) {
    actualByMaterial.set(
      line.material_code,
      (actualByMaterial.get(line.material_code) ?? 0) + line.net_kg,
    )
  }

  const plannedMaterials = new Set(batchPlan.planned_lines.map((p) => p.material_code))
  const rows = batchPlan.planned_lines.map((planned) => {
    const actual_kg = actualByMaterial.get(planned.material_code) ?? 0
    const tolerance = planned.planned_kg * 0.05
    const inSpec =
      planned.planned_kg === 0
        ? actual_kg === 0
        : Math.abs(actual_kg - planned.planned_kg) <= tolerance
    return {
      material_code: planned.material_code,
      planned_kg: planned.planned_kg,
      actual_kg,
      flag: inSpec ? ('in_spec' as const) : ('out_of_spec' as const),
    }
  })

  for (const [material_code, actual_kg] of actualByMaterial) {
    if (!plannedMaterials.has(material_code) && actual_kg > 0) {
      rows.push({
        material_code,
        planned_kg: 0,
        actual_kg,
        flag: 'out_of_spec',
      })
    }
  }

  return rows
}

export type PlanVarianceFlag = {
  heat_id: string
  heat_no: string
  material_code: string
  planned_kg: number
  actual_kg: number
}

export function collectPlanVarianceFlags(
  heats: Heat[],
  batchPlans: BatchPlan[],
  chargeLines: ChargeLine[],
): PlanVarianceFlag[] {
  const planById = new Map(batchPlans.map((p) => [p.id, p]))
  const flags: PlanVarianceFlag[] = []

  for (const heat of heats) {
    if (!isActiveHeat(heat.status) || !heat.batch_plan_id) continue
    const plan = planById.get(heat.batch_plan_id)
    if (!plan) continue

    const aliases = getHeatIdAliases(heat.id)
    const lines = chargeLines.filter((l) => aliases.has(l.heat_id))
    for (const row of computePlanVariance(plan, lines)) {
      if (row.flag === 'out_of_spec') {
        flags.push({
          heat_id: heat.id,
          heat_no: heat.heat_no,
          material_code: row.material_code,
          planned_kg: row.planned_kg,
          actual_kg: row.actual_kg,
        })
      }
    }
  }

  return flags
}

export function loadLocalHeats(): Heat[] {
  const cached = getCachedHeats()
  return mergeFetchedHeats(
    cached.filter((h) => !h._pending),
    cached.filter((h) => h._pending),
  )
}

export function loadLocalCycleLog(heatId?: string): CycleLogEntry[] {
  // Same merge/dedup as fetchCycleLog — never show a finished stage as still running because
  // a stale pending local row shares the stage but lacks finish_ts.
  const cached = getCachedCycleLog()
  const scoped = heatId
    ? cached.filter((e) => getHeatIdAliases(heatId).has(e.heat_id))
    : cached
  return mergeFetchedCycleEntries(
    scoped.filter((e) => !e._pending),
    scoped.filter((e) => e._pending),
  )
}

export function loadLocalChargeLines(heatId?: string): ChargeLine[] {
  const cached = getCachedChargeLines()
  if (!heatId) return cached
  const aliases = getHeatIdAliases(heatId)
  return cached.filter((l) => aliases.has(l.heat_id))
}

export function loadLocalTempReadings(heatId?: string): TempReading[] {
  const cached = getCachedTempReadings()
  if (!heatId) return cached
  const aliases = getHeatIdAliases(heatId)
  return cached.filter((r) => aliases.has(r.heat_id))
}

async function assignRealHeatNo(localHeat: Heat): Promise<string | null> {
  const furnaceInfo = await fetchFurnaceWithLetter(localHeat.furnace_code)
  if (!furnaceInfo?.heat_code_letter) return null
  return generateNextHeatNo(localHeat.furnace_code, furnaceInfo.heat_code_letter, new Date(localHeat.created_at))
}

const ORPHAN_RECOVERY_FLAG = 'furnace:heat_id_orphan_recovery_v1'

function isKnownHeatId(heatId: string): boolean {
  return getCachedHeats().some((h) => h.id === heatId || h._localId === heatId)
}

function collectReferencedHeatIds(): Set<string> {
  const ids = new Set<string>()
  for (const action of getHeatQueue()) {
    if (
      action.kind === 'charge_insert' ||
      action.kind === 'cycle_insert' ||
      action.kind === 'temp_insert'
    ) {
      ids.add(String(action.payload.heat_id))
    }
    if (action.kind === 'heat_update') ids.add(action.heatId)
  }
  for (const line of getCachedChargeLines()) {
    if (line._pending) ids.add(line.heat_id)
  }
  for (const entry of getCachedCycleLog()) {
    if (entry._pending) ids.add(entry.heat_id)
  }
  for (const reading of getCachedTempReadings()) {
    if (reading._pending) ids.add(reading.heat_id)
  }
  return ids
}

function listOrphanedHeatIds(): string[] {
  return [...collectReferencedHeatIds()].filter(
    (id) => !isKnownHeatId(id) && resolveHeatId(id) === id,
  )
}

// One-time (per browser) recovery for charge/cycle/temp rows queued under a client-generated heat
// id after the heat itself had already synced under a different server id. Matches orphans to the
// real heat row via idempotency_key first, then via heat_no from a still-queued heat_insert.
// Idempotent — safe to run on every sync flush; the localStorage flag marks browsers that have
// been through the migration pass.
export async function recoverOrphanedHeatReferences(): Promise<number> {
  if (!navigator.onLine) return 0

  let repointed = 0
  let orphaned = listOrphanedHeatIds()
  if (orphaned.length === 0) {
    if (!localStorage.getItem(ORPHAN_RECOVERY_FLAG)) {
      localStorage.setItem(ORPHAN_RECOVERY_FLAG, '1')
    }
    return 0
  }

  const { data: byKey, error: keyErr } = await furnace()
    .from('heats')
    .select('id, heat_no, idempotency_key')
    .in('idempotency_key', orphaned)

  if (!keyErr) {
    for (const row of byKey ?? []) {
      const fromId = String(row.idempotency_key)
      const toId = String(row.id)
      if (fromId === toId) continue

      const heat = rowToHeat(row as Record<string, unknown>)
      const cached = getCachedHeats().find((h) => h.id === toId)
      if (cached) {
        if (!cached._localId) updateLocalHeat(toId, { _localId: fromId })
      } else {
        upsertLocalHeat({ ...heat, _localId: fromId })
      }
      repointHeatDependents(fromId, toId)
      repointed++
    }
  }

  orphaned = listOrphanedHeatIds()
  if (orphaned.length > 0) {
    const localIdToHeatNo = new Map<string, string>()
    for (const action of getHeatQueue()) {
      if (action.kind === 'heat_insert') {
        localIdToHeatNo.set(action.localId, action.payload.heat_no)
      }
    }

    const heatNos = [
      ...new Set(
        orphaned.map((id) => localIdToHeatNo.get(id)).filter((no): no is string => Boolean(no)),
      ),
    ]

    if (heatNos.length > 0) {
      const { data: byHeatNo, error: heatNoErr } = await furnace()
        .from('heats')
        .select('id, heat_no')
        .in('heat_no', heatNos)

      if (!heatNoErr) {
        const heatNoToId = new Map(
          (byHeatNo ?? []).map((row) => [String(row.heat_no), String(row.id)]),
        )

        for (const orphanId of orphaned) {
          const heatNo = localIdToHeatNo.get(orphanId)
          if (!heatNo) continue
          const toId = heatNoToId.get(heatNo)
          if (!toId || toId === orphanId) continue

          const cached = getCachedHeats().find((h) => h.id === toId)
          if (cached && !cached._localId) updateLocalHeat(toId, { _localId: orphanId })
          repointHeatDependents(orphanId, toId)
          repointed++
        }
      }
    }
  }

  localStorage.setItem(ORPHAN_RECOVERY_FLAG, '1')
  return repointed
}

// Only one flush of furnace:heat_queue may run at a time. Without this, two triggers firing
// close together — the page's 'online' listener, DevRoleSwitcher's pre-switch flush, and every
// add*/submit* function's own fire-and-forget sync call — would each read their own snapshot of
// the queue and process the same still-queued actions concurrently, submitting the same insert
// twice before either flush had a chance to remove it. Concurrent callers now share one in-flight
// run instead of racing.
let heatSyncInFlight: Promise<number> | null = null

export function syncHeatQueue(): Promise<number> {
  if (heatSyncInFlight) return heatSyncInFlight
  const run = runHeatQueueSync().finally(() => {
    heatSyncInFlight = null
  })
  heatSyncInFlight = run
  return run
}

async function runHeatQueueSync(): Promise<number> {
  if (!navigator.onLine) return getHeatQueue().length

  await recoverOrphanedHeatReferences()

  const queue = [...getHeatQueue()]
  const syncErrors: Array<{ at: string; action: (typeof queue)[number]['kind']; message: string; code?: string }> = []

  function recordSyncError(action: (typeof queue)[number], error: unknown) {
    const e = error as { code?: string; message?: string }
    syncErrors.push({
      at: new Date().toISOString(),
      action: action.kind,
      message: formatQueueSyncError(error),
      code: e.code,
    })
  }

  for (const action of queue) {
    if (action.kind === 'heat_insert') {
      let insertPayload = { ...action.payload }

      if (action.emergency || isPendingSyncHeatNo(insertPayload.heat_no)) {
        const realNo = await assignRealHeatNo({
          ...insertPayload,
          id: action.localId,
          shift_id: null,
          verified_by: null,
          verified_at: null,
          created_at: new Date().toISOString(),
          updated_by: null,
          updated_at: null,
        } as Heat)
        if (realNo) insertPayload = { ...insertPayload, heat_no: realNo }
      }

      const { row, error } = await insertIdempotent(furnace, 'heats', insertPayload as unknown as Record<string, unknown>)
      if (error || !row) {
        if (error) recordSyncError(action, error)
        continue
      }

      const synced = rowToHeat(row)
      updateLocalHeat(action.localId, {
        ...synced,
        _localId: action.localId,
        _pending: false,
        _emergency: false,
      })
      repointHeatDependents(action.localId, synced.id)
      removeHeatQueueAction(action.queueId)
    }

    if (action.kind === 'heat_update') {
      const heatId = action.heatId
      const resolvedId = getCachedHeats().find((h) => h.id === heatId || h._localId === heatId)?.id ?? heatId
      if (resolvedId.startsWith('PENDING') || resolvedId.includes('-')) {
        const cached = getCachedHeats().find((h) => h.id === heatId || h._localId === heatId)
        if (cached?._pending) continue
      }
      const { error } = await furnace().from('heats').update(action.payload).eq('id', resolvedId)
      if (error) {
        recordSyncError(action, error)
        continue
      }
      updateLocalHeat(heatId, { ...action.payload, _pending: false } as Partial<Heat>)
      removeHeatQueueAction(action.queueId)
    }

    if (action.kind === 'charge_insert') {
      const payload = {
        ...action.payload,
        heat_id: resolveHeatId(String(action.payload.heat_id)),
      }
      const { row, error } = await insertIdempotent(furnace, 'charge_lines', payload)
      if (error || !row) {
        if (error) recordSyncError(action, error)
        continue
      }
      const synced = rowToChargeLine(row)
      setCachedChargeLines(
        getCachedChargeLines().map((l) =>
          l._localId === action.localId ? { ...synced, _pending: false } : l,
        ),
      )
      removeHeatQueueAction(action.queueId)
    }

    if (action.kind === 'cycle_insert') {
      const payload = {
        ...action.payload,
        heat_id: resolveHeatId(String(action.payload.heat_id)),
      }
      const { row, error } = await insertIdempotent(furnace, 'cycle_log', payload)
      if (error || !row) {
        if (error) recordSyncError(action, error)
        continue
      }
      const synced = rowToCycleEntry(row)
      // _localId is kept (not cleared) even though this entry is now synced, so a `cycle_finish`
      // action created before this insert synced — which only knows the entry by its old
      // client-generated id — can still resolve the real row below, no matter how much later it
      // actually runs.
      setCachedCycleLog(
        getCachedCycleLog().map((e) =>
          e._localId === action.localId ? { ...synced, _localId: action.localId, _pending: false } : e,
        ),
      )
      removeHeatQueueAction(action.queueId)
    }

    if (action.kind === 'cycle_finish') {
      // action.entryId is whatever id the entry had at the moment Finish was tapped. If Start was
      // tapped moments earlier and hadn't synced yet, that's still the client-generated local id
      // — the database assigns its own id on insert, so updating by that stale id would silently
      // match zero rows (not a Postgres error) and this action would be wrongly treated as a
      // success, leaving the real row's finish_ts unset forever while the local cache/UI shows it
      // as finished. Resolve the current real id from cache first (by id, falling back to the
      // _localId breadcrumb above) before issuing the update.
      const cachedEntry = getCachedCycleLog().find(
        (e) => e.id === action.entryId || (action.localId && e._localId === action.localId),
      )
      const targetId = cachedEntry?.id ?? action.entryId
      const { error } = await furnace()
        .from('cycle_log')
        .update({ finish_ts: action.finish_ts })
        .eq('id', targetId)
      if (error) {
        recordSyncError(action, error)
        continue
      }
      updateLocalCycleEntry(action.entryId, { finish_ts: action.finish_ts, _pending: false })
      removeHeatQueueAction(action.queueId)
    }

    if (action.kind === 'temp_insert') {
      const payload = {
        ...action.payload,
        heat_id: resolveHeatId(String(action.payload.heat_id)),
      }
      const { row, error } = await insertIdempotent(furnace, 'temp_readings', payload)
      if (error || !row) {
        if (error) recordSyncError(action, error)
        continue
      }
      const synced = rowToTempReading(row)
      setCachedTempReadings(
        getCachedTempReadings().map((r) =>
          r._localId === action.localId ? { ...synced, _pending: false } : r,
        ),
      )
      removeHeatQueueAction(action.queueId)
    }

    if (action.kind === 'cancel_request') {
      const { row, error } = await insertIdempotent(furnace, 'heat_cancel_requests', action.payload)
      if (error || !row) {
        if (error) recordSyncError(action, error)
        continue
      }
      removeHeatQueueAction(action.queueId)
    }

    if (action.kind === 'cancel_decide') {
      const { error } = await furnace().from('heat_cancel_requests').update(action.payload).eq('id', action.requestId)
      if (error) {
        recordSyncError(action, error)
        continue
      }
      removeHeatQueueAction(action.queueId)
    }

    if (action.kind === 'correction_request') {
      const { row, error } = await insertIdempotent(furnace, 'heat_no_corrections', action.payload)
      if (error || !row) {
        if (error) recordSyncError(action, error)
        continue
      }
      removeHeatQueueAction(action.queueId)
    }

    if (action.kind === 'correction_decide') {
      const { error } = await furnace().from('heat_no_corrections').update(action.payload).eq('id', action.requestId)
      if (error) {
        recordSyncError(action, error)
        continue
      }
      removeHeatQueueAction(action.queueId)
    }
  }

  if (syncErrors.length > 0) setHeatSyncErrors(syncErrors)
  else clearHeatSyncErrors()

  setCachedHeats(getCachedHeats())
  return getHeatQueue().length
}

export { getHeatPendingCount } from './heatOfflineStore'

import { supabase } from './supabaseClient'
import { computeRecoveryBreakdown, computeYieldFlags } from './outputCalc'
import { enqueueHeatAction, updateLocalHeat } from './heatOfflineStore'
import {
  addLocalHeatOutput,
  addLocalYieldFlag,
  enqueueOutputAction,
  getCachedFgStock,
  getCachedHeatOutputs,
  getCachedYieldFlags,
  getOutputQueue,
  rowToFgStock,
  rowToHeatOutput,
  rowToYieldFlag,
  setCachedFgStock,
  setCachedHeatOutputs,
  setCachedYieldFlags,
  setOutputQueue,
  updateLocalHeatOutput,
  updateLocalYieldFlag,
} from './outputOfflineStore'
import type { AppUser } from '../types/auth'
import type { ChargeLine, Heat } from '../types/heat'
import type { FgStock, HeatOutput, HeatOutputFlag, MaterialYieldStandardRow } from '../types/output'

const furnace = () => supabase.schema('furnace')

export async function fetchYieldStandards(): Promise<MaterialYieldStandardRow[]> {
  const { data, error } = await furnace()
    .from('material_yield_standards')
    .select('material_code, metric, min_pct, max_pct, active')
    .eq('active', true)

  if (error) throw error
  return (data ?? []).map((row) => ({
    material_code: String(row.material_code),
    metric: row.metric as MaterialYieldStandardRow['metric'],
    min_pct: Number(row.min_pct),
    max_pct: Number(row.max_pct),
    active: Boolean(row.active),
  }))
}

export async function fetchHeatOutput(heatId: string): Promise<HeatOutput | null> {
  if (navigator.onLine) {
    const { data, error } = await furnace().from('heat_output').select('*').eq('heat_id', heatId).maybeSingle()
    if (!error && data) {
      const output = rowToHeatOutput(data as Record<string, unknown>)
      addLocalHeatOutput(output)
      return output
    }
  }
  return getCachedHeatOutputs().find((o) => o.heat_id === heatId) ?? null
}

// Global, unfiltered by heat — the Yield Exceptions panel is meant to make the open count
// impossible to miss, per 03f §4, so it always lists every open flag across every heat.
export async function fetchOpenYieldFlags(): Promise<HeatOutputFlag[]> {
  const { data, error } = await furnace()
    .from('heat_output_flags')
    .select('*')
    .is('acknowledged_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error

  const serverFlags = (data ?? []).map((row) => rowToYieldFlag(row as Record<string, unknown>))
  const localPending = getCachedYieldFlags().filter((f) => f._pending && !f.acknowledged_at)
  const merged = new Map<string, HeatOutputFlag>()
  for (const f of serverFlags) merged.set(f.id, f)
  for (const f of localPending) merged.set(f.id, f)

  const result = [...merged.values()]
  setCachedYieldFlags(result)
  return result
}

export async function saveHeatOutput(
  user: AppUser,
  heat: Heat,
  values: {
    ingot_kg: number
    dross_kg: number
    rejection_kg: number
    iron_kg: number
    exceptional_label: string | null
    exceptional_kg: number | null
  },
  chargedNetKg: number,
): Promise<HeatOutput> {
  const now = new Date().toISOString()
  const localId = crypto.randomUUID()
  const recovery = computeRecoveryBreakdown(
    chargedNetKg,
    values.ingot_kg,
    values.dross_kg,
    values.rejection_kg,
    values.iron_kg,
    values.exceptional_kg ?? 0,
  )

  const payload = {
    heat_id: heat.id,
    ingot_kg: values.ingot_kg,
    dross_kg: values.dross_kg,
    rejection_kg: values.rejection_kg,
    iron_kg: values.iron_kg,
    exceptional_label: values.exceptional_label,
    exceptional_kg: values.exceptional_kg,
    burn_loss_kg: recovery.burn_loss_kg,
    ingot_pct: recovery.ingot_pct,
    dross_pct: recovery.dross_pct,
    rejection_pct: recovery.rejection_pct,
    iron_pct: recovery.iron_pct,
    burn_loss_pct: recovery.burn_loss_pct,
    recorded_by: user.id,
  }

  const localOutput: HeatOutput = {
    id: localId,
    _localId: localId,
    _pending: true,
    ...payload,
    verified_by: null,
    verified_at: null,
    recorded_at: now,
  }

  addLocalHeatOutput(localOutput)
  enqueueOutputAction({ kind: 'output_insert', localId, payload })

  updateLocalHeat(heat.id, { status: 'Output Entered', updated_at: now, updated_by: user.id })
  enqueueHeatAction({
    kind: 'heat_update',
    heatId: heat.id,
    payload: { status: 'Output Entered', updated_at: now, updated_by: user.id },
  })

  if (navigator.onLine) void syncOutputQueue()
  return localOutput
}

// QA or Plant Head verification — either role, not both. Closes the heat, posts fg_stock,
// and writes any out-of-range yield flags, all in one action. Never blocks on flags — 03f §2/§4.
export async function verifyAndCloseHeatOutput(
  user: AppUser,
  heat: Heat,
  output: HeatOutput,
  chargeLines: ChargeLine[],
  yieldStandards: MaterialYieldStandardRow[],
): Promise<{ output: HeatOutput; flags: HeatOutputFlag[] }> {
  const now = new Date().toISOString()

  const recovery = {
    charged_net_kg: 0,
    burn_loss_kg: output.burn_loss_kg,
    ingot_pct: output.ingot_pct,
    dross_pct: output.dross_pct,
    rejection_pct: output.rejection_pct,
    iron_pct: output.iron_pct,
    burn_loss_pct: output.burn_loss_pct,
  }
  const candidates = computeYieldFlags(recovery, chargeLines, yieldStandards)

  const newFlags: HeatOutputFlag[] = []
  for (const c of candidates) {
    const localId = crypto.randomUUID()
    const payload = {
      heat_id: heat.id,
      metric: c.metric,
      actual_pct: c.actual_pct,
      expected_min_pct: c.expected_min_pct,
      expected_max_pct: c.expected_max_pct,
    }
    const flag: HeatOutputFlag = {
      id: localId,
      _localId: localId,
      _pending: true,
      ...payload,
      acknowledged_by: null,
      acknowledged_at: null,
      acknowledgement_note: null,
      created_at: now,
    }
    addLocalYieldFlag(flag)
    enqueueOutputAction({ kind: 'flag_insert', localId, payload })
    newFlags.push(flag)
  }

  const verifiedOutput: HeatOutput = { ...output, verified_by: user.id, verified_at: now, _pending: true }
  updateLocalHeatOutput(output.id, verifiedOutput)
  enqueueOutputAction({
    kind: 'output_verify',
    outputId: output.id,
    localId: output._localId,
    payload: { verified_by: user.id, verified_at: now },
  })

  updateLocalHeat(heat.id, { status: 'Closed', updated_at: now, updated_by: user.id })
  enqueueHeatAction({
    kind: 'heat_update',
    heatId: heat.id,
    payload: { status: 'Closed', updated_at: now, updated_by: user.id },
  })

  const fgLocalId = crypto.randomUUID()
  const fgPayload = { heat_id: heat.id, grade_code: heat.grade_code, kg_available: output.ingot_kg }
  setCachedFgStock([
    { id: fgLocalId, ...fgPayload, created_at: now, updated_at: now },
    ...getCachedFgStock().filter((s) => s.heat_id !== heat.id),
  ])
  enqueueOutputAction({ kind: 'fg_stock_insert', localId: fgLocalId, payload: fgPayload })

  if (navigator.onLine) void syncOutputQueue()
  return { output: verifiedOutput, flags: newFlags }
}

export async function acknowledgeYieldFlag(user: AppUser, flag: HeatOutputFlag, note: string | null): Promise<void> {
  const now = new Date().toISOString()
  updateLocalYieldFlag(flag.id, { acknowledged_by: user.id, acknowledged_at: now, acknowledgement_note: note })
  enqueueOutputAction({
    kind: 'flag_acknowledge',
    flagId: flag.id,
    payload: { acknowledged_by: user.id, acknowledged_at: now, acknowledgement_note: note },
  })
  if (navigator.onLine) void syncOutputQueue()
}

export async function syncOutputQueue(): Promise<number> {
  if (!navigator.onLine) return getOutputQueue().length

  const queue = [...getOutputQueue()]

  for (const action of queue) {
    if (action.kind === 'output_insert') {
      const { data, error } = await furnace().from('heat_output').insert(action.payload).select('*').single()
      if (error) continue
      const synced = rowToHeatOutput(data as Record<string, unknown>)
      updateLocalHeatOutput(action.localId, { ...synced, _localId: undefined, _pending: false })
      setOutputQueue(getOutputQueue().filter((a) => a !== action))
    }

    if (action.kind === 'output_verify') {
      const resolvedId = getCachedHeatOutputs().find((o) => o.id === action.outputId || o._localId === action.outputId)?.id ?? action.outputId
      const { error } = await furnace().from('heat_output').update(action.payload).eq('id', resolvedId)
      if (error) continue
      updateLocalHeatOutput(action.outputId, { ...action.payload, _pending: false } as Partial<HeatOutput>)
      setOutputQueue(getOutputQueue().filter((a) => a !== action))
    }

    if (action.kind === 'flag_insert') {
      const { data, error } = await furnace().from('heat_output_flags').insert(action.payload).select('*').single()
      if (error) continue
      const synced = rowToYieldFlag(data as Record<string, unknown>)
      updateLocalYieldFlag(action.localId, { ...synced, _localId: undefined, _pending: false })
      setOutputQueue(getOutputQueue().filter((a) => a !== action))
    }

    if (action.kind === 'flag_acknowledge') {
      const { error } = await furnace().from('heat_output_flags').update(action.payload).eq('id', action.flagId)
      if (error) continue
      updateLocalYieldFlag(action.flagId, { ...action.payload, _pending: false } as Partial<HeatOutputFlag>)
      setOutputQueue(getOutputQueue().filter((a) => a !== action))
    }

    if (action.kind === 'fg_stock_insert') {
      const { data, error } = await furnace().from('fg_stock').insert(action.payload).select('*').single()
      if (error) continue
      const synced = rowToFgStock(data as Record<string, unknown>)
      setCachedFgStock(
        getCachedFgStock().map((s) => (s.id === action.localId ? synced : s)),
      )
      setOutputQueue(getOutputQueue().filter((a) => a !== action))
    }
  }

  setCachedHeatOutputs(getCachedHeatOutputs())
  return getOutputQueue().length
}

export function loadLocalFgStock(): FgStock[] {
  return getCachedFgStock()
}

export { getOutputPendingCount } from './outputOfflineStore'

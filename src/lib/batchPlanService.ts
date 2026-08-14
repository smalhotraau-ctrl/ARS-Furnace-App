import { supabase } from './supabaseClient'
import { createInFlightLock, insertIdempotent } from './offlineQueueSync'
import {
  addLocalBatchPlan,
  enqueueBatchAction,
  getCachedBatchPlans,
  getPendingBatchActions,
  mergeCachedBatchPlans,
  removePendingBatchByLocalId,
  removePendingBatchByPlanId,
  rowToBatchPlan,
  setCachedBatchPlans,
  setPendingBatchActions,
  updateLocalBatchPlan,
} from './batchPlanOfflineStore'
import type { AppUser } from '../types/auth'
import type {
  BatchPlan,
  BatchPlanInsert,
  FurnaceOption,
  GradeSpecRow,
  MaterialStdRow,
} from '../types/batchPlan'
import { BATCH_PLAN_STATUS } from '../types/batchPlan'

const furnace = () => supabase.schema('furnace')

export async function fetchBatchPlans(): Promise<BatchPlan[]> {
  const { data, error } = await furnace()
    .from('batch_plans')
    .select('*')
    .order('plan_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  const serverPlans = (data ?? []).map((row) => rowToBatchPlan(row as Record<string, unknown>))
  const merged = mergeCachedBatchPlans(serverPlans)
  setCachedBatchPlans(merged)
  return merged
}

export async function fetchMainFurnaces(): Promise<FurnaceOption[]> {
  const { data, error } = await furnace()
    .from('furnaces')
    .select('code, name, type')
    .eq('active', true)
    .eq('type', 'main')
    .order('code')

  if (error) throw error
  return (data ?? []) as FurnaceOption[]
}

export async function fetchGradeCodes(): Promise<string[]> {
  const { data, error } = await furnace()
    .from('grade_specs')
    .select('grade_code')
    .eq('active', true)

  if (error) throw error

  return [...new Set((data ?? []).map((row) => String(row.grade_code)))].sort()
}

export async function fetchMaterialStdComposition(): Promise<MaterialStdRow[]> {
  const { data, error } = await furnace()
    .from('material_std_composition')
    .select('material_code, element, std_pct')

  if (error) throw error

  return (data ?? []).map((row) => ({
    material_code: String(row.material_code),
    element: String(row.element),
    std_pct: Number(row.std_pct),
  }))
}

export async function fetchGradeSpecs(): Promise<GradeSpecRow[]> {
  const { data, error } = await furnace()
    .from('grade_specs')
    .select('grade_code, element, min_pct, max_pct, active')

  if (error) throw error

  return (data ?? []).map((row) => ({
    grade_code: String(row.grade_code),
    element: String(row.element),
    min_pct: Number(row.min_pct),
    max_pct: Number(row.max_pct),
    active: Boolean(row.active),
  }))
}

export function loadLocalBatchPlans(): BatchPlan[] {
  return getCachedBatchPlans()
}

// Same furnace.materials master used by Charging's Material dropdown — a plan should never
// be able to reference a material that doesn't actually exist in the materials master.
export { fetchActiveMaterials } from './heatService'

export async function saveBatchPlan(
  user: AppUser,
  payload: Omit<BatchPlanInsert, 'created_by' | 'status' | 'idempotency_key'>,
): Promise<BatchPlan> {
  const localId = crypto.randomUUID()
  const insert: BatchPlanInsert = {
    ...payload,
    status: BATCH_PLAN_STATUS,
    created_by: user.id,
    idempotency_key: localId,
  }

  const now = new Date().toISOString()
  const localPlan: BatchPlan = {
    id: localId,
    _localId: localId,
    _pending: true,
    furnace_code: insert.furnace_code,
    grade_code: insert.grade_code,
    plan_date: insert.plan_date,
    planned_lines: insert.planned_lines,
    expected_composition: insert.expected_composition,
    status: insert.status,
    owner_reviewed: false,
    owner_reviewed_by: null,
    owner_reviewed_at: null,
    owner_review_note: null,
    created_by: user.id,
    created_at: now,
    updated_by: null,
    updated_at: null,
  }

  addLocalBatchPlan(localPlan)
  enqueueBatchAction({ kind: 'insert', localId, payload: insert, createdAt: now })
  void syncBatchPendingActions()

  return localPlan
}

export async function updateBatchPlan(
  user: AppUser,
  plan: BatchPlan,
  payload: Omit<BatchPlanInsert, 'created_by' | 'status' | 'idempotency_key'>,
): Promise<BatchPlan> {
  const now = new Date().toISOString()
  const updated: BatchPlan = {
    ...plan,
    ...payload,
    status: BATCH_PLAN_STATUS,
    updated_by: user.id,
    updated_at: now,
    _pending: true,
  }

  updateLocalBatchPlan(plan.id, updated)

  if (plan._localId) {
    const pending = getPendingBatchActions()
    const insertAction = pending.find(
      (action) => action.kind === 'insert' && action.localId === plan._localId,
    )
    if (insertAction && insertAction.kind === 'insert') {
      insertAction.payload = {
        ...insertAction.payload,
        furnace_code: payload.furnace_code,
        grade_code: payload.grade_code,
        plan_date: payload.plan_date,
        planned_lines: payload.planned_lines,
        expected_composition: payload.expected_composition,
      }
    }
    setPendingBatchActions(pending)
  } else {
    enqueueBatchAction({
      kind: 'update',
      planId: plan.id,
      payload: {
        ...payload,
        status: BATCH_PLAN_STATUS,
        updated_by: user.id,
        updated_at: now,
      },
    })
  }

  void syncBatchPendingActions()
  return updated
}

export async function acknowledgeBatchPlan(
  user: AppUser,
  plan: BatchPlan,
  note: string | null,
): Promise<BatchPlan> {
  const now = new Date().toISOString()
  const updated: BatchPlan = {
    ...plan,
    owner_reviewed: true,
    owner_reviewed_by: user.id,
    owner_reviewed_at: now,
    owner_review_note: note,
    _pending: true,
  }

  updateLocalBatchPlan(plan.id, updated)

  if (plan._localId) {
    removePendingBatchByPlanId(plan._localId, 'owner_review')
  } else {
    enqueueBatchAction({
      kind: 'owner_review',
      planId: plan.id,
      owner_reviewed_by: user.id,
      owner_reviewed_at: now,
      owner_review_note: note,
    })
  }

  void syncBatchPendingActions()
  return updated
}

// Only one flush of furnace:batch_plans_queue may run at a time — see offlineQueueSync.ts.
const withBatchSyncLock = createInFlightLock<number>()

export function syncBatchPendingActions(): Promise<number> {
  return withBatchSyncLock(runBatchPendingActionsSync)
}

async function runBatchPendingActionsSync(): Promise<number> {
  if (!navigator.onLine) return getPendingBatchActions().length

  const pending = [...getPendingBatchActions()]

  for (const action of pending) {
    if (action.kind === 'insert') {
      const { row, error } = await insertIdempotent(
        furnace,
        'batch_plans',
        action.payload as unknown as Record<string, unknown>,
      )
      if (error || !row) continue

      const synced = rowToBatchPlan(row)
      removePendingBatchByLocalId(action.localId)
      updateLocalBatchPlan(action.localId, { ...synced, _localId: undefined, _pending: false })
    }

    if (action.kind === 'update') {
      const { error } = await furnace()
        .from('batch_plans')
        .update(action.payload)
        .eq('id', action.planId)

      if (error) continue

      removePendingBatchByPlanId(action.planId, 'update')
      updateLocalBatchPlan(action.planId, { ...action.payload, _pending: false })
    }

    if (action.kind === 'owner_review') {
      const { error } = await furnace()
        .from('batch_plans')
        .update({
          owner_reviewed: true,
          owner_reviewed_by: action.owner_reviewed_by,
          owner_reviewed_at: action.owner_reviewed_at,
          owner_review_note: action.owner_review_note,
        })
        .eq('id', action.planId)

      if (error) continue

      removePendingBatchByPlanId(action.planId, 'owner_review')
      updateLocalBatchPlan(action.planId, {
        owner_reviewed: true,
        owner_reviewed_by: action.owner_reviewed_by,
        owner_reviewed_at: action.owner_reviewed_at,
        owner_review_note: action.owner_review_note,
        _pending: false,
      })
    }
  }

  setCachedBatchPlans(getCachedBatchPlans())
  return getPendingBatchActions().length
}

export { getBatchPendingCount } from './batchPlanOfflineStore'

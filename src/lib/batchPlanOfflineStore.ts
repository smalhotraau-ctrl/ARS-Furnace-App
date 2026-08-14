import type { BatchPlan, BatchPlanInsert } from '../types/batchPlan'
import { parseExpectedComposition, parsePlannedLines } from '../types/batchPlan'

const CACHE_KEY = 'furnace:batch_plans'
const QUEUE_KEY = 'furnace:batch_plans_queue'

export interface PendingBatchInsert {
  kind: 'insert'
  localId: string
  payload: BatchPlanInsert
  createdAt: string
}

export interface PendingBatchUpdate {
  kind: 'update'
  planId: string
  localId?: string
  payload: Partial<BatchPlanInsert> & { updated_by: string; updated_at: string }
}

export interface PendingOwnerReview {
  kind: 'owner_review'
  planId: string
  localId?: string
  owner_reviewed_by: string
  owner_reviewed_at: string
  owner_review_note: string | null
}

export type PendingBatchAction = PendingBatchInsert | PendingBatchUpdate | PendingOwnerReview

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

export function getCachedBatchPlans(): BatchPlan[] {
  return readJson<BatchPlan[]>(CACHE_KEY, [])
}

export function setCachedBatchPlans(plans: BatchPlan[]) {
  writeJson(CACHE_KEY, plans)
}

// Unlike heat/output/dispatch queues, this one already removed entries correctly
// (removePendingBatchByLocalId/removePendingBatchByPlanId below filter by the stable
// localId/planId value, not object reference), so those already serve as this queue's queueId.
// It was still missing the idempotency_key needed for server-side ON CONFLICT DO NOTHING
// protection on the insert kind — backfilled here for whatever's already sitting in a user's
// browser. update/owner_review are plain UPDATEs against an existing row and are naturally
// idempotent, so they don't need one.
function migrateLegacyQueueEntry(action: PendingBatchAction): PendingBatchAction {
  if (action.kind !== 'insert') return action
  const payload = action.payload as BatchPlanInsert & { idempotency_key?: string }
  if (payload.idempotency_key) return action
  return { ...action, payload: { ...payload, idempotency_key: crypto.randomUUID() } }
}

export function getPendingBatchActions(): PendingBatchAction[] {
  const raw = readJson<PendingBatchAction[]>(QUEUE_KEY, [])
  let changed = false
  const migrated = raw.map((action) => {
    const fixed = migrateLegacyQueueEntry(action)
    if (fixed !== action) changed = true
    return fixed
  })
  if (changed) writeJson(QUEUE_KEY, migrated)
  return migrated
}

export function setPendingBatchActions(actions: PendingBatchAction[]) {
  writeJson(QUEUE_KEY, actions)
}

export function enqueueBatchAction(action: PendingBatchAction) {
  setPendingBatchActions([...getPendingBatchActions(), action])
}

export function removePendingBatchByLocalId(localId: string) {
  setPendingBatchActions(
    getPendingBatchActions().filter((action) => {
      if (action.kind === 'insert') return action.localId !== localId
      return action.localId !== localId
    }),
  )
}

export function removePendingBatchByPlanId(planId: string, kind?: PendingBatchAction['kind']) {
  setPendingBatchActions(
    getPendingBatchActions().filter((action) => {
      if (kind && action.kind !== kind) return true
      if (action.kind === 'insert') return action.localId !== planId
      return action.planId !== planId
    }),
  )
}

export function addLocalBatchPlan(plan: BatchPlan) {
  const cached = getCachedBatchPlans()
  setCachedBatchPlans([
    plan,
    ...cached.filter((p) => p.id !== plan.id && p._localId !== plan._localId),
  ])
}

export function updateLocalBatchPlan(id: string, patch: Partial<BatchPlan>) {
  const cached = getCachedBatchPlans()
  setCachedBatchPlans(
    cached.map((plan) =>
      plan.id === id || plan._localId === id ? { ...plan, ...patch } : plan,
    ),
  )
}

export function mergeCachedBatchPlans(serverPlans: BatchPlan[]): BatchPlan[] {
  const cached = getCachedBatchPlans()
  const pending = getPendingBatchActions()
  const pendingLocalIds = new Set(
    pending.filter((action) => action.kind === 'insert').map((action) => action.localId),
  )

  const merged = new Map<string, BatchPlan>()
  for (const plan of serverPlans) merged.set(plan.id, plan)
  for (const plan of cached) {
    if (plan._localId && pendingLocalIds.has(plan._localId)) {
      merged.set(plan._localId, plan)
    }
  }

  return [...merged.values()].sort(
    (a, b) => b.plan_date.localeCompare(a.plan_date) || b.created_at.localeCompare(a.created_at),
  )
}

export function rowToBatchPlan(row: Record<string, unknown>): BatchPlan {
  return {
    id: String(row.id),
    furnace_code: String(row.furnace_code),
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
  }
}

export function getBatchPendingCount(): number {
  return getPendingBatchActions().length
}

import { supabase } from './supabaseClient'
import type { AppUser } from '../types/auth'
import type {
  Furnace,
  FurnaceCreatePayload,
  FurnaceUpdatePayload,
  GradeSpecCreatePayload,
  GradeSpecRow,
  Material,
  MaterialCreatePayload,
  MaterialStdCompositionCreatePayload,
  MaterialStdCompositionRow,
  MaterialStdCompositionUpdatePayload,
  MaterialUpdatePayload,
  MaterialYieldStandardCreatePayload,
  MaterialYieldStandardRow,
  MaterialYieldStandardUpdatePayload,
  MasterAdminAction,
  MasterAdminChangeRequest,
  MasterAdminPayload,
  MasterAdminTargetTable,
} from '../types/masterAdmin'
import type {
  CycleStageTimeStandardCreatePayload,
  CycleStageTimeStandardRow,
  CycleStageTimeStandardUpdatePayload,
} from '../types/cycleTime'
import { rowToCycleStageTimeStandard } from './cycleTimeOfflineStore'
import type {
  ApprovalActionType,
  ApprovalSetting,
  HeatCostingOverridePayload,
  ProcessCostStandardCreatePayload,
  ProcessCostStandardRow,
  RateMasterCreatePayload,
  RateMasterUpdatePayload,
} from '../types/costing'
import { refreshHeatCostingDerived } from './costingService'

const furnace = () => supabase.schema('furnace')

function rowToChangeRequest(row: Record<string, unknown>): MasterAdminChangeRequest {
  return {
    id: String(row.id),
    target_table: row.target_table as MasterAdminTargetTable,
    target_id: row.target_id != null ? String(row.target_id) : null,
    action: row.action as MasterAdminAction,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    requested_by: String(row.requested_by),
    requested_at: String(row.requested_at),
    status: row.status as MasterAdminChangeRequest['status'],
    decided_by: row.decided_by != null ? String(row.decided_by) : null,
    decided_at: row.decided_at != null ? String(row.decided_at) : null,
    decision_note: row.decision_note != null ? String(row.decision_note) : null,
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function fetchAllFurnaces(): Promise<Furnace[]> {
  const { data, error } = await furnace().from('furnaces').select('*').order('code')
  if (error) throw error
  return (data ?? []) as Furnace[]
}

export async function fetchAllGradeSpecs(): Promise<GradeSpecRow[]> {
  const { data, error } = await furnace()
    .from('grade_specs')
    .select('*')
    .order('grade_code')
    .order('element')
  if (error) throw error
  return (data ?? []) as GradeSpecRow[]
}

export async function fetchAllMaterials(): Promise<Material[]> {
  const { data, error } = await furnace().from('materials').select('*').order('code')
  if (error) throw error
  return (data ?? []) as Material[]
}

export async function fetchAllMaterialStdComposition(): Promise<MaterialStdCompositionRow[]> {
  const { data, error } = await furnace()
    .from('material_std_composition')
    .select('*')
    .order('material_code')
    .order('element')
  if (error) throw error
  return (data ?? []) as MaterialStdCompositionRow[]
}

export async function fetchAllMaterialYieldStandards(): Promise<MaterialYieldStandardRow[]> {
  const { data, error } = await furnace()
    .from('material_yield_standards')
    .select('*')
    .order('material_code')
    .order('metric')
  if (error) throw error
  return (data ?? []) as MaterialYieldStandardRow[]
}

export async function fetchAllProcessCostStandards(): Promise<ProcessCostStandardRow[]> {
  const { data, error } = await furnace()
    .from('process_cost_standards')
    .select('*')
    .order('effective_from', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    fuel_cost_per_kg: Number(row.fuel_cost_per_kg),
    manpower_cost_per_kg: Number(row.manpower_cost_per_kg),
    consumables_cost_per_kg: Number(row.consumables_cost_per_kg),
    electrical_transport_cost_per_kg: Number(row.electrical_transport_cost_per_kg),
    effective_from: String(row.effective_from),
    updated_by: String(row.updated_by),
    updated_at: String(row.updated_at),
  }))
}

export async function fetchAllCycleStageTimeStandards(): Promise<CycleStageTimeStandardRow[]> {
  const { data, error } = await furnace()
    .from('cycle_stage_time_standards')
    .select('*')
    .order('stage')
  if (error) throw error
  return (data ?? []).map((row) => rowToCycleStageTimeStandard(row as Record<string, unknown>))
}

export async function fetchChangeRequests(): Promise<MasterAdminChangeRequest[]> {
  const { data, error } = await furnace()
    .from('master_admin_change_requests')
    .select('*')
    .order('requested_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => rowToChangeRequest(row as Record<string, unknown>))
}

// Defaults to gated (true) if no row exists yet, matching the column default and
// furnace.master_admin_auto_approved() on the database side.
export async function fetchRequiresOwnerApproval(): Promise<boolean> {
  return fetchRequiresOwnerApprovalFor('master_admin_change')
}

// Generic version — used by the Costing screens too (rate_override gate), same default-gated
// fallback as above and as furnace.rate_override_auto_approved()/master_admin_auto_approved().
export async function fetchRequiresOwnerApprovalFor(actionType: ApprovalActionType): Promise<boolean> {
  const { data, error } = await furnace()
    .from('approval_settings')
    .select('requires_owner_approval')
    .eq('action_type', actionType)
    .maybeSingle()
  if (error) throw error
  return data ? Boolean(data.requires_owner_approval) : true
}

// 03i §6: Owner-only screen, exactly these two configurable action_types — heat-cancel and
// heat-number-correction are permanently fixed maker-checker and deliberately never surfaced
// here (see also the CHECK constraint on approval_settings.action_type in schema.sql).
export async function fetchAllApprovalSettings(): Promise<ApprovalSetting[]> {
  const { data, error } = await furnace().from('approval_settings').select('*').order('action_type')
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: String(row.id),
    action_type: row.action_type as ApprovalActionType,
    requires_owner_approval: Boolean(row.requires_owner_approval),
    updated_by: String(row.updated_by),
    updated_at: String(row.updated_at),
  }))
}

export async function updateApprovalSetting(
  user: AppUser,
  actionType: ApprovalActionType,
  requiresOwnerApproval: boolean,
): Promise<void> {
  const { error } = await furnace()
    .from('approval_settings')
    .update({ requires_owner_approval: requiresOwnerApproval, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq('action_type', actionType)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Apply a decided (approved) change to its target table. Shared by the auto-approve path
// (Plant Head's own client, right after proposing, when the gate is off), the Owner's Approve
// action in the change-request queue, and Owner's own direct edits (which never go through a
// change_requests row at all — see applyDirectChange below) — the same write, just performed by
// whichever side's RLS grant currently permits it. Only the fields actually needed to perform
// the write are required, so both a full MasterAdminChangeRequest and a plain in-memory
// candidate (before any request row exists) satisfy this structurally.
// ---------------------------------------------------------------------------

interface ChangeApplication {
  target_table: MasterAdminTargetTable
  target_id: string | null
  action: MasterAdminAction
  payload: Record<string, unknown>
  requested_by: string
}

async function applyChangeToTarget(request: ChangeApplication): Promise<void> {
  const authoredBy = request.requested_by

  switch (request.target_table) {
    case 'furnaces': {
      if (request.action === 'create') {
        const payload = request.payload as unknown as FurnaceCreatePayload
        const { error } = await furnace()
          .from('furnaces')
          .insert({ ...payload, active: true })
        if (error) throw error
      } else {
        const patch = request.payload as unknown as FurnaceUpdatePayload
        const { error } = await furnace().from('furnaces').update(patch).eq('id', request.target_id)
        if (error) throw error
      }
      return
    }

    case 'grade_specs': {
      const payload = request.payload as unknown as GradeSpecCreatePayload

      // Deactivate the old grade_code's rows BEFORE inserting the new active rows — never the
      // other way round. furnace.grade_specs_active_grade_code_element_key (see
      // 23_grade_specs_active_unique_index.sql) only enforces uniqueness among active rows, so
      // inserting the new active rows first, while the old ones are still active, would collide
      // with it (23505) whenever a re-spec reuses the same customer-facing grade_code. This
      // ordering also means there is never a moment with two active rows for the same
      // grade_code+element. superseded_by is filled in afterwards (once the new rows' ids
      // exist), and only on the specific rows just deactivated here (captured via .select), not
      // on every historically-inactive row under this grade_code — otherwise a second re-spec of
      // an already-re-speced grade_code would overwrite an older row's superseded_by, pointing
      // it past the version it actually skipped straight to the newest one.
      let justDeactivatedIds: string[] = []
      if (payload.supersedes_grade_code) {
        const { data: deactivated, error: deactivateError } = await furnace()
          .from('grade_specs')
          .update({ active: false })
          .eq('grade_code', payload.supersedes_grade_code)
          .eq('active', true)
          .select('id')
        if (deactivateError) throw deactivateError
        justDeactivatedIds = (deactivated ?? []).map((r) => String(r.id))
      }

      const rows = payload.elements.map((e) => ({
        grade_code: payload.grade_code,
        element: e.element,
        min_pct: e.min_pct,
        max_pct: e.max_pct,
        active: true,
        created_by: authoredBy,
      }))
      const { data, error } = await furnace().from('grade_specs').insert(rows).select('id')
      if (error) throw error

      if (justDeactivatedIds.length > 0) {
        const newSpecId = data?.[0]?.id
        const { error: supersedeError } = await furnace()
          .from('grade_specs')
          .update({ superseded_by: newSpecId })
          .in('id', justDeactivatedIds)
        if (supersedeError) throw supersedeError
      }
      return
    }

    case 'materials': {
      if (request.action === 'create') {
        const payload = request.payload as unknown as MaterialCreatePayload
        const { error } = await furnace()
          .from('materials')
          .insert({ ...payload, active: true, created_by: authoredBy })
        if (error) throw error
      } else {
        const payload = request.payload as unknown as MaterialUpdatePayload
        const { error } = await furnace()
          .from('materials')
          .update({ ...payload, updated_by: authoredBy, updated_at: new Date().toISOString() })
          .eq('id', request.target_id)
        if (error) throw error
      }
      return
    }

    case 'material_std_composition': {
      if (request.action === 'create') {
        const payload = request.payload as unknown as MaterialStdCompositionCreatePayload
        const rows = payload.elements.map((e) => ({
          material_code: payload.material_code,
          element: e.element,
          std_pct: e.std_pct,
        }))
        const { error } = await furnace().from('material_std_composition').insert(rows)
        if (error) throw error
      } else {
        const payload = request.payload as unknown as MaterialStdCompositionUpdatePayload
        const { error } = await furnace()
          .from('material_std_composition')
          .update(payload)
          .eq('id', request.target_id)
        if (error) throw error
      }
      return
    }

    case 'material_yield_standards': {
      if (request.action === 'create') {
        const payload = request.payload as unknown as MaterialYieldStandardCreatePayload
        const { error } = await furnace()
          .from('material_yield_standards')
          .insert({ ...payload, active: true, created_by: authoredBy })
        if (error) throw error
      } else {
        const payload = request.payload as unknown as MaterialYieldStandardUpdatePayload
        const { error } = await furnace()
          .from('material_yield_standards')
          .update({ ...payload, updated_by: authoredBy, updated_at: new Date().toISOString() })
          .eq('id', request.target_id)
        if (error) throw error
      }
      return
    }

    case 'rate_master': {
      if (request.action === 'create') {
        const payload = request.payload as unknown as RateMasterCreatePayload
        const { error } = await furnace()
          .from('rate_master')
          .insert({
            item: payload.item,
            item_type: 'lot_material',
            rate_per_kg: payload.rate_per_kg,
            quantity_kg: null,
            remaining_qty_kg: null,
            effective_from: payload.effective_from,
            updated_by: authoredBy,
          })
        if (error) throw error
      } else {
        const payload = request.payload as unknown as RateMasterUpdatePayload
        const { error } = await furnace()
          .from('rate_master')
          .update({ ...payload, updated_by: authoredBy, updated_at: new Date().toISOString() })
          .eq('id', request.target_id)
        if (error) throw error
      }
      return
    }

    case 'process_cost_standards': {
      if (request.action === 'create') {
        const payload = request.payload as unknown as ProcessCostStandardCreatePayload
        const { error } = await furnace()
          .from('process_cost_standards')
          .insert({
            ...payload,
            updated_by: authoredBy,
          })
        if (error) throw error
      }
      return
    }

    case 'cycle_stage_time_standards': {
      if (request.action === 'create') {
        const payload = request.payload as unknown as CycleStageTimeStandardCreatePayload
        const { error } = await furnace()
          .from('cycle_stage_time_standards')
          .insert({
            ...payload,
            updated_by: authoredBy,
          })
        if (error) throw error
      } else {
        const payload = request.payload as unknown as CycleStageTimeStandardUpdatePayload
        const { error } = await furnace()
          .from('cycle_stage_time_standards')
          .update({
            ...payload,
            updated_by: authoredBy,
            updated_at: new Date().toISOString(),
          })
          .eq('id', request.target_id)
        if (error) throw error
      }
      return
    }

    // heat_costing rows are only ever created by computeAndSaveHeatCosting. The everyday
    // actual-cost write is material_cost_final (gated by rate_override). quantity/FIFO
    // bookkeeping is no longer part of this path.
    case 'heat_costing': {
      const payload = request.payload as unknown as HeatCostingOverridePayload
      const { error } = await furnace()
        .from('heat_costing')
        .update({
          material_cost_final: payload.material_cost_final,
          material_cost_override_reason: payload.material_cost_override_reason,
          overridden_by: authoredBy,
          overridden_at: new Date().toISOString(),
        })
        .eq('id', request.target_id)
      if (error) throw error
      if (request.target_id) await refreshHeatCostingDerived(request.target_id)
      return
    }
  }
}

// ---------------------------------------------------------------------------
// Writes — Owner edits directly (never a "maker" here, only checker)
// ---------------------------------------------------------------------------

// Owner has unconditional INSERT/UPDATE on every Master Admin target table already (03b: "Full
// edit; checker"). Their own edits skip master_admin_change_requests entirely — that table's
// INSERT policy is Plant-Head-only (master_admin_change_requests_insert_plant_head), since Owner
// is only ever meant to decide Plant Head's proposals, never file their own. Approving/rejecting
// an actual Plant Head proposal still goes through decideChangeRequest below.
export async function applyDirectChange(
  user: AppUser,
  targetTable: MasterAdminTargetTable,
  action: MasterAdminAction,
  payload: MasterAdminPayload,
  targetId: string | null,
): Promise<void> {
  await applyChangeToTarget({
    target_table: targetTable,
    target_id: targetId,
    action,
    payload: payload as unknown as Record<string, unknown>,
    requested_by: user.id,
  })
}

// ---------------------------------------------------------------------------
// Writes — Plant Head proposes (maker)
// ---------------------------------------------------------------------------

// Always writes the master_admin_change_requests row first. If the gate is currently off for
// 'master_admin_change', the same client immediately applies the change to the target table and
// self-marks the request row 'approved' — this is what "applies immediately... request row is
// still written for audit" (03b section 3) actually means without a server-side job. If the gate
// is on, the row is left 'pending' for Owner to decide; RLS itself blocks a direct write to the
// target table in that case, independent of anything this function does.
export async function proposeChange(
  user: AppUser,
  targetTable: MasterAdminTargetTable,
  action: MasterAdminAction,
  payload: MasterAdminPayload,
  targetId: string | null,
  autoApproved: boolean,
): Promise<MasterAdminChangeRequest> {
  const { data, error } = await furnace()
    .from('master_admin_change_requests')
    .insert({
      target_table: targetTable,
      target_id: targetId,
      action,
      payload,
      requested_by: user.id,
      status: 'pending',
    })
    .select('*')
    .single()
  if (error) throw error

  let request = rowToChangeRequest(data as Record<string, unknown>)

  if (autoApproved) {
    await applyChangeToTarget(request)
    const decidedAt = new Date().toISOString()
    const { data: decided, error: decideError } = await furnace()
      .from('master_admin_change_requests')
      .update({ status: 'approved', decided_by: user.id, decided_at: decidedAt })
      .eq('id', request.id)
      .select('*')
      .single()
    if (decideError) throw decideError
    request = rowToChangeRequest(decided as Record<string, unknown>)
  }

  return request
}

// ---------------------------------------------------------------------------
// Writes — Owner decides (checker)
// ---------------------------------------------------------------------------

export async function decideChangeRequest(
  user: AppUser,
  request: MasterAdminChangeRequest,
  approve: boolean,
  decisionNote: string | null,
): Promise<MasterAdminChangeRequest> {
  if (approve) {
    await applyChangeToTarget(request)
  }

  const { data, error } = await furnace()
    .from('master_admin_change_requests')
    .update({
      status: approve ? 'approved' : 'rejected',
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decision_note: decisionNote,
    })
    .eq('id', request.id)
    .select('*')
    .single()
  if (error) throw error
  return rowToChangeRequest(data as Record<string, unknown>)
}

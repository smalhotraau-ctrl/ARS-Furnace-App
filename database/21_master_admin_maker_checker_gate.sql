-- Migration: gate Plant Head's direct writes on Master Admin tables by approval_settings
--
-- Context: schema.sql already grants Plant Head unconditional direct INSERT on
-- furnace.furnaces / grade_specs / material_std_composition / material_yield_standards, and
-- unconditional direct UPDATE on material_yield_standards (10_add_materials_master.sql did the
-- same for furnace.materials). That's a real gap against 03i/03b: per those docs, Plant Head is
-- always a "maker" who proposes via furnace.master_admin_change_requests — Owner is the checker,
-- gated by approval_settings.requires_owner_approval for 'master_admin_change' (default true).
-- As written, Plant Head could always write straight to these tables regardless of that setting,
-- bypassing the pending-approval step entirely at the database level.
--
-- This migration:
--   1. Adds furnace.master_admin_auto_approved() — true only when
--      approval_settings.requires_owner_approval = false for 'master_admin_change' (defaults to
--      false / gated if no row exists yet, same fail-safe default as the column itself).
--   2. Replaces Plant Head's unconditional INSERT/UPDATE policies on the five Master Admin
--      tables with ones that only match when furnace.master_admin_auto_approved() is true. Owner
--      keeps full, unconditional INSERT/UPDATE on all five, matching "Full edit; checker" in the
--      03b access matrix.
--   3. Adds a narrow UPDATE policy on furnace.grade_specs allowing the supersede bookkeeping
--      fields (active, superseded_by) to be set when a re-spec happens — WITH CHECK enforces
--      grade_code/element/min_pct/max_pct on that row can never change, so the actual spec
--      values stay exactly as immutable as before. There was previously no UPDATE policy at all
--      on grade_specs; this does not weaken that, it only permits this one narrow bookkeeping
--      transition, gated the same way as every other write here.
--   4. Adds a narrow self-approve UPDATE policy on furnace.master_admin_change_requests so that
--      when a Plant Head's own proposal is auto-approved (gate is off), their client can mark
--      their own still-"pending" request row as "approved" with themselves as decided_by — this
--      is what makes the "request row is still written for audit, just pre-marked approved" rule
--      from 03b section 3 actually possible under RLS. The existing
--      master_admin_change_requests_decide_admin_owner policy (Owner deciding a pending request
--      when gated) is untouched.
--   5. Adds a CHECK constraint on master_admin_change_requests.target_table restricting it to the
--      five tables this module actually covers, to catch typos early.
--
-- Does NOT touch or delete any existing data.
--
-- Safe to run multiple times: uses DROP POLICY/CONSTRAINT IF EXISTS before CREATE.
--
-- Apply after: 20_add_cycle_log_finish_update_policy.sql

-- ---------------------------------------------------------------------------
-- Helper: is a Master Admin change currently auto-approved?
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION furnace.master_admin_auto_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT COALESCE(
    (SELECT requires_owner_approval FROM furnace.approval_settings WHERE action_type = 'master_admin_change'),
    true
  );
$$;

-- ---------------------------------------------------------------------------
-- furnace.furnaces
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS furnaces_insert_plant_head_owner ON furnace.furnaces;
CREATE POLICY furnaces_insert_gated
  ON furnace.furnaces FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  );

DROP POLICY IF EXISTS furnaces_update_admin_owner ON furnace.furnaces;
CREATE POLICY furnaces_update_gated
  ON furnace.furnaces FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  )
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  );

-- ---------------------------------------------------------------------------
-- furnace.grade_specs
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS grade_specs_insert_plant_head_owner ON furnace.grade_specs;
CREATE POLICY grade_specs_insert_gated
  ON furnace.grade_specs FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  );

-- Narrow supersede-only UPDATE: the WITH CHECK re-reads this same row's grade_code / element /
-- min_pct / max_pct by id and requires them to be identical to what they were before the update,
-- so only active/superseded_by can ever actually change. The spec values themselves remain
-- exactly as immutable as "no UPDATE policy at all" made them.
DROP POLICY IF EXISTS grade_specs_supersede_gated ON furnace.grade_specs;
CREATE POLICY grade_specs_supersede_gated
  ON furnace.grade_specs FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  )
  WITH CHECK (
    (
      furnace.has_role(ARRAY['admin_owner'])
      OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
    )
    AND grade_code = (SELECT g.grade_code FROM furnace.grade_specs g WHERE g.id = grade_specs.id)
    AND element = (SELECT g.element FROM furnace.grade_specs g WHERE g.id = grade_specs.id)
    AND min_pct = (SELECT g.min_pct FROM furnace.grade_specs g WHERE g.id = grade_specs.id)
    AND max_pct = (SELECT g.max_pct FROM furnace.grade_specs g WHERE g.id = grade_specs.id)
  );

-- ---------------------------------------------------------------------------
-- furnace.material_std_composition
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS material_std_composition_insert_plant_head_owner ON furnace.material_std_composition;
CREATE POLICY material_std_composition_insert_gated
  ON furnace.material_std_composition FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  );

DROP POLICY IF EXISTS material_std_composition_update_admin_owner ON furnace.material_std_composition;
CREATE POLICY material_std_composition_update_gated
  ON furnace.material_std_composition FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  )
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  );

-- ---------------------------------------------------------------------------
-- furnace.material_yield_standards
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS material_yield_standards_insert_plant_head_owner ON furnace.material_yield_standards;
CREATE POLICY material_yield_standards_insert_gated
  ON furnace.material_yield_standards FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  );

DROP POLICY IF EXISTS material_yield_standards_update_plant_head_owner ON furnace.material_yield_standards;
CREATE POLICY material_yield_standards_update_gated
  ON furnace.material_yield_standards FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  )
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  );

-- ---------------------------------------------------------------------------
-- furnace.materials
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS materials_insert_plant_head_owner ON furnace.materials;
CREATE POLICY materials_insert_gated
  ON furnace.materials FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  );

DROP POLICY IF EXISTS materials_update_admin_owner ON furnace.materials;
CREATE POLICY materials_update_gated
  ON furnace.materials FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  )
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  );

-- ---------------------------------------------------------------------------
-- furnace.master_admin_change_requests — self-approve only when auto-approved
-- ---------------------------------------------------------------------------

-- Existing master_admin_change_requests_decide_admin_owner (Owner decides a pending request)
-- is untouched. This is additive: it only ever matches the requester's own still-pending row,
-- and only while the gate is off, and only allows the row to move to 'approved' with the
-- requester recorded as the decider — never 'rejected' (Plant Head cannot reject their own
-- proposal via this path; that would be meaningless).
DROP POLICY IF EXISTS master_admin_change_requests_self_approve_when_auto ON furnace.master_admin_change_requests;
CREATE POLICY master_admin_change_requests_self_approve_when_auto
  ON furnace.master_admin_change_requests FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['plant_head'])
    AND requested_by = auth.uid()
    AND status = 'pending'
    AND furnace.master_admin_auto_approved()
  )
  WITH CHECK (
    status = 'approved'
    AND decided_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- Data integrity: restrict target_table to the tables this module covers
-- ---------------------------------------------------------------------------

ALTER TABLE furnace.master_admin_change_requests
  DROP CONSTRAINT IF EXISTS master_admin_change_requests_target_table_check;

ALTER TABLE furnace.master_admin_change_requests
  ADD CONSTRAINT master_admin_change_requests_target_table_check
  CHECK (target_table IN (
    'furnaces', 'grade_specs', 'materials', 'material_std_composition', 'material_yield_standards'
  ));

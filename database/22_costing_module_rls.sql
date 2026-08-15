-- Migration: RLS for the Costing screens (Rate Master + Heat Costing), reusing the same
-- maker-checker infrastructure built for Master Admin (21_master_admin_maker_checker_gate.sql).
--
-- Context — 03i_Furnace_Module_Costing_MasterAdmin.md:
--   §2/§5: furnace.rate_master (base entries — new rates, quantity/effective_from corrections)
--          is explicitly Master-Admin-covered data: Plant-Head-maker / Owner-checker, gated by
--          approval_settings.requires_owner_approval for 'master_admin_change'. It was left out
--          of 21_master_admin_maker_checker_gate.sql on purpose (that pass was scoped to the five
--          entity screens only) but needs the exact same treatment now that Rate Master is built.
--   §3:    furnace.heat_costing.material_cost_final override is Plant-Head-maker / Owner-checker
--          too, but gated by a *different* approval_settings row — 'rate_override', not
--          'master_admin_change'. There is no separate request table for this in the schema, so
--          it reuses furnace.master_admin_change_requests generically (target_table =
--          'heat_costing'), just checked against the other gate.
--   §4:    Everything else on heat_costing (material_cost_computed, the FIFO lock, and the
--          hand-entered fuel/manpower/consumables/electrical/transport/selling-price "base cost
--          inputs" + their derived cost_per_kg/savings) is a routine Plant Head/Owner
--          computation, never gated — only the override of material_cost_final needs sign-off.
--
-- This migration:
--   1. Adds furnace.rate_override_auto_approved() — the 'rate_override' twin of
--      furnace.master_admin_auto_approved() (unchanged, still hardcoded to 'master_admin_change').
--   2. Widens master_admin_change_requests_target_table_check to also allow 'rate_master' and
--      'heat_costing'.
--   3. Fixes master_admin_change_requests_self_approve_when_auto (21) so a heat_costing request
--      checks the rate_override gate instead of the master_admin_change gate — every other
--      target_table keeps checking master_admin_change_auto_approved() exactly as before.
--   4. Replaces rate_master's INSERT/UPDATE policies:
--        - INSERT and "correct any field" UPDATE: gated the same way as every other Master Admin
--          table (Owner unconditional, Plant Head only when the gate is off).
--        - A second, always-on UPDATE policy restricted to remaining_qty_kg only, for the FIFO
--          consumption side-effect performed by computeAndSaveHeatCosting (costingService.ts)
--          when Plant Head/Owner computes a heat's costing — this is bookkeeping, not a "master
--          admin change", and must never wait on an approval gate. Multiple permissive UPDATE
--          policies are OR'd (by both USING and WITH CHECK), so a plain remaining_qty_kg-only
--          update always succeeds via this policy regardless of the gate, while any update that
--          also touches rate_per_kg/quantity_kg/item/item_type/effective_from must go through the
--          gated policy instead.
--   5. Splits heat_costing's single UPDATE policy into the same two-policy pattern:
--        - "recompute": Plant Head/Owner, always on, WITH CHECK requires material_cost_final and
--          all override bookkeeping columns to be unchanged from the existing row — this is the
--          hand-entered base cost inputs + their derived cost_per_kg/savings, never gated.
--        - "override": Owner unconditional, Plant Head only when rate_override_auto_approved(),
--          WITH CHECK requires material_cost_computed and every base cost input to be unchanged —
--          this is the one thing that ever needs the gate.
--      Same OR-combination logic as rate_master above: a combined update touching both groups in
--      one UPDATE call fails both checks and is rejected, exactly as intended (the app always
--      issues these as two separate calls — see costingService.ts).
--
-- rate_master.source_ref_id already exists in the base schema.sql (added when heat_costing/
-- rate_master were first created) — nothing to add here.
--
-- Does NOT touch or delete any existing data.
--
-- Safe to run multiple times: uses DROP POLICY/CONSTRAINT IF EXISTS before CREATE.
--
-- Apply after: 21_master_admin_maker_checker_gate.sql

-- ---------------------------------------------------------------------------
-- Helper: is a rate override currently auto-approved?
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION furnace.rate_override_auto_approved()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT NOT COALESCE(
    (SELECT requires_owner_approval FROM furnace.approval_settings WHERE action_type = 'rate_override'),
    true
  );
$$;

-- ---------------------------------------------------------------------------
-- master_admin_change_requests: widen target_table, fix the gate check per target_table
-- ---------------------------------------------------------------------------

ALTER TABLE furnace.master_admin_change_requests
  DROP CONSTRAINT IF EXISTS master_admin_change_requests_target_table_check;

ALTER TABLE furnace.master_admin_change_requests
  ADD CONSTRAINT master_admin_change_requests_target_table_check
  CHECK (target_table IN (
    'furnaces', 'grade_specs', 'materials', 'material_std_composition', 'material_yield_standards',
    'rate_master', 'heat_costing'
  ));

DROP POLICY IF EXISTS master_admin_change_requests_self_approve_when_auto ON furnace.master_admin_change_requests;
CREATE POLICY master_admin_change_requests_self_approve_when_auto
  ON furnace.master_admin_change_requests FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['plant_head'])
    AND requested_by = auth.uid()
    AND status = 'pending'
    AND (
      (target_table = 'heat_costing' AND furnace.rate_override_auto_approved())
      OR (target_table != 'heat_costing' AND furnace.master_admin_auto_approved())
    )
  )
  WITH CHECK (
    status = 'approved'
    AND decided_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- furnace.rate_master
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS rate_master_insert_plant_head_owner ON furnace.rate_master;
CREATE POLICY rate_master_insert_gated
  ON furnace.rate_master FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  );

DROP POLICY IF EXISTS rate_master_update_plant_head_owner ON furnace.rate_master;

CREATE POLICY rate_master_update_gated
  ON furnace.rate_master FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  )
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  );

-- FIFO consumption side-effect only — never gated. WITH CHECK re-reads item/item_type/
-- rate_per_kg/quantity_kg/effective_from by id and requires them identical to before the update,
-- so this policy can only ever change remaining_qty_kg.
CREATE POLICY rate_master_fifo_consume_update
  ON furnace.rate_master FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']))
  WITH CHECK (
    furnace.has_role(ARRAY['plant_head', 'admin_owner'])
    AND item = (SELECT r.item FROM furnace.rate_master r WHERE r.id = rate_master.id)
    AND item_type = (SELECT r.item_type FROM furnace.rate_master r WHERE r.id = rate_master.id)
    AND rate_per_kg = (SELECT r.rate_per_kg FROM furnace.rate_master r WHERE r.id = rate_master.id)
    AND quantity_kg IS NOT DISTINCT FROM (SELECT r.quantity_kg FROM furnace.rate_master r WHERE r.id = rate_master.id)
    AND effective_from = (SELECT r.effective_from FROM furnace.rate_master r WHERE r.id = rate_master.id)
  );

-- ---------------------------------------------------------------------------
-- furnace.heat_costing
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS heat_costing_update_plant_head_owner ON furnace.heat_costing;

-- Recompute the hand-entered base cost inputs (03i §4) and their derived cost_per_kg/savings —
-- always allowed for Plant Head/Owner, but can never touch material_cost_final or the override
-- bookkeeping columns; that is exactly what the gated policy below is for.
CREATE POLICY heat_costing_recompute_update
  ON furnace.heat_costing FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']))
  WITH CHECK (
    furnace.has_role(ARRAY['plant_head', 'admin_owner'])
    AND material_cost_final = (SELECT h.material_cost_final FROM furnace.heat_costing h WHERE h.id = heat_costing.id)
    AND material_cost_override_reason IS NOT DISTINCT FROM (SELECT h.material_cost_override_reason FROM furnace.heat_costing h WHERE h.id = heat_costing.id)
    AND overridden_by IS NOT DISTINCT FROM (SELECT h.overridden_by FROM furnace.heat_costing h WHERE h.id = heat_costing.id)
    AND overridden_at IS NOT DISTINCT FROM (SELECT h.overridden_at FROM furnace.heat_costing h WHERE h.id = heat_costing.id)
  );

-- The material_cost_final override (03i §3) — Owner unconditional, Plant Head only when the
-- rate_override gate is off. Restricted to only the override bookkeeping columns; the FIFO
-- figure and every base cost input must stay exactly as they were.
CREATE POLICY heat_costing_override_update
  ON furnace.heat_costing FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.rate_override_auto_approved())
  )
  WITH CHECK (
    (
      furnace.has_role(ARRAY['admin_owner'])
      OR (furnace.has_role(ARRAY['plant_head']) AND furnace.rate_override_auto_approved())
    )
    AND material_cost_computed = (SELECT h.material_cost_computed FROM furnace.heat_costing h WHERE h.id = heat_costing.id)
    AND fuel_cost = (SELECT h.fuel_cost FROM furnace.heat_costing h WHERE h.id = heat_costing.id)
    AND manpower_cost = (SELECT h.manpower_cost FROM furnace.heat_costing h WHERE h.id = heat_costing.id)
    AND consumables_cost = (SELECT h.consumables_cost FROM furnace.heat_costing h WHERE h.id = heat_costing.id)
    AND electrical_cost = (SELECT h.electrical_cost FROM furnace.heat_costing h WHERE h.id = heat_costing.id)
    AND transport_cost = (SELECT h.transport_cost FROM furnace.heat_costing h WHERE h.id = heat_costing.id)
    AND cost_per_kg = (SELECT h.cost_per_kg FROM furnace.heat_costing h WHERE h.id = heat_costing.id)
    AND selling_price_per_kg = (SELECT h.selling_price_per_kg FROM furnace.heat_costing h WHERE h.id = heat_costing.id)
    AND savings = (SELECT h.savings FROM furnace.heat_costing h WHERE h.id = heat_costing.id)
  );

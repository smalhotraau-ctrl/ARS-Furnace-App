-- Migration: open SELECT on furnace.furnaces to all furnace roles
--
-- Context: furnace.furnaces is master/reference data consumed for dropdown
-- population on multiple screens:
--   - Supervisor needs it to pick a furnace when starting a heat on the
--     Heat Charging screen (fetchMainFurnacesForHeat, src/lib/heatService.ts)
--   - Plant Head needs it to pick a furnace when creating a Batch Plan
--     (fetchMainFurnaces, src/lib/batchPlanService.ts)
--
-- furnaces was restricted to plant_head/admin_owner for SELECT — the same
-- too-restrictive pattern already fixed on grade_specs,
-- material_std_composition, and material_yield_standards in
-- 01_open_reference_data_select.sql. Under any other role (supervisor, qa)
-- the query returns zero rows, which is why the furnace dropdown on Heat
-- Charging showed no options even though SF-01 exists in the table.
--
-- This migration widens SELECT to all four roles (supervisor, qa,
-- plant_head, admin_owner). INSERT/UPDATE remain untouched — furnaces are
-- still maintained only via the existing Master Admin maker-checker flow
-- (plant_head propose / admin_owner approve, per 03b).
--
-- Other master/reference tables were reviewed and found correctly scoped
-- as-is (no dropdown usage, or a deliberate access restriction per 03b):
--   - furnace.rate_master: financial rate data, not dropdown data.
--     Supervisor/QA must get zero rows here by design (see 03b section 4 —
--     "Supervisor and QA roles get zero rows back, not redacted fields").
--   - furnace.heat_costing, approval_settings,
--     master_admin_change_requests, heat_cancel_requests,
--     heat_no_corrections, heat_output_flags: Plant-Head-or-above visibility
--     is intentional per 03b, not reference/dropdown data.
--
-- Safe to run multiple times: policy is dropped before being recreated.
--
-- Apply after: 00_common_schema.sql, schema.sql, 01_open_reference_data_select.sql

DROP POLICY IF EXISTS furnaces_select_plant_head_owner ON furnace.furnaces;
DROP POLICY IF EXISTS furnaces_select_all_roles ON furnace.furnaces;

CREATE POLICY furnaces_select_all_roles
  ON furnace.furnaces FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

-- INSERT/UPDATE stay restricted to Master Admin maker-checker (unchanged):
--   furnaces_insert_plant_head_owner
--   furnaces_update_admin_owner

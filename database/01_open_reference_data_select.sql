-- Migration: open SELECT on reference/master data to all furnace roles
--
-- Context: grade_specs, material_std_composition, and material_yield_standards
-- are reference data consumed by calculations across multiple screens:
--   - QA needs grade_specs to flag Spectro readings against spec (03e)
--   - Supervisor/Plant Head need material_std_composition for Batch Planning
--     expected-composition calculations (03c)
--   - Output/Plant Head need material_yield_standards for yield variance (03f)
--
-- These tables were originally restricted to plant_head/admin_owner for
-- SELECT, which blocks supervisor and qa from reading data they need for
-- read-only, advisory calculations on their own screens.
--
-- This migration widens SELECT to all four roles (supervisor, qa, plant_head,
-- admin_owner). INSERT/UPDATE/DELETE remain untouched — masters are still
-- maintained only via the existing Master Admin maker-checker flow
-- (plant_head propose / admin_owner approve, per 03b), and grade_specs
-- remains immutable (no UPDATE policy).
--
-- Safe to run multiple times: policies are dropped before being recreated.
--
-- Apply after: 00_common_schema.sql, schema.sql

-- ---------------------------------------------------------------------------
-- furnace.grade_specs — widen SELECT only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS grade_specs_select_plant_head_owner ON furnace.grade_specs;
DROP POLICY IF EXISTS grade_specs_select_all_roles ON furnace.grade_specs;

CREATE POLICY grade_specs_select_all_roles
  ON furnace.grade_specs FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

-- INSERT stays restricted to Master Admin maker-checker (unchanged):
--   grade_specs_insert_plant_head_owner
-- No UPDATE policy — grade_specs remain immutable once created (unchanged).

-- ---------------------------------------------------------------------------
-- furnace.material_std_composition — widen SELECT only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS material_std_composition_select_plant_head_owner ON furnace.material_std_composition;
DROP POLICY IF EXISTS material_std_composition_select_all_roles ON furnace.material_std_composition;

CREATE POLICY material_std_composition_select_all_roles
  ON furnace.material_std_composition FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

-- INSERT/UPDATE stay restricted to Master Admin maker-checker (unchanged):
--   material_std_composition_insert_plant_head_owner
--   material_std_composition_update_admin_owner

-- ---------------------------------------------------------------------------
-- furnace.material_yield_standards — widen SELECT only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS material_yield_standards_select_plant_head_owner ON furnace.material_yield_standards;
DROP POLICY IF EXISTS material_yield_standards_select_all_roles ON furnace.material_yield_standards;

CREATE POLICY material_yield_standards_select_all_roles
  ON furnace.material_yield_standards FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

-- INSERT/UPDATE stay restricted to Master Admin maker-checker (unchanged):
--   material_yield_standards_insert_plant_head_owner
--   material_yield_standards_update_plant_head_owner

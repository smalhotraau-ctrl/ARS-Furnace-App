-- New master: furnace.materials(code, name, active)
--
-- The "Material" field on Charging's Add Charge Line form was free text —
-- there was no materials reference table. This adds one, managed the same
-- way as the other Master Admin data (furnaces, grade_specs,
-- material_std_composition, material_yield_standards): Plant Head proposes
-- (maker), Owner approves/edits (checker).
--
-- Safe to run multiple times: CREATE TABLE IF NOT EXISTS, policies dropped
-- before recreation, grants are idempotent.
--
-- Apply after: 00_common_schema.sql, schema.sql, 06_grant_schema_and_table_privileges.sql

CREATE TABLE IF NOT EXISTS furnace.materials (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text NOT NULL UNIQUE,
  name       text NOT NULL,
  active     boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES common.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES common.users (id),
  updated_at timestamptz
);

ALTER TABLE furnace.materials ENABLE ROW LEVEL SECURITY;

-- SELECT open to all four roles from day one — Supervisor needs this to
-- populate the Material dropdown on Charging. (Learned from the earlier
-- furnaces/grade_specs/material_std_composition/material_yield_standards
-- gap: don't restrict SELECT on reference data that entry screens depend
-- on to read.)
DROP POLICY IF EXISTS materials_select_all_roles ON furnace.materials;
CREATE POLICY materials_select_all_roles
  ON furnace.materials FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

-- INSERT: Plant Head proposes (maker); Owner can also insert directly —
-- same pattern as furnaces_insert_plant_head_owner.
DROP POLICY IF EXISTS materials_insert_plant_head_owner ON furnace.materials;
CREATE POLICY materials_insert_plant_head_owner
  ON furnace.materials FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

-- UPDATE: Owner only (checker) — same pattern as furnaces_update_admin_owner.
DROP POLICY IF EXISTS materials_update_admin_owner ON furnace.materials;
CREATE POLICY materials_update_admin_owner
  ON furnace.materials FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['admin_owner']))
  WITH CHECK (furnace.has_role(ARRAY['admin_owner']));

-- Explicit baseline grant for this specific new table, in case it's created
-- by a session that didn't inherit the ALTER DEFAULT PRIVILEGES set in
-- 06_grant_schema_and_table_privileges.sql (that only auto-applies to
-- future tables created by the same role that ran the ALTER DEFAULT
-- PRIVILEGES statement).
GRANT SELECT, INSERT, UPDATE, DELETE ON furnace.materials TO authenticated;

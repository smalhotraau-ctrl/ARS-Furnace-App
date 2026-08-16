-- Migration: Process Cost Standards for batch-plan planning estimates (03c §5).
--
-- One versioned row set (fuel / manpower / consumables / electrical+transport ₹/kg),
-- latest effective_from <= plan date is current — same pattern as rate_master.
-- Master Admin maker-checker via master_admin_change_requests, gated by
-- approval_settings.master_admin_change (same as other Master Admin tables).
--
-- Does NOT touch or delete any existing data.
-- Safe to run multiple times: uses DROP POLICY/CONSTRAINT IF EXISTS before CREATE.
--
-- Apply after: 29_spectro_reports_correction_update.sql

CREATE TABLE IF NOT EXISTS furnace.process_cost_standards (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_cost_per_kg              numeric NOT NULL CHECK (fuel_cost_per_kg >= 0),
  manpower_cost_per_kg          numeric NOT NULL CHECK (manpower_cost_per_kg >= 0),
  consumables_cost_per_kg       numeric NOT NULL CHECK (consumables_cost_per_kg >= 0),
  electrical_transport_cost_per_kg numeric NOT NULL CHECK (electrical_transport_cost_per_kg >= 0),
  effective_from                date NOT NULL,
  updated_by                    uuid NOT NULL REFERENCES common.users (id),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS process_cost_standards_effective_from_idx
  ON furnace.process_cost_standards (effective_from DESC);

ALTER TABLE furnace.process_cost_standards ENABLE ROW LEVEL SECURITY;

-- Plant Head / Owner only — same zero-access posture as rate_master / Master Admin.
DROP POLICY IF EXISTS process_cost_standards_select_plant_head_owner ON furnace.process_cost_standards;
CREATE POLICY process_cost_standards_select_plant_head_owner
  ON furnace.process_cost_standards FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

DROP POLICY IF EXISTS process_cost_standards_insert_gated ON furnace.process_cost_standards;
CREATE POLICY process_cost_standards_insert_gated
  ON furnace.process_cost_standards FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  );

-- Versioned master — corrections are new rows, not in-place edits (same as rate_master gated UPDATE).
DROP POLICY IF EXISTS process_cost_standards_update_gated ON furnace.process_cost_standards;
CREATE POLICY process_cost_standards_update_gated
  ON furnace.process_cost_standards FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  )
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  );

-- Widen maker-checker target_table for process_cost_standards proposals.
ALTER TABLE furnace.master_admin_change_requests
  DROP CONSTRAINT IF EXISTS master_admin_change_requests_target_table_check;

ALTER TABLE furnace.master_admin_change_requests
  ADD CONSTRAINT master_admin_change_requests_target_table_check
  CHECK (target_table IN (
    'furnaces', 'grade_specs', 'materials', 'material_std_composition', 'material_yield_standards',
    'rate_master', 'heat_costing', 'process_cost_standards'
  ));

COMMENT ON TABLE furnace.process_cost_standards IS
  'Versioned ₹/kg process rates for batch-plan cost estimates only — not used by heat_costing.';

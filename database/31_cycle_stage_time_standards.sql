-- Migration: Designated cycle stage time standards + cycle time exception flags (03d / 03j).
--
-- cycle_stage_time_standards — one target_minutes row per cycle stage (Master Admin).
-- cycle_stage_time_flags — written when a finished stage exceeds its target; Plant Head/Owner
--   acknowledge on dashboard. Never blocks the heat.
--
-- Apply after: 30_process_cost_standards.sql

-- ---------------------------------------------------------------------------
-- cycle_stage_time_standards
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS furnace.cycle_stage_time_standards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage           text NOT NULL CHECK (stage IN (
    'preheating', 'charging', 'melting', 'drossing', 'iron_removal',
    'alloying', 'degassing', 'casting', 'cleaning'
  )),
  target_minutes  numeric NOT NULL CHECK (target_minutes > 0),
  updated_by      uuid NOT NULL REFERENCES common.users (id),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stage)
);

ALTER TABLE furnace.cycle_stage_time_standards ENABLE ROW LEVEL SECURITY;

-- Supervisors need read access for the live target nudge on cycle cards (03d); writes stay gated.
DROP POLICY IF EXISTS cycle_stage_time_standards_select_floor ON furnace.cycle_stage_time_standards;
CREATE POLICY cycle_stage_time_standards_select_floor
  ON furnace.cycle_stage_time_standards FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'plant_head', 'admin_owner']));

DROP POLICY IF EXISTS cycle_stage_time_standards_insert_gated ON furnace.cycle_stage_time_standards;
CREATE POLICY cycle_stage_time_standards_insert_gated
  ON furnace.cycle_stage_time_standards FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    OR (furnace.has_role(ARRAY['plant_head']) AND furnace.master_admin_auto_approved())
  );

DROP POLICY IF EXISTS cycle_stage_time_standards_update_gated ON furnace.cycle_stage_time_standards;
CREATE POLICY cycle_stage_time_standards_update_gated
  ON furnace.cycle_stage_time_standards FOR UPDATE
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
-- cycle_stage_time_flags
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS furnace.cycle_stage_time_flags (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id          uuid NOT NULL REFERENCES furnace.heats (id),
  stage            text NOT NULL CHECK (stage IN (
    'preheating', 'charging', 'melting', 'drossing', 'iron_removal',
    'alloying', 'degassing', 'casting', 'cleaning'
  )),
  actual_minutes   numeric NOT NULL CHECK (actual_minutes >= 0),
  target_minutes   numeric NOT NULL CHECK (target_minutes > 0),
  flagged_at       timestamptz NOT NULL DEFAULT now(),
  acknowledged_by  uuid REFERENCES common.users (id),
  acknowledged_at  timestamptz,
  note             text,
  idempotency_key  uuid NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS cycle_stage_time_flags_open_idx
  ON furnace.cycle_stage_time_flags (flagged_at DESC)
  WHERE acknowledged_at IS NULL;

ALTER TABLE furnace.cycle_stage_time_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cycle_stage_time_flags_select_plant_head_owner ON furnace.cycle_stage_time_flags;
CREATE POLICY cycle_stage_time_flags_select_plant_head_owner
  ON furnace.cycle_stage_time_flags FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

DROP POLICY IF EXISTS cycle_stage_time_flags_insert_supervisor ON furnace.cycle_stage_time_flags;
CREATE POLICY cycle_stage_time_flags_insert_supervisor
  ON furnace.cycle_stage_time_flags FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['supervisor', 'plant_head', 'admin_owner']));

DROP POLICY IF EXISTS cycle_stage_time_flags_acknowledge_plant_head_owner ON furnace.cycle_stage_time_flags;
CREATE POLICY cycle_stage_time_flags_acknowledge_plant_head_owner
  ON furnace.cycle_stage_time_flags FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']))
  WITH CHECK (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

-- ---------------------------------------------------------------------------
-- Maker-checker target_table
-- ---------------------------------------------------------------------------

ALTER TABLE furnace.master_admin_change_requests
  DROP CONSTRAINT IF EXISTS master_admin_change_requests_target_table_check;

ALTER TABLE furnace.master_admin_change_requests
  ADD CONSTRAINT master_admin_change_requests_target_table_check
  CHECK (target_table IN (
    'furnaces', 'grade_specs', 'materials', 'material_std_composition', 'material_yield_standards',
    'rate_master', 'heat_costing', 'process_cost_standards', 'cycle_stage_time_standards'
  ));

COMMENT ON TABLE furnace.cycle_stage_time_standards IS
  'Designated target duration (minutes) per cycle stage for floor nudges and exception flagging.';
COMMENT ON TABLE furnace.cycle_stage_time_flags IS
  'Cycle stages that exceeded target_minutes — Plant Head/Owner dashboard exceptions only.';

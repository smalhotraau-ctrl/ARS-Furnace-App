-- Furnace App — complete schema
-- Source of truth: 03a_Furnace_DataModel.md
-- RLS policies: 03b_Furnace_Roles_Permissions.md
--
-- Prerequisites:
--   - Supabase auth enabled
--   - common.users table exists with columns (id uuid PK, role text)
--     Roles: supervisor | qa | plant_head | admin_owner

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS furnace;

-- ---------------------------------------------------------------------------
-- Helper functions for RLS (role from common.users, never client-supplied)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION furnace.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.role
  FROM common.users u
  WHERE u.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION furnace.has_role(allowed_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT furnace.current_user_role() = ANY (allowed_roles);
$$;

CREATE OR REPLACE FUNCTION furnace.is_authenticated_furnace_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT furnace.current_user_role() IS NOT NULL;
$$;

-- ---------------------------------------------------------------------------
-- 1. Masters
-- ---------------------------------------------------------------------------

CREATE TABLE furnace.furnaces (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE,
  name             text NOT NULL,
  type             text NOT NULL CHECK (type IN ('main', 'pit')),
  heat_code_letter text,
  active           boolean NOT NULL DEFAULT true
);

CREATE TABLE furnace.grade_specs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_code     text NOT NULL,
  element        text NOT NULL,
  min_pct        numeric NOT NULL,
  max_pct        numeric NOT NULL,
  active         boolean NOT NULL DEFAULT true,
  superseded_by  uuid REFERENCES furnace.grade_specs (id),
  created_by     uuid NOT NULL REFERENCES common.users (id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grade_code, element)
);

CREATE TABLE furnace.material_std_composition (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_code text NOT NULL,
  element       text NOT NULL,
  std_pct       numeric NOT NULL,
  UNIQUE (material_code, element)
);

CREATE TABLE furnace.material_yield_standards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_code text NOT NULL,
  metric        text NOT NULL CHECK (metric IN ('ingot_pct', 'dross_pct', 'rejection_pct', 'burn_loss_pct')),
  min_pct       numeric NOT NULL,
  max_pct       numeric NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_by    uuid NOT NULL REFERENCES common.users (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid REFERENCES common.users (id),
  updated_at    timestamptz,
  UNIQUE (material_code, metric)
);

-- ---------------------------------------------------------------------------
-- 2. Rate master & FIFO costing
-- ---------------------------------------------------------------------------

CREATE TABLE furnace.rate_master (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item              text NOT NULL,
  item_type         text NOT NULL CHECK (item_type IN ('lot_material', 'flat_rate')),
  rate_per_kg       numeric NOT NULL,
  quantity_kg       numeric,
  remaining_qty_kg  numeric,
  effective_from    date NOT NULL,
  source_ref_id     uuid,
  updated_by        uuid NOT NULL REFERENCES common.users (id),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE furnace.rate_consumption_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id         uuid NOT NULL,
  rate_master_id  uuid NOT NULL REFERENCES furnace.rate_master (id),
  item            text NOT NULL,
  kg_consumed     numeric NOT NULL,
  rate_used       numeric NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. Batch planning
-- ---------------------------------------------------------------------------

CREATE TABLE furnace.batch_plans (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  furnace_code           text NOT NULL REFERENCES furnace.furnaces (code),
  grade_code             text NOT NULL,
  plan_date              date NOT NULL,
  planned_lines          jsonb NOT NULL,
  expected_composition   jsonb NOT NULL,
  status                 text NOT NULL,
  owner_reviewed         boolean NOT NULL DEFAULT false,
  owner_reviewed_by      uuid REFERENCES common.users (id),
  owner_reviewed_at      timestamptz,
  owner_review_note      text,
  created_by             uuid NOT NULL REFERENCES common.users (id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_by             uuid REFERENCES common.users (id),
  updated_at             timestamptz
);

-- ---------------------------------------------------------------------------
-- 4. Heats — core record
-- ---------------------------------------------------------------------------

CREATE TABLE furnace.heats (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_no         text NOT NULL UNIQUE,
  furnace_code    text NOT NULL REFERENCES furnace.furnaces (code),
  batch_plan_id   uuid REFERENCES furnace.batch_plans (id),
  grade_code      text NOT NULL,
  customer        text,
  shift_id        uuid,
  crew            jsonb NOT NULL,
  status          text NOT NULL CHECK (status IN (
                    'Planned', 'Charging', 'Melting', 'Casting',
                    'Output Entered', 'Closed', 'Cancelled'
                  )),
  fuel_reading    numeric,
  verified_by     uuid REFERENCES common.users (id),
  verified_at     timestamptz,
  created_by      uuid NOT NULL REFERENCES common.users (id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES common.users (id),
  updated_at      timestamptz
);

-- [GATE] at most one active heat per furnace
CREATE UNIQUE INDEX one_active_heat_per_furnace
  ON furnace.heats (furnace_code)
  WHERE status NOT IN ('Closed', 'Cancelled');

CREATE TABLE furnace.heat_cancel_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id         uuid NOT NULL REFERENCES furnace.heats (id),
  requested_by    uuid NOT NULL REFERENCES common.users (id),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  reason          text NOT NULL,
  status          text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by      uuid REFERENCES common.users (id),
  decided_at      timestamptz,
  decision_note   text
);

CREATE TABLE furnace.heat_no_corrections (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id           uuid NOT NULL REFERENCES furnace.heats (id),
  original_heat_no  text NOT NULL,
  requested_heat_no text NOT NULL,
  requested_by      uuid NOT NULL REFERENCES common.users (id),
  requested_at      timestamptz NOT NULL DEFAULT now(),
  reason            text NOT NULL,
  status            text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by        uuid REFERENCES common.users (id),
  decided_at        timestamptz
);

-- ---------------------------------------------------------------------------
-- 5. Charging & cycle
-- ---------------------------------------------------------------------------

CREATE TABLE furnace.charge_lines (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id               uuid NOT NULL REFERENCES furnace.heats (id),
  bin_bay               text NOT NULL,
  material_code         text NOT NULL,
  gross_kg              numeric NOT NULL,
  tare_kg               numeric NOT NULL,
  net_kg                numeric NOT NULL,
  is_mid_heat_addition  boolean NOT NULL DEFAULT false,
  added_at              timestamptz NOT NULL,
  created_by            uuid NOT NULL REFERENCES common.users (id),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE furnace.cycle_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id      uuid NOT NULL REFERENCES furnace.heats (id),
  stage        text NOT NULL CHECK (stage IN (
                 'preheating', 'charging', 'melting', 'drossing', 'iron_removal',
                 'alloying', 'degassing', 'casting', 'cleaning'
               )),
  start_ts     timestamptz NOT NULL,
  finish_ts    timestamptz,
  recorded_by  uuid NOT NULL REFERENCES common.users (id),
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE furnace.temp_readings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id      uuid NOT NULL REFERENCES furnace.heats (id),
  checkpoint   text NOT NULL CHECK (checkpoint IN (
                 'mould_preheat', 'melting', 'iron_removal', 'alloying', 'casting'
               )),
  value        numeric NOT NULL,
  spec_min     numeric,
  spec_max     numeric,
  recorded_by  uuid NOT NULL REFERENCES common.users (id),
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 6. Spectro
-- ---------------------------------------------------------------------------

CREATE TABLE furnace.spectro_reports (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id                uuid NOT NULL REFERENCES furnace.heats (id),
  report_type            text NOT NULL CHECK (report_type IN ('process', 'final')),
  composition            jsonb NOT NULL,
  sample_time            timestamptz NOT NULL,
  correction_suggested   jsonb,
  recorded_by            uuid NOT NULL REFERENCES common.users (id),
  recorded_at            timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 7. Output, close & yield standards
-- ---------------------------------------------------------------------------

CREATE TABLE furnace.heat_output (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id           uuid NOT NULL UNIQUE REFERENCES furnace.heats (id),
  ingot_kg          numeric NOT NULL,
  dross_kg          numeric NOT NULL,
  rejection_kg      numeric NOT NULL,
  exceptional_label text,
  exceptional_kg    numeric,
  burn_loss_kg      numeric NOT NULL,
  ingot_pct         numeric NOT NULL,
  dross_pct         numeric NOT NULL,
  rejection_pct     numeric NOT NULL,
  burn_loss_pct     numeric NOT NULL,
  verified_by       uuid REFERENCES common.users (id),
  verified_at       timestamptz,
  recorded_by       uuid NOT NULL REFERENCES common.users (id),
  recorded_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE furnace.heat_output_flags (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id               uuid NOT NULL REFERENCES furnace.heats (id),
  metric                text NOT NULL CHECK (metric IN ('ingot_pct', 'dross_pct', 'rejection_pct', 'burn_loss_pct')),
  actual_pct            numeric NOT NULL,
  expected_min_pct      numeric NOT NULL,
  expected_max_pct      numeric NOT NULL,
  acknowledged_by       uuid REFERENCES common.users (id),
  acknowledged_at       timestamptz,
  acknowledgement_note  text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 8. Finished goods, bundling & dispatch
-- ---------------------------------------------------------------------------

CREATE TABLE furnace.fg_stock (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id      uuid NOT NULL UNIQUE REFERENCES furnace.heats (id),
  grade_code   text NOT NULL,
  kg_available numeric NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE furnace.bundles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id    uuid NOT NULL REFERENCES furnace.heats (id),
  bundle_no  text NOT NULL,
  pieces     integer NOT NULL,
  weight_kg  numeric NOT NULL,
  packed_by  uuid NOT NULL REFERENCES common.users (id),
  packed_at  timestamptz NOT NULL
);

CREATE TABLE furnace.dispatches (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_name               text NOT NULL,
  invoice_no               text NOT NULL,
  dispatch_date            date NOT NULL,
  kg_dispatched            numeric NOT NULL DEFAULT 0,
  shortage_kg              numeric,
  shortage_reported_date   date,
  created_by               uuid NOT NULL REFERENCES common.users (id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid REFERENCES common.users (id),
  updated_at               timestamptz
);

CREATE TABLE furnace.dispatch_lines (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id   uuid NOT NULL REFERENCES furnace.dispatches (id),
  heat_id       uuid NOT NULL REFERENCES furnace.heats (id),
  kg_dispatched numeric NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dispatch_id, heat_id)
);

-- ---------------------------------------------------------------------------
-- 9. Pit furnace (fully independent)
-- ---------------------------------------------------------------------------

CREATE TABLE furnace.pit_heats (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date                 date NOT NULL,
  heat_no              text NOT NULL,
  weight_kg            numeric NOT NULL,
  ingot_kg             numeric NOT NULL,
  dross_kg             numeric NOT NULL,
  pit_iron_kg          numeric NOT NULL,
  wood_fuel_kg         numeric NOT NULL,
  composition          jsonb NOT NULL,
  sale_kg              numeric NOT NULL DEFAULT 0,
  quality_recorded_by  uuid REFERENCES common.users (id),
  quality_recorded_at  timestamptz,
  created_by           uuid NOT NULL REFERENCES common.users (id),
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 10. Governance — approvals & Master Admin
-- ---------------------------------------------------------------------------

CREATE TABLE furnace.approval_settings (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type               text NOT NULL UNIQUE CHECK (action_type IN ('rate_override', 'master_admin_change')),
  requires_owner_approval   boolean NOT NULL DEFAULT true,
  updated_by                uuid NOT NULL REFERENCES common.users (id),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE furnace.master_admin_change_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_table    text NOT NULL,
  target_id       uuid,
  action          text NOT NULL CHECK (action IN ('create', 'update')),
  payload         jsonb NOT NULL,
  requested_by    uuid NOT NULL REFERENCES common.users (id),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by      uuid REFERENCES common.users (id),
  decided_at      timestamptz,
  decision_note   text
);

-- ---------------------------------------------------------------------------
-- 11. Costing
-- ---------------------------------------------------------------------------

CREATE TABLE furnace.heat_costing (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  heat_id                       uuid NOT NULL UNIQUE REFERENCES furnace.heats (id),
  material_cost_computed        numeric NOT NULL,
  material_cost_final           numeric NOT NULL,
  material_cost_override_reason text,
  overridden_by                 uuid REFERENCES common.users (id),
  overridden_at                 timestamptz,
  fuel_cost                     numeric NOT NULL,
  manpower_cost                 numeric NOT NULL,
  consumables_cost              numeric NOT NULL,
  electrical_cost               numeric NOT NULL,
  transport_cost                numeric NOT NULL,
  cost_per_kg                   numeric NOT NULL,
  selling_price_per_kg          numeric NOT NULL,
  savings                       numeric NOT NULL,
  created_by                    uuid NOT NULL REFERENCES common.users (id),
  created_at                    timestamptz NOT NULL DEFAULT now()
);

-- Deferred FK: rate_consumption_log.heat_id -> heats (heats must exist first)
ALTER TABLE furnace.rate_consumption_log
  ADD CONSTRAINT rate_consumption_log_heat_id_fkey
  FOREIGN KEY (heat_id) REFERENCES furnace.heats (id);

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- balance_kg as of any date = SUM(ingot_kg) - SUM(sale_kg) over pit_heats where date <= X
CREATE OR REPLACE VIEW furnace.pit_balance AS
WITH daily_totals AS (
  SELECT
    date,
    SUM(ingot_kg) AS ingot_kg,
    SUM(sale_kg)  AS sale_kg
  FROM furnace.pit_heats
  GROUP BY date
),
date_spine AS (
  SELECT generate_series(
    COALESCE((SELECT MIN(date) FROM furnace.pit_heats), CURRENT_DATE),
    CURRENT_DATE,
    interval '1 day'
  )::date AS as_of_date
)
SELECT
  ds.as_of_date,
  COALESCE(SUM(dt.ingot_kg), 0) - COALESCE(SUM(dt.sale_kg), 0) AS balance_kg
FROM date_spine ds
LEFT JOIN daily_totals dt ON dt.date <= ds.as_of_date
GROUP BY ds.as_of_date
ORDER BY ds.as_of_date;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Keep dispatches.kg_dispatched in sync with dispatch_lines
CREATE OR REPLACE FUNCTION furnace.sync_dispatch_kg_dispatched()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = furnace
AS $$
DECLARE
  target_dispatch_id uuid;
BEGIN
  target_dispatch_id := COALESCE(NEW.dispatch_id, OLD.dispatch_id);

  UPDATE furnace.dispatches d
  SET
    kg_dispatched = COALESCE((
      SELECT SUM(dl.kg_dispatched)
      FROM furnace.dispatch_lines dl
      WHERE dl.dispatch_id = target_dispatch_id
    ), 0),
    updated_at = now()
  WHERE d.id = target_dispatch_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_dispatch_kg_dispatched
  AFTER INSERT OR UPDATE OR DELETE ON furnace.dispatch_lines
  FOR EACH ROW
  EXECUTE FUNCTION furnace.sync_dispatch_kg_dispatched();

-- Decrement fg_stock.kg_available when dispatch lines are saved
CREATE OR REPLACE FUNCTION furnace.decrement_fg_stock_on_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = furnace
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE furnace.fg_stock
    SET kg_available = kg_available - NEW.kg_dispatched,
        updated_at = now()
    WHERE heat_id = NEW.heat_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE furnace.fg_stock
    SET kg_available = kg_available + OLD.kg_dispatched - NEW.kg_dispatched,
        updated_at = now()
    WHERE heat_id = NEW.heat_id;
    IF OLD.heat_id IS DISTINCT FROM NEW.heat_id THEN
      UPDATE furnace.fg_stock
      SET kg_available = kg_available + OLD.kg_dispatched,
          updated_at = now()
      WHERE heat_id = OLD.heat_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE furnace.fg_stock
    SET kg_available = kg_available + OLD.kg_dispatched,
        updated_at = now()
    WHERE heat_id = OLD.heat_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_decrement_fg_stock_on_dispatch
  AFTER INSERT OR UPDATE OR DELETE ON furnace.dispatch_lines
  FOR EACH ROW
  EXECUTE FUNCTION furnace.decrement_fg_stock_on_dispatch();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE furnace.furnaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.grade_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.material_std_composition ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.material_yield_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.rate_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.rate_consumption_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.batch_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.heats ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.heat_cancel_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.heat_no_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.charge_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.cycle_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.temp_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.spectro_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.heat_output ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.heat_output_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.fg_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.dispatch_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.pit_heats ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.approval_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.master_admin_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE furnace.heat_costing ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS: furnace.furnaces (Master Admin — supervisor/qa no access)
-- ---------------------------------------------------------------------------

CREATE POLICY furnaces_select_plant_head_owner
  ON furnace.furnaces FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY furnaces_insert_plant_head_owner
  ON furnace.furnaces FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY furnaces_update_admin_owner
  ON furnace.furnaces FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['admin_owner']))
  WITH CHECK (furnace.has_role(ARRAY['admin_owner']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.grade_specs (immutable; Master Admin)
-- ---------------------------------------------------------------------------

CREATE POLICY grade_specs_select_plant_head_owner
  ON furnace.grade_specs FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY grade_specs_insert_plant_head_owner
  ON furnace.grade_specs FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

-- No UPDATE policy — grade_specs are immutable once created.

-- ---------------------------------------------------------------------------
-- RLS: furnace.material_std_composition (Master Admin)
-- ---------------------------------------------------------------------------

CREATE POLICY material_std_composition_select_plant_head_owner
  ON furnace.material_std_composition FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY material_std_composition_insert_plant_head_owner
  ON furnace.material_std_composition FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY material_std_composition_update_admin_owner
  ON furnace.material_std_composition FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['admin_owner']))
  WITH CHECK (furnace.has_role(ARRAY['admin_owner']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.material_yield_standards (Master Admin)
-- ---------------------------------------------------------------------------

CREATE POLICY material_yield_standards_select_plant_head_owner
  ON furnace.material_yield_standards FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY material_yield_standards_insert_plant_head_owner
  ON furnace.material_yield_standards FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY material_yield_standards_update_plant_head_owner
  ON furnace.material_yield_standards FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']))
  WITH CHECK (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.rate_master (Plant Head / Owner only — no partial-data leak)
-- ---------------------------------------------------------------------------

CREATE POLICY rate_master_select_plant_head_owner
  ON furnace.rate_master FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY rate_master_insert_plant_head_owner
  ON furnace.rate_master FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY rate_master_update_plant_head_owner
  ON furnace.rate_master FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']))
  WITH CHECK (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.rate_consumption_log (costing audit — Plant Head / Owner)
-- ---------------------------------------------------------------------------

CREATE POLICY rate_consumption_log_select_plant_head_owner
  ON furnace.rate_consumption_log FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY rate_consumption_log_insert_plant_head_owner
  ON furnace.rate_consumption_log FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.batch_plans
-- ---------------------------------------------------------------------------

CREATE POLICY batch_plans_select_all_roles
  ON furnace.batch_plans FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

CREATE POLICY batch_plans_insert_plant_head
  ON furnace.batch_plans FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['plant_head']));

CREATE POLICY batch_plans_update_plant_head
  ON furnace.batch_plans FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head']))
  WITH CHECK (furnace.has_role(ARRAY['plant_head']));

CREATE POLICY batch_plans_owner_review_admin_owner
  ON furnace.batch_plans FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['admin_owner']))
  WITH CHECK (furnace.has_role(ARRAY['admin_owner']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.heats
-- ---------------------------------------------------------------------------

CREATE POLICY heats_select_all_roles
  ON furnace.heats FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

CREATE POLICY heats_insert_ops_roles
  ON furnace.heats FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['supervisor', 'plant_head', 'admin_owner']));

CREATE POLICY heats_update_ops_roles
  ON furnace.heats FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'plant_head', 'admin_owner']))
  WITH CHECK (furnace.has_role(ARRAY['supervisor', 'plant_head', 'admin_owner']));

CREATE POLICY heats_verify_qa_plant_head
  ON furnace.heats FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['qa', 'plant_head']))
  WITH CHECK (furnace.has_role(ARRAY['qa', 'plant_head']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.heat_cancel_requests (fixed maker-checker; no supervisor/qa)
-- ---------------------------------------------------------------------------

CREATE POLICY heat_cancel_requests_select_plant_head_owner
  ON furnace.heat_cancel_requests FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY heat_cancel_requests_insert_plant_head
  ON furnace.heat_cancel_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['plant_head'])
    AND status = 'pending'
    AND requested_by = auth.uid()
  );

CREATE POLICY heat_cancel_requests_decide_admin_owner
  ON furnace.heat_cancel_requests FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['admin_owner'])
    AND status = 'pending'
  )
  WITH CHECK (furnace.has_role(ARRAY['admin_owner']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.heat_no_corrections (fixed maker-checker; no supervisor/qa)
-- ---------------------------------------------------------------------------

CREATE POLICY heat_no_corrections_select_plant_head_owner
  ON furnace.heat_no_corrections FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY heat_no_corrections_insert_plant_head
  ON furnace.heat_no_corrections FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['plant_head'])
    AND status = 'pending'
    AND requested_by = auth.uid()
  );

CREATE POLICY heat_no_corrections_decide_admin_owner
  ON furnace.heat_no_corrections FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['admin_owner'])
    AND status = 'pending'
  )
  WITH CHECK (furnace.has_role(ARRAY['admin_owner']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.charge_lines (Supervisor enters; others view)
-- ---------------------------------------------------------------------------

CREATE POLICY charge_lines_select_view_roles
  ON furnace.charge_lines FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

CREATE POLICY charge_lines_insert_supervisor
  ON furnace.charge_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['supervisor'])
    AND created_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- RLS: furnace.cycle_log (Supervisor enters; QA no access; permanently immutable)
-- ---------------------------------------------------------------------------

CREATE POLICY cycle_log_select_no_qa
  ON furnace.cycle_log FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'plant_head', 'admin_owner']));

CREATE POLICY cycle_log_insert_supervisor
  ON furnace.cycle_log FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['supervisor'])
    AND recorded_by = auth.uid()
  );

-- Deliberately no UPDATE or DELETE policies — immutability enforced at DB level.

-- ---------------------------------------------------------------------------
-- RLS: furnace.temp_readings (same access as cycle_log)
-- ---------------------------------------------------------------------------

CREATE POLICY temp_readings_select_no_qa
  ON furnace.temp_readings FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'plant_head', 'admin_owner']));

CREATE POLICY temp_readings_insert_supervisor
  ON furnace.temp_readings FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['supervisor'])
    AND recorded_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- RLS: furnace.spectro_reports (QA enters; Supervisor views)
-- ---------------------------------------------------------------------------

CREATE POLICY spectro_reports_select_all_roles
  ON furnace.spectro_reports FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

CREATE POLICY spectro_reports_insert_qa
  ON furnace.spectro_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['qa'])
    AND recorded_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- RLS: furnace.heat_output
-- ---------------------------------------------------------------------------

CREATE POLICY heat_output_select_all_roles
  ON furnace.heat_output FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

CREATE POLICY heat_output_insert_supervisor
  ON furnace.heat_output FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['supervisor'])
    AND recorded_by = auth.uid()
  );

CREATE POLICY heat_output_verify_qa_plant_head
  ON furnace.heat_output FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['qa', 'plant_head']))
  WITH CHECK (furnace.has_role(ARRAY['qa', 'plant_head']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.heat_output_flags (Yield Exceptions — Plant Head / Owner only)
-- ---------------------------------------------------------------------------

CREATE POLICY heat_output_flags_select_plant_head_owner
  ON furnace.heat_output_flags FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY heat_output_flags_insert_plant_head_owner
  ON furnace.heat_output_flags FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY heat_output_flags_acknowledge_plant_head_owner
  ON furnace.heat_output_flags FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']))
  WITH CHECK (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.fg_stock
-- ---------------------------------------------------------------------------

CREATE POLICY fg_stock_select_all_roles
  ON furnace.fg_stock FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

CREATE POLICY fg_stock_insert_qa_plant_head
  ON furnace.fg_stock FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['qa', 'plant_head', 'admin_owner']));

CREATE POLICY fg_stock_update_system_roles
  ON furnace.fg_stock FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['qa', 'plant_head', 'admin_owner']))
  WITH CHECK (furnace.has_role(ARRAY['qa', 'plant_head', 'admin_owner']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.bundles (Supervisor enters)
-- ---------------------------------------------------------------------------

CREATE POLICY bundles_select_all_roles
  ON furnace.bundles FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

CREATE POLICY bundles_insert_supervisor
  ON furnace.bundles FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['supervisor'])
    AND packed_by = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- RLS: furnace.dispatches (Supervisor/QA/Plant Head enter; Owner views)
-- ---------------------------------------------------------------------------

CREATE POLICY dispatches_select_all_roles
  ON furnace.dispatches FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

CREATE POLICY dispatches_insert_entry_roles
  ON furnace.dispatches FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head'])
    AND created_by = auth.uid()
  );

CREATE POLICY dispatches_update_entry_roles
  ON furnace.dispatches FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head']))
  WITH CHECK (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.dispatch_lines
-- ---------------------------------------------------------------------------

CREATE POLICY dispatch_lines_select_all_roles
  ON furnace.dispatch_lines FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

CREATE POLICY dispatch_lines_insert_entry_roles
  ON furnace.dispatch_lines FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head']));

CREATE POLICY dispatch_lines_update_entry_roles
  ON furnace.dispatch_lines FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head']))
  WITH CHECK (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head']));

CREATE POLICY dispatch_lines_delete_entry_roles
  ON furnace.dispatch_lines FOR DELETE
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.pit_heats
-- ---------------------------------------------------------------------------

CREATE POLICY pit_heats_select_all_roles
  ON furnace.pit_heats FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['supervisor', 'qa', 'plant_head', 'admin_owner']));

CREATE POLICY pit_heats_insert_supervisor
  ON furnace.pit_heats FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['supervisor'])
    AND created_by = auth.uid()
  );

CREATE POLICY pit_heats_quality_qa
  ON furnace.pit_heats FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['qa']))
  WITH CHECK (furnace.has_role(ARRAY['qa']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.approval_settings (Owner-only)
-- ---------------------------------------------------------------------------

CREATE POLICY approval_settings_select_admin_owner
  ON furnace.approval_settings FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['admin_owner']));

CREATE POLICY approval_settings_update_admin_owner
  ON furnace.approval_settings FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['admin_owner']))
  WITH CHECK (furnace.has_role(ARRAY['admin_owner']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.master_admin_change_requests (Plant Head / Owner)
-- ---------------------------------------------------------------------------

CREATE POLICY master_admin_change_requests_select_plant_head_owner
  ON furnace.master_admin_change_requests FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY master_admin_change_requests_insert_plant_head
  ON furnace.master_admin_change_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['plant_head'])
    AND requested_by = auth.uid()
  );

CREATE POLICY master_admin_change_requests_decide_admin_owner
  ON furnace.master_admin_change_requests FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['admin_owner'])
    AND status = 'pending'
  )
  WITH CHECK (furnace.has_role(ARRAY['admin_owner']));

-- ---------------------------------------------------------------------------
-- RLS: furnace.heat_costing (Plant Head / Owner only — zero rows for others)
-- ---------------------------------------------------------------------------

CREATE POLICY heat_costing_select_plant_head_owner
  ON furnace.heat_costing FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY heat_costing_insert_plant_head_owner
  ON furnace.heat_costing FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

CREATE POLICY heat_costing_update_plant_head_owner
  ON furnace.heat_costing FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']))
  WITH CHECK (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

-- ---------------------------------------------------------------------------
-- Seed: default approval_settings (Owner can loosen later)
-- ---------------------------------------------------------------------------

INSERT INTO furnace.approval_settings (action_type, requires_owner_approval, updated_by, updated_at)
SELECT v.action_type, true, u.id, now()
FROM (VALUES
  ('rate_override'),
  ('master_admin_change')
) AS v(action_type)
CROSS JOIN common.users u
WHERE u.role = 'admin_owner'
ON CONFLICT (action_type) DO NOTHING;

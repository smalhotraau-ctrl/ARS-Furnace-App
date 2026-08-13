-- Add Iron as a fourth core output field, equally weighted with Ingot/Dross/Rejection.
--
-- Corresponds to material removed during the iron_removal cycle stage — required, same as
-- Ingot/Dross/Rejection, never optional and never folded into Dross. See updated
-- 03f_Furnace_Module_Output_YieldStandards.md for the formulas.
--
-- Changes:
--   1. furnace.heat_output gets iron_kg + iron_pct columns.
--      burn_loss_kg is now: charged_net_kg − (ingot_kg + dross_kg + rejection_kg + iron_kg + exceptional_kg)
--   2. furnace.material_yield_standards.metric and furnace.heat_output_flags.metric both get
--      'iron_pct' added as a valid value alongside the existing three + burn_loss_pct.
--
-- Existing heat_output rows (recorded before Iron was tracked) get iron_kg/iron_pct = 0 via
-- the column default — historically accurate, since Iron wasn't captured separately at the
-- time. Every new insert going forward always supplies a real value (required field in the app).
--
-- Apply after: schema.sql

ALTER TABLE furnace.heat_output
  ADD COLUMN iron_kg numeric NOT NULL DEFAULT 0,
  ADD COLUMN iron_pct numeric NOT NULL DEFAULT 0;

-- Widen the metric CHECK constraints to accept 'iron_pct'. Constraint names below are the
-- default Postgres naming for an inline column CHECK (<table>_<column>_check) as originally
-- created in schema.sql.

ALTER TABLE furnace.material_yield_standards
  DROP CONSTRAINT IF EXISTS material_yield_standards_metric_check;

ALTER TABLE furnace.material_yield_standards
  ADD CONSTRAINT material_yield_standards_metric_check
  CHECK (metric IN ('ingot_pct', 'dross_pct', 'rejection_pct', 'iron_pct', 'burn_loss_pct'));

ALTER TABLE furnace.heat_output_flags
  DROP CONSTRAINT IF EXISTS heat_output_flags_metric_check;

ALTER TABLE furnace.heat_output_flags
  ADD CONSTRAINT heat_output_flags_metric_check
  CHECK (metric IN ('ingot_pct', 'dross_pct', 'rejection_pct', 'iron_pct', 'burn_loss_pct'));

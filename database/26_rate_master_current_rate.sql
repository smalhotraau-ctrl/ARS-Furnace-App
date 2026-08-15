-- Migration: Rate Master is no longer FIFO-lot based.
--
-- Real-floor feedback simplified costing to one current rate per material, versioned by
-- effective_from. A heat's material cost uses the latest effective_from <= heat close date
-- for every charged material (the lookup previously used only for flat-rate items).
--
-- App changes (costingService.ts / Rate Master UI) stop writing remaining_qty_kg and
-- stop inserting into rate_consumption_log. This migration does NOT drop those columns
-- or the log table — existing FIFO history stays. It only removes the always-on UPDATE
-- policy that existed solely so computeAndSaveHeatCosting could decrement remaining_qty_kg
-- without going through the Master Admin gate.
--
-- Does NOT touch or delete any existing data.
--
-- Safe to run multiple times: uses DROP POLICY IF EXISTS.
--
-- Apply after: 22_costing_module_rls.sql

DROP POLICY IF EXISTS rate_master_fifo_consume_update ON furnace.rate_master;

COMMENT ON COLUMN furnace.rate_master.quantity_kg IS
  'Unused as of 26. Kept for historical FIFO lots. New rates leave this NULL.';

COMMENT ON COLUMN furnace.rate_master.remaining_qty_kg IS
  'Unused as of 26. App no longer decrements this on heat costing.';

COMMENT ON TABLE furnace.rate_consumption_log IS
  'Unused as of 26. Historical FIFO draw audit only; the app no longer writes rows.';

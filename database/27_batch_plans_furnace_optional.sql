-- Migration: batch plans are no longer tied to a furnace at planning time.
--
-- Plant Head plans grade + material lines only. Supervisor picks the furnace when
-- starting the heat. Existing furnace_code values are kept; new plans insert NULL.
--
-- Does NOT drop the column or existing data.
--
-- Safe to run multiple times.
--
-- Apply after: 15_add_idempotency_keys_output_dispatch_spectro_batch.sql (batch_plans exists)

ALTER TABLE furnace.batch_plans
  ALTER COLUMN furnace_code DROP NOT NULL;

COMMENT ON COLUMN furnace.batch_plans.furnace_code IS
  'Unused for new plans as of 27. Historical plans may still have a furnace; new rows are NULL. Furnace is chosen at heat start.';

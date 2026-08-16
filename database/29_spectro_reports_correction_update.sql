-- Migration: allow QA to attach/recompute correction_suggested on saved spectro reports
--
-- correction_suggested is computed on demand after the report is saved; without an UPDATE
-- policy the value only lived in local cache until reload.
--
-- Safe to run multiple times.
--
-- Apply after: 15_add_idempotency_keys_output_dispatch_spectro_batch.sql

DROP POLICY IF EXISTS spectro_reports_update_correction_qa ON furnace.spectro_reports;

CREATE POLICY spectro_reports_update_correction_qa
  ON furnace.spectro_reports FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['qa'])
    AND recorded_by = auth.uid()
  )
  WITH CHECK (
    furnace.has_role(ARRAY['qa'])
    AND recorded_by = auth.uid()
  );

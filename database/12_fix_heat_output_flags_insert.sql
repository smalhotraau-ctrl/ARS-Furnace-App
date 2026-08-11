-- Fix: furnace.heat_output_flags INSERT policy was missing 'qa'.
--
-- Per 03f_Furnace_Module_Output_YieldStandards.md §2/§4, a heat closes and its yield flags
-- are written at verification time by WHICHEVER role verifies it — QA or Plant Head, either
-- one. The existing policy (heat_output_flags_insert_plant_head_owner, in schema.sql) only
-- allowed 'plant_head'/'admin_owner' to INSERT, which would silently block the flag write
-- whenever QA is the one who verifies and closes a heat.
--
-- This does NOT change who can *see* flags (SELECT stays plant_head/admin_owner only — the
-- Yield Exceptions panel must never be shown to QA or Supervisor) or who can acknowledge them
-- (UPDATE stays plant_head/admin_owner only). Only the INSERT check is widened to also allow
-- 'qa', since QA can be the one performing the verify-and-close action that triggers the write.
--
-- Apply after: schema.sql (or after 06_grant_schema_and_table_privileges.sql if run in order).

DROP POLICY IF EXISTS heat_output_flags_insert_plant_head_owner ON furnace.heat_output_flags;

CREATE POLICY heat_output_flags_insert_verifiers
  ON furnace.heat_output_flags FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['qa', 'plant_head', 'admin_owner']));

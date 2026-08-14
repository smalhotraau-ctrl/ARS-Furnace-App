-- Migration: narrow furnace.heats INSERT policy to Supervisor only
--
-- Context: 03b_Furnace_Roles_Permissions.md's access matrix lists Charging as "Enter" for
-- Supervisor only, with Plant Head and Owner as View-only for that module. The current
-- heats_insert_ops_roles policy (schema.sql) additionally grants INSERT to plant_head and
-- admin_owner, which is broader than the documented matrix and lets those roles start a heat
-- from the API/DB directly even though the UI never exposes that action to them.
--
-- This migration drops and recreates heats_insert_ops_roles so only supervisor can INSERT into
-- furnace.heats. SELECT (heats_select_all_roles) and UPDATE (heats_update_ops_roles,
-- heats_verify_qa_plant_head) policies are untouched — Plant Head and Owner keep full read
-- access and their existing update/verify permissions, they just can't INSERT a new heat row.
--
-- This does NOT touch or delete any existing data — it only changes who can INSERT going
-- forward.
--
-- Safe to run multiple times: uses DROP POLICY IF EXISTS before CREATE POLICY.
--
-- Apply after: 17_add_idempotency_key_pit_heats.sql

DROP POLICY IF EXISTS heats_insert_ops_roles ON furnace.heats;

CREATE POLICY heats_insert_ops_roles
  ON furnace.heats FOR INSERT
  TO authenticated
  WITH CHECK (furnace.has_role(ARRAY['supervisor']));

-- Fix: create-furnace-user Edge Function fails with
--   {"error":"permission denied for schema common"}
--
-- Root cause: the function uses a service-role Supabase client to insert into
-- common.users (and to read/update common.user_change_requests). Custom schemas
-- do not automatically get the baseline GRANTs that "public" does. Migration 06
-- granted USAGE + table DML to the authenticated role so PostgREST/RLS could
-- even run — the same grant was never issued for service_role. service_role
-- bypasses RLS, but it still needs schema USAGE and table-level privileges
-- before it can touch a row at all; without them Postgres denies the statement
-- before RLS is relevant.
--
-- This is the service_role twin of 06_grant_schema_and_table_privileges.sql.
-- furnace is included even though this specific function only touches common —
-- any future Edge Function writing furnace.* would hit the identical error.
--
-- RLS policies are unchanged and still do not apply to service_role (bypass).
-- GRANT only answers "can this role attempt the operation at all".
--
-- Safe to run multiple times: GRANT is idempotent (no error if re-applied).
--
-- Apply after: 24_user_management.sql

-- ---------------------------------------------------------------------------
-- Schema-level USAGE
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA common TO service_role;
GRANT USAGE ON SCHEMA furnace TO service_role;

-- ---------------------------------------------------------------------------
-- Table-level privileges
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA common TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA furnace TO service_role;

-- ---------------------------------------------------------------------------
-- Same grants on tables created later in these schemas
-- ---------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES IN SCHEMA common
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA furnace
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

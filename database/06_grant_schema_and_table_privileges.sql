-- Fix: 403 Forbidden on common.users and furnace.* queries
--
-- Root cause: custom Postgres schemas (common, furnace) do not automatically
-- get the baseline GRANTs that the built-in "public" schema gets. Even with
-- correct RLS policies in place, Postgres checks schema USAGE and table-level
-- privileges (SELECT/INSERT/UPDATE/DELETE) BEFORE RLS is ever evaluated. With
-- neither schema file (00_common_schema.sql, schema.sql) ever issuing a GRANT,
-- the authenticated role has no basic permission to touch these schemas at
-- all — Postgres/PostgREST returns 403 Forbidden regardless of what the RLS
-- policies say, because those policies never even get a chance to run.
--
-- This migration grants the baseline access; the RLS policies already
-- written (grade_specs, furnaces, common.users, etc.) remain the actual
-- gatekeeper for which rows are visible/writable — GRANT only controls
-- whether the role can attempt the operation at all.
--
-- Safe to run multiple times: GRANT is idempotent (no error if re-applied).
--
-- Apply after: 00_common_schema.sql, schema.sql

-- ---------------------------------------------------------------------------
-- Schema-level USAGE
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA common TO authenticated;
GRANT USAGE ON SCHEMA furnace TO authenticated;

-- ---------------------------------------------------------------------------
-- Table-level privileges (RLS policies still filter rows/columns per role)
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA common TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA furnace TO authenticated;

-- ---------------------------------------------------------------------------
-- Apply the same grants automatically to any tables created later in these
-- schemas, so future migrations don't reintroduce this same 403 gap.
-- ---------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES IN SCHEMA common
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA furnace
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- Migration: User Management — common.user_change_requests + RLS so Plant Head/Owner can
-- actually list users and Owner can soft-revoke them.
--
-- Context — 03b Pattern A (fixed, permanent, never configurable) applied to logins:
--   Plant Head proposes adding a user (username + role) or revoking an existing one via
--   common.user_change_requests. Owner approves/rejects. Nothing about common.users or
--   Supabase Auth changes until Owner acts. This is the same pattern as heat cancellation /
--   heat-number correction — it is deliberately NOT an approval_settings action_type, and
--   there is no self-approve / auto-approve path.
--
-- Creating a login needs the Auth admin API (service role), which cannot run in the browser.
-- That's supabase/functions/create-furnace-user — this migration only covers the database
-- side. Revoke is a normal RLS-governed UPDATE (active = false) and does not need the function.
--
-- common.users currently only has:
--   - users_select_own_row (05_common_users_select_policy.sql) — a user can read their own
--     profile, which is what AuthContext.loadUserProfile needs at login.
--   - users_update_own_role_dev_only (09_common_users_update_own_role.sql) — DEV ONLY, left
--     in place until the DevRoleSwitcher is removed as a separate step.
-- There is no INSERT policy and this migration does not add one: new common.users rows are
-- inserted by the Edge Function using the service role, which bypasses RLS. Plant Head/Owner
-- cannot create a login by writing to common.users directly, even if they tried.
--
-- This migration:
--   1. Creates common.user_change_requests (maker-checker request table).
--   2. Adds a SELECT policy so plant_head / admin_owner can list every common.users row
--      (needed to pick a user to revoke, and to see who already exists). supervisor / qa
--      still only see their own row, via the existing own-row policy (policies OR).
--   3. Adds a narrow UPDATE policy so admin_owner can set active = false, and nothing else
--      (username and role on that row must stay identical). Reactivation is out of scope.
--   4. RLS on user_change_requests: Plant Head inserts pending rows for themselves; Owner
--      decides pending rows; both can SELECT; supervisor/qa get zero rows.
--
-- Does NOT touch or delete any existing data.
--
-- Safe to run multiple times: uses DROP POLICY/TABLE IF EXISTS? No — CREATE TABLE IF NOT
-- EXISTS, DROP POLICY IF EXISTS before CREATE.
--
-- Apply after: 23_grade_specs_active_unique_index.sql

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS common.user_change_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action          text NOT NULL CHECK (action IN ('create', 'revoke')),
  target_id       uuid REFERENCES common.users (id),
  payload         jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by    uuid NOT NULL REFERENCES common.users (id),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  status          text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by      uuid REFERENCES common.users (id),
  decided_at      timestamptz,
  decision_note   text
);

ALTER TABLE common.user_change_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE common.user_change_requests TO authenticated;

-- ---------------------------------------------------------------------------
-- common.users — Plant Head / Owner can list everyone
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS users_select_plant_head_owner ON common.users;
CREATE POLICY users_select_plant_head_owner
  ON common.users FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

-- ---------------------------------------------------------------------------
-- common.users — Owner can revoke (active = false) and nothing else
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS users_revoke_admin_owner ON common.users;
CREATE POLICY users_revoke_admin_owner
  ON common.users FOR UPDATE
  TO authenticated
  USING (furnace.has_role(ARRAY['admin_owner']))
  WITH CHECK (
    furnace.has_role(ARRAY['admin_owner'])
    AND active = false
    AND username = (SELECT u.username FROM common.users u WHERE u.id = users.id)
    AND role = (SELECT u.role FROM common.users u WHERE u.id = users.id)
  );

-- ---------------------------------------------------------------------------
-- common.user_change_requests — Pattern A, never auto-approved
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS user_change_requests_select_plant_head_owner ON common.user_change_requests;
CREATE POLICY user_change_requests_select_plant_head_owner
  ON common.user_change_requests FOR SELECT
  TO authenticated
  USING (furnace.has_role(ARRAY['plant_head', 'admin_owner']));

DROP POLICY IF EXISTS user_change_requests_insert_plant_head ON common.user_change_requests;
CREATE POLICY user_change_requests_insert_plant_head
  ON common.user_change_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    furnace.has_role(ARRAY['plant_head'])
    AND requested_by = auth.uid()
    AND status = 'pending'
  );

DROP POLICY IF EXISTS user_change_requests_decide_admin_owner ON common.user_change_requests;
CREATE POLICY user_change_requests_decide_admin_owner
  ON common.user_change_requests FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['admin_owner'])
    AND status = 'pending'
  )
  WITH CHECK (furnace.has_role(ARRAY['admin_owner']));

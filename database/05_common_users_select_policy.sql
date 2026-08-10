-- Fix: 406 on common.users lookups during login (AuthContext.loadUserProfile)
--
-- Root cause: common.users has never had an RLS policy defined (see
-- 00_common_schema.sql — no ALTER TABLE ... ENABLE ROW LEVEL SECURITY, no
-- CREATE POLICY, at all). If RLS was subsequently turned on for this table
-- from the Supabase dashboard (e.g. via the "RLS disabled" security
-- advisor warning) without also adding a policy, Postgres denies ALL
-- access by default — the table looks empty to every request.
--
-- src/context/AuthContext.tsx's loadUserProfile() queries:
--   supabase.schema('common').from('users').select(...).eq('id', userId).maybeSingle()
-- .maybeSingle() sends an Accept: application/vnd.pgrst.object+json header
-- requesting exactly one row. With RLS blocking the row, PostgREST sees
-- zero rows and returns HTTP 406 (Not Acceptable) — the browser console
-- error the user is seeing. This is not a code bug: .maybeSingle() is used
-- correctly and does turn that specific 406/PGRST116 case into
-- { data: null, error: null } in the JS client, but the row still comes
-- back as "not found", so no profile loads, user stays null, and the app
-- shell never renders (blank page) because App.tsx now waits for a real
-- user (see AuthContext.tsx / App.tsx auto sign-in change).
--
-- Fix: enable RLS on common.users (idempotent, safe even if already
-- enabled) and add a SELECT policy allowing an authenticated user to read
-- their own row (auth.uid() = id). This is the only access pattern the app
-- actually uses — every read of common.users in the codebase looks up the
-- signed-in user's own profile by their own id, never another user's row.
--
-- Safe to run multiple times: policy is dropped before being recreated.
--
-- Apply after: 00_common_schema.sql

ALTER TABLE common.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_own_row ON common.users;

CREATE POLICY users_select_own_row
  ON common.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- No INSERT/UPDATE/DELETE policy is added here — user provisioning is a
-- manual/admin operation (seed files, Supabase dashboard), not something
-- the app itself performs against common.users.

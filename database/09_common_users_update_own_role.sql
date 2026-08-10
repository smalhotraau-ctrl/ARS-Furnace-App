-- DEV ONLY: allow a user to update their own role, for the temporary
-- "Switch Role" testing control in the top nav (src/components/ui/DevRoleSwitcher.tsx).
--
-- This directly contradicts normal production posture — role changes should
-- only ever happen via a real User Management module (Master Admin /
-- maker-checker), never self-service. This policy must be dropped once that
-- module exists and the DevRoleSwitcher control is removed from the app.
--
-- Safe to run multiple times: policy is dropped before being recreated.
--
-- Apply after: 00_common_schema.sql, 05_common_users_select_policy.sql

DROP POLICY IF EXISTS users_update_own_role_dev_only ON common.users;

CREATE POLICY users_update_own_role_dev_only
  ON common.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- TODO(remove-before-launch): drop this policy and the DevRoleSwitcher
-- component together once real User Management / role assignment exists.

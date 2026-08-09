-- Seed: common.users row for Sarthak (admin_owner)
--
-- Safe to run multiple times: conflicting id is skipped, not duplicated.
--
-- Apply after: 00_common_schema.sql

INSERT INTO common.users (id, username, role, active)
VALUES ('04b926b2-5bc9-4dd2-8863-dbc6e6ac85a6', 'sarthak', 'admin_owner', true)
ON CONFLICT (id) DO NOTHING;

-- Seed: test data for local/dev verification
--
-- Inserts:
--   - one furnace: SF-01 / Furnace 1 / main / heat_code_letter A / active
--   - grade_specs for grade_code ADC12: Si (9.6–12.0), Fe (0–1.3)
--
-- furnace.grade_specs.created_by is NOT NULL and references common.users(id).
-- We reuse the temporary bypass admin user id from src/context/AuthContext.tsx
-- (TEMP_ADMIN_USER, id 00000000-0000-0000-0000-000000000001) so the FK
-- resolves in the same environment the app's temp auth bypass is used in.
-- If that user row doesn't already exist, it is created here as 'admin_owner'
-- so it satisfies grade_specs' insert policy as well.
--
-- Safe to run multiple times: conflicting rows are skipped, not duplicated.
--
-- Apply after: 00_common_schema.sql, schema.sql, 01_open_reference_data_select.sql

INSERT INTO common.users (id, username, role, active)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin', 'admin_owner', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO furnace.furnaces (code, name, type, heat_code_letter, active)
VALUES ('SF-01', 'Furnace 1', 'main', 'A', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO furnace.grade_specs (grade_code, element, min_pct, max_pct, active, created_by)
VALUES
  ('ADC12', 'Si', 9.6, 12.0, true, '00000000-0000-0000-0000-000000000001'),
  ('ADC12', 'Fe', 0,   1.3,  true, '00000000-0000-0000-0000-000000000001')
ON CONFLICT (grade_code, element) DO NOTHING;

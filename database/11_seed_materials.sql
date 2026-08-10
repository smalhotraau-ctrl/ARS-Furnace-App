-- Seed: test rows for furnace.materials
--
-- created_by references common.users(id) — using Sarthak's seeded id
-- (see database/04_seed_sarthak_user.sql).
--
-- Safe to run multiple times: conflicting code is skipped, not duplicated.
--
-- Apply after: 10_add_materials_master.sql

INSERT INTO furnace.materials (code, name, active, created_by)
VALUES
  ('ALIN', 'Aluminium Ingot', true, '04b926b2-5bc9-4dd2-8863-dbc6e6ac85a6'),
  ('SCRAP', 'Scrap Aluminium', true, '04b926b2-5bc9-4dd2-8863-dbc6e6ac85a6'),
  ('SI', 'Silicon', true, '04b926b2-5bc9-4dd2-8863-dbc6e6ac85a6')
ON CONFLICT (code) DO NOTHING;

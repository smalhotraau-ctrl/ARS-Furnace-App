-- Migration: make furnace.charge_lines.bin_bay/gross_kg/tare_kg nullable
--
-- Context: 03d_Furnace_Module_HeatCharging_Cycle.md §4 documents that real floor usage is a
-- single net weight per material pickup — material_code + net_kg is the only required entry.
-- bin_bay, gross_kg, and tare_kg are optional context a Supervisor may or may not have on hand,
-- not mandatory fields. schema.sql currently declares all three NOT NULL, which contradicts this
-- and is why ChargeLineForm.tsx previously had to force gross/tare entry just to compute a net
-- weight, blocking real charge-line saves whenever a Supervisor only had the net weight.
--
-- The client-side fix (src/components/heat/ChargeLineForm.tsx, src/types/heat.ts) now:
--   - Only requires material_code and net_kg to save a charge line.
--   - Treats bin_bay as optional free text, and gross_kg/tare_kg as optional — if both are
--     provided, net_kg is auto-computed from them (same as before); if not, net_kg is entered
--     directly.
--
-- This migration relaxes the matching server-side constraints so a payload with
-- bin_bay/gross_kg/tare_kg = NULL isn't rejected by the database once the client sends one.
--
-- This does NOT touch or delete any existing data — every existing row already has non-NULL
-- values for these columns and is unaffected; this only changes what's required going forward.
--
-- Safe to run multiple times: DROP NOT NULL is a no-op if the column is already nullable.
--
-- Apply after: 18_narrow_heats_insert_policy_to_supervisor.sql

ALTER TABLE furnace.charge_lines
  ALTER COLUMN bin_bay DROP NOT NULL;

ALTER TABLE furnace.charge_lines
  ALTER COLUMN gross_kg DROP NOT NULL;

ALTER TABLE furnace.charge_lines
  ALTER COLUMN tare_kg DROP NOT NULL;

-- net_kg stays NOT NULL — it is still the one required weight figure for a charge line.

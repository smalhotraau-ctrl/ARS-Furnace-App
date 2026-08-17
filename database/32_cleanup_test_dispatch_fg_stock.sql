-- Cleanup test / duplicate dispatch rows that drove AH26-01 fg_stock negative.
--
-- Context: duplicate Sandhar dispatch (offline-sync retry, same shape as migration 16) plus an
-- ABC · 0101 test dispatch. All current data is test — delete explicitly by id.
--
-- Removes:
--   1. Duplicate Sandhar dispatch e4a9a126-bae8-4ee0-8a3e-96424a97db70 (2026-08-15, 5,000 kg
--      for AH26-01). Keeps original f10061ae-3f90-4057-b2cc-8d20df7df038 (2026-08-13).
--   2. Entire ABC test dispatch 1a3273bc-5a4e-44cd-9614-e1ebe69903b1 (AH26-01 2,000 kg +
--      BH26-01 6,000 kg).
--
-- fg_stock.kg_available is restored by trg_decrement_fg_stock_on_dispatch on DELETE — do NOT
-- manually UPDATE fg_stock.
--
-- Expected after (verified against heat_output.ingot_kg):
--   AH26-01 fe459e55-afb6-4681-93a7-69ff09ffb56c: 500 kg  (5,500 − 5,000)
--   BH26-01 5e242307-b567-4d11-95c9-97cd6ad8f413: 7,200 kg (7,200 − 0; ABC line removed)
--
-- Apply after: 31_cycle_stage_time_standards.sql
-- Safe to re-run: DELETE … WHERE id IN (…) is a no-op once rows are gone.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. dispatch_lines first (FK: dispatch_lines.dispatch_id → dispatches.id)
-- ---------------------------------------------------------------------------

DELETE FROM furnace.dispatch_lines
WHERE dispatch_id IN (
  'e4a9a126-bae8-4ee0-8a3e-96424a97db70'::uuid,  -- duplicate Sandhar
  '1a3273bc-5a4e-44cd-9614-e1ebe69903b1'::uuid   -- ABC test dispatch
);

-- ---------------------------------------------------------------------------
-- 2. dispatch headers
-- ---------------------------------------------------------------------------

DELETE FROM furnace.dispatches
WHERE id IN (
  'e4a9a126-bae8-4ee0-8a3e-96424a97db70'::uuid,
  '1a3273bc-5a4e-44cd-9614-e1ebe69903b1'::uuid
);

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification (read-only) — run after COMMIT:
-- ---------------------------------------------------------------------------
--
-- SELECT
--   h.heat_no,
--   fs.kg_available,
--   ho.ingot_kg,
--   COALESCE(SUM(dl.kg_dispatched), 0) AS total_dispatched
-- FROM furnace.fg_stock fs
-- JOIN furnace.heats h ON h.id = fs.heat_id
-- LEFT JOIN furnace.heat_output ho ON ho.heat_id = fs.heat_id
-- LEFT JOIN furnace.dispatch_lines dl ON dl.heat_id = fs.heat_id
-- WHERE h.heat_no IN ('AH26-01', 'BH26-01')
-- GROUP BY h.heat_no, fs.kg_available, ho.ingot_kg
-- ORDER BY h.heat_no;
--
-- Expected:
--   AH26-01 | 500  | 5500 | 5000
--   BH26-01 | 7200 | 7200 | 0

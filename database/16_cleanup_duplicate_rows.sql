-- Cleanup: leftover duplicate rows created by the (now-fixed) offline-sync bug
--
-- Context: same root cause as 14_add_idempotency_keys_offline_queue.sql /
-- 15_add_idempotency_keys_output_dispatch_spectro_batch.sql, and the same "keep oldest, delete
-- extras" cleanup approach already used for furnace.heat_cancel_requests. Before the queueId +
-- idempotency_key fix shipped, a retried queue action could re-submit the exact same insert as a
-- brand-new row. Confirmed via the read-only diagnostics that three tables have leftover
-- duplicates from that window:
--
--   - furnace.bundles:         6 rows for heat_id fe459e55-afb6-4681-93a7-69ff09ffb56c,
--                               bundle_no 19 (should be 1)
--   - furnace.dispatches:      6 rows for invoice_no 1, party_name Sandhar,
--                               dispatch_date 2026-08-13 (should be 1)
--   - furnace.spectro_reports: 2 rows for heat_id fe459e55-afb6-4681-93a7-69ff09ffb56c,
--                               report_type process, sample_time 2026-08-10 13:05:00 (should be 1)
--
-- Approach: for each table, partition rows by the same natural key used in the diagnostic
-- SELECTs and rank them oldest-first by their own creation timestamp (packed_at / created_at /
-- recorded_at, with id as a stable tiebreaker for two rows with an identical timestamp). Only
-- rows ranked 2nd-or-later within a group — i.e. rows that are not the oldest in a group that
-- has more than one row — are deleted. This is written generically by natural key rather than by
-- hardcoded row id, so it also covers any other duplicate group of the same shape that the
-- diagnostics above didn't call out by name, but it can never touch a row that isn't part of an
-- actual duplicate group: a group with exactly one row ranks that row #1 and nothing is deleted
-- for it.
--
-- Foreign key check performed before writing this (grep of schema.sql):
--   - furnace.dispatch_lines.dispatch_id REFERENCES furnace.dispatches (id) — the only foreign
--     key anywhere in schema.sql pointing at any of these three tables. Each duplicate
--     `saveDispatch()` retry queued and synced its own header + lines together, so a duplicate
--     dispatch header row may have its own dispatch_lines rows attached. This script deletes
--     those child dispatch_lines rows first — scoped only to the specific duplicate dispatch
--     header ids being removed (never the id being kept) — before deleting the duplicate
--     dispatch header rows, so nothing violates the foreign key or gets orphaned.
--   - No table in schema.sql references furnace.bundles or furnace.spectro_reports by foreign
--     key, so those two are deleted directly with no child-row step needed.
--
-- This does NOT touch furnace.heat_output, furnace.heat_output_flags, furnace.fg_stock, or
-- furnace.batch_plans — the diagnostics for those did not report any duplicate rows. Re-run
-- their diagnostic SELECTs first if that changes.
--
-- Safe to run multiple times: once duplicates are gone, every ranking CTE below returns rank-1
-- rows only and every DELETE affects zero rows.
--
-- Apply after: 15_add_idempotency_keys_output_dispatch_spectro_batch.sql
-- NOT executed as part of writing this file — review the diagnostic SELECT counts first.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. furnace.dispatches + furnace.dispatch_lines — child rows before header rows
-- ---------------------------------------------------------------------------

-- Step 1a: delete dispatch_lines belonging to a duplicate (non-oldest) dispatch header.
WITH ranked_dispatches AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY invoice_no, party_name, dispatch_date
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM furnace.dispatches
),
duplicate_dispatch_ids AS (
  SELECT id FROM ranked_dispatches WHERE rn > 1
)
DELETE FROM furnace.dispatch_lines
WHERE dispatch_id IN (SELECT id FROM duplicate_dispatch_ids);

-- Step 1b: now delete the duplicate dispatch header rows themselves. Recomputed fresh — step 1a
-- only touched dispatch_lines, so this ranking is identical to the one used above.
WITH ranked_dispatches AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY invoice_no, party_name, dispatch_date
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM furnace.dispatches
)
DELETE FROM furnace.dispatches
WHERE id IN (SELECT id FROM ranked_dispatches WHERE rn > 1);

-- ---------------------------------------------------------------------------
-- 2. furnace.bundles — nothing else references bundles by foreign key
-- ---------------------------------------------------------------------------

WITH ranked_bundles AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY heat_id, bundle_no
      ORDER BY packed_at ASC, id ASC
    ) AS rn
  FROM furnace.bundles
)
DELETE FROM furnace.bundles
WHERE id IN (SELECT id FROM ranked_bundles WHERE rn > 1);

-- ---------------------------------------------------------------------------
-- 3. furnace.spectro_reports — nothing else references spectro_reports by foreign key
-- ---------------------------------------------------------------------------

WITH ranked_spectro AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY heat_id, report_type, sample_time
      ORDER BY recorded_at ASC, id ASC
    ) AS rn
  FROM furnace.spectro_reports
)
DELETE FROM furnace.spectro_reports
WHERE id IN (SELECT id FROM ranked_spectro WHERE rn > 1);

COMMIT;

-- ---------------------------------------------------------------------------
-- Verification (read-only) — run after the deletes above. All three should return zero rows:
-- ---------------------------------------------------------------------------
--
-- select heat_id, bundle_no, count(*) from furnace.bundles
--   group by heat_id, bundle_no having count(*) > 1;
--
-- select invoice_no, party_name, dispatch_date, count(*) from furnace.dispatches
--   group by invoice_no, party_name, dispatch_date having count(*) > 1;
--
-- select heat_id, report_type, sample_time, count(*) from furnace.spectro_reports
--   group by heat_id, report_type, sample_time having count(*) > 1;

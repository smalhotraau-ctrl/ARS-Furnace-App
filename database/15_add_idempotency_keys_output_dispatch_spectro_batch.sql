-- Migration: idempotency keys for the output, dispatch, spectro, and batch-plan offline queues
--
-- Context / root cause: same pattern documented in
-- 14_add_idempotency_keys_offline_queue.sql (see that file, and
-- src/lib/heatOfflineStore.ts / src/lib/heatService.ts, for the full writeup).
--
-- outputService.ts's syncOutputQueue() and dispatchService.ts's syncDispatchQueue() removed a
-- processed action with `getQueue().filter((a) => a !== action)` — comparing object REFERENCES
-- after a fresh JSON.parse() of localStorage always allocates new objects, so this filter never
-- actually removed anything. Every heat_output / heat_output_flags / fg_stock / bundles /
-- dispatches / dispatch_lines insert ever queued stayed in the queue forever and was re-sent on
-- every subsequent sync trigger.
--
-- spectroOfflineStore.ts and batchPlanOfflineStore.ts did NOT have this specific bug — both
-- already removed queue entries by a stable value (localId / planId), not by reference — but
-- they had no protection against two concurrent flushes of the same queue (a page's 'online'
-- listener firing at the same time as DevRoleSwitcher's pre-switch flush, for example) each
-- reading their own snapshot and submitting the same still-queued insert twice before either
-- flush removed it.
--
-- The client-side fix (src/lib/offlineQueueSync.ts, and the four queues' offline-store /
-- service files) now:
--   1. Removes actions by a stable client-generated `queueId` instead of by reference
--      (output_queue, dispatch_queue — the ones with the actual removal bug).
--   2. Bakes a client-generated `idempotency_key` into every insert-type action's payload at
--      creation time (all four queues).
--   3. Uses `.upsert(payload, { onConflict: 'idempotency_key', ignoreDuplicates: true })` for
--      every insert-type sync call, so a retried action can never create a second row.
--   4. Runs each queue's flush behind a shared in-flight lock, so no two callers can flush the
--      same queue concurrently.
--   5. Self-heals any pre-existing queue entries in a user's browser that predate
--      queueId/idempotency_key, backfilling them on next read instead of dropping them.
--
-- This migration adds the server-side safety net matching that upsert-on-conflict call: every
-- insert-type payload the client sends now carries a client-generated `idempotency_key`, and
-- the column has a UNIQUE constraint so Postgres itself guarantees the row can never be
-- duplicated even if a client-side race somehow still gets through.
--
-- This does NOT touch or delete any existing data. Existing rows get idempotency_key = NULL,
-- which is fine — a UNIQUE constraint in Postgres permits any number of NULLs, it only rejects
-- a second row with the same non-NULL value.
--
-- Safe to run multiple times: each ALTER uses IF NOT EXISTS / conflict-safe constraint naming.
--
-- Apply after: 14_add_idempotency_keys_offline_queue.sql

-- heat_output — inserted by outputService.ts's syncOutputQueue() (action.kind === 'output_insert')
ALTER TABLE furnace.heat_output
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.heat_output
  DROP CONSTRAINT IF EXISTS heat_output_idempotency_key_key;

ALTER TABLE furnace.heat_output
  ADD CONSTRAINT heat_output_idempotency_key_key UNIQUE (idempotency_key);

-- heat_output_flags — inserted by outputService.ts's syncOutputQueue() (action.kind === 'flag_insert')
ALTER TABLE furnace.heat_output_flags
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.heat_output_flags
  DROP CONSTRAINT IF EXISTS heat_output_flags_idempotency_key_key;

ALTER TABLE furnace.heat_output_flags
  ADD CONSTRAINT heat_output_flags_idempotency_key_key UNIQUE (idempotency_key);

-- fg_stock — inserted from the same output queue when a heat is verified/closed
-- (action.kind === 'fg_stock_insert' in outputService.ts's verifyAndCloseHeatOutput()/
-- syncOutputQueue()). dispatchService.ts only ever UPDATEs fg_stock via the
-- decrement_fg_stock_on_dispatch trigger, it never inserts into it directly.
ALTER TABLE furnace.fg_stock
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.fg_stock
  DROP CONSTRAINT IF EXISTS fg_stock_idempotency_key_key;

ALTER TABLE furnace.fg_stock
  ADD CONSTRAINT fg_stock_idempotency_key_key UNIQUE (idempotency_key);

-- bundles — inserted by dispatchService.ts's syncDispatchQueue() (action.kind === 'bundle_insert')
ALTER TABLE furnace.bundles
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.bundles
  DROP CONSTRAINT IF EXISTS bundles_idempotency_key_key;

ALTER TABLE furnace.bundles
  ADD CONSTRAINT bundles_idempotency_key_key UNIQUE (idempotency_key);

-- dispatches — inserted by dispatchService.ts's syncDispatchQueue() (action.kind === 'dispatch_insert', header row)
ALTER TABLE furnace.dispatches
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.dispatches
  DROP CONSTRAINT IF EXISTS dispatches_idempotency_key_key;

ALTER TABLE furnace.dispatches
  ADD CONSTRAINT dispatches_idempotency_key_key UNIQUE (idempotency_key);

-- dispatch_lines — inserted alongside the dispatches header in the same
-- syncDispatchQueue() 'dispatch_insert' action; each line in the array gets its own
-- idempotency_key so a partial retry (header succeeded, lines failed) can't duplicate lines
-- that already made it in.
ALTER TABLE furnace.dispatch_lines
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.dispatch_lines
  DROP CONSTRAINT IF EXISTS dispatch_lines_idempotency_key_key;

ALTER TABLE furnace.dispatch_lines
  ADD CONSTRAINT dispatch_lines_idempotency_key_key UNIQUE (idempotency_key);

-- spectro_reports — inserted by spectroService.ts's syncSpectroQueue() (action.kind === 'insert')
ALTER TABLE furnace.spectro_reports
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.spectro_reports
  DROP CONSTRAINT IF EXISTS spectro_reports_idempotency_key_key;

ALTER TABLE furnace.spectro_reports
  ADD CONSTRAINT spectro_reports_idempotency_key_key UNIQUE (idempotency_key);

-- batch_plans — inserted by batchPlanService.ts's syncBatchPendingActions() (action.kind === 'insert')
ALTER TABLE furnace.batch_plans
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.batch_plans
  DROP CONSTRAINT IF EXISTS batch_plans_idempotency_key_key;

ALTER TABLE furnace.batch_plans
  ADD CONSTRAINT batch_plans_idempotency_key_key UNIQUE (idempotency_key);

-- No RLS changes needed: idempotency_key is just another column on tables whose INSERT/SELECT/
-- UPDATE policies already exist (schema.sql) and already permit the same roles to read back what
-- they just wrote (needed for the client's post-conflict SELECT ... WHERE idempotency_key = ...
-- reconciliation lookup — see insertIdempotent()/insertManyIdempotent() in
-- src/lib/offlineQueueSync.ts).

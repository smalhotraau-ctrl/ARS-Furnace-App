-- Migration: idempotency keys for every insert-type action in furnace:heat_queue
--
-- Context / root cause (see src/lib/heatOfflineStore.ts, src/lib/heatService.ts):
--
-- The local offline queue (localStorage key `furnace:heat_queue`) removed a processed action
-- with `getHeatQueue().filter((a) => a !== action)` — comparing object REFERENCES. But
-- getHeatQueue() does a fresh JSON.parse() of localStorage on every call, which always
-- allocates brand-new object instances. No parsed object is ever `===` to any other, so this
-- filter never actually removed anything. Every action ever queued (heat inserts, charge
-- lines, cycle log entries, temp readings, cancel requests, heat-number corrections) stayed in
-- the queue forever and was re-sent on every subsequent sync trigger (page load, every other
-- add/submit call's own fire-and-forget sync, the 'online' listener, a role switch, etc.) —
-- observed as furnace:heat_queue growing to 64+ entries and the same cancel-request reason
-- appearing many times as separate rows in furnace.heat_cancel_requests.
--
-- The client-side fix (already shipped in src/lib/heatOfflineStore.ts /
-- src/lib/heatService.ts) now removes actions by a stable client-generated `queueId` instead of
-- by reference, and only one flush of the queue can run at a time. This migration adds the
-- server-side safety net for whatever local race still gets through (a flush that reports
-- ambiguous failure and is correctly retried, two tabs/devices open at once, etc.): every
-- insert-type payload the client sends now carries a client-generated `idempotency_key`, and
-- the insert uses `ON CONFLICT (idempotency_key) DO NOTHING`, so retrying the exact same queued
-- action can never create a second row.
--
-- This does NOT touch or delete any existing data. Existing rows get idempotency_key = NULL,
-- which is fine — a UNIQUE constraint in Postgres permits any number of NULLs, it only rejects
-- a second row with the same non-NULL value.
--
-- Safe to run multiple times: each ALTER uses IF NOT EXISTS / conflict-safe constraint naming.
--
-- Apply after: schema.sql

ALTER TABLE furnace.heats
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.heats
  DROP CONSTRAINT IF EXISTS heats_idempotency_key_key;

ALTER TABLE furnace.heats
  ADD CONSTRAINT heats_idempotency_key_key UNIQUE (idempotency_key);

ALTER TABLE furnace.charge_lines
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.charge_lines
  DROP CONSTRAINT IF EXISTS charge_lines_idempotency_key_key;

ALTER TABLE furnace.charge_lines
  ADD CONSTRAINT charge_lines_idempotency_key_key UNIQUE (idempotency_key);

ALTER TABLE furnace.cycle_log
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.cycle_log
  DROP CONSTRAINT IF EXISTS cycle_log_idempotency_key_key;

ALTER TABLE furnace.cycle_log
  ADD CONSTRAINT cycle_log_idempotency_key_key UNIQUE (idempotency_key);

ALTER TABLE furnace.temp_readings
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.temp_readings
  DROP CONSTRAINT IF EXISTS temp_readings_idempotency_key_key;

ALTER TABLE furnace.temp_readings
  ADD CONSTRAINT temp_readings_idempotency_key_key UNIQUE (idempotency_key);

ALTER TABLE furnace.heat_cancel_requests
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.heat_cancel_requests
  DROP CONSTRAINT IF EXISTS heat_cancel_requests_idempotency_key_key;

ALTER TABLE furnace.heat_cancel_requests
  ADD CONSTRAINT heat_cancel_requests_idempotency_key_key UNIQUE (idempotency_key);

ALTER TABLE furnace.heat_no_corrections
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.heat_no_corrections
  DROP CONSTRAINT IF EXISTS heat_no_corrections_idempotency_key_key;

ALTER TABLE furnace.heat_no_corrections
  ADD CONSTRAINT heat_no_corrections_idempotency_key_key UNIQUE (idempotency_key);

-- No RLS changes needed: idempotency_key is just another column on tables whose INSERT/SELECT/
-- UPDATE policies already exist (schema.sql) and already permit the same roles to read back
-- what they just wrote (needed for the client's post-conflict SELECT ... WHERE idempotency_key
-- = ... reconciliation lookup — see insertIdempotent() in src/lib/heatService.ts).

-- UPDATE: furnace.heat_output, furnace.heat_output_flags, furnace.fg_stock, furnace.bundles,
-- furnace.dispatches, furnace.dispatch_lines, furnace.spectro_reports, and furnace.batch_plans
-- are synced through separate offline queues (outputOfflineStore/-service.ts,
-- dispatchOfflineStore/-service.ts, spectroOfflineStore/-service.ts,
-- batchPlanOfflineStore/-service.ts). outputService.ts's syncOutputQueue() and
-- dispatchService.ts's syncDispatchQueue() had the identical broken `a !== action`
-- reference-equality removal as heatService.ts did; spectroOfflineStore.ts and
-- batchPlanOfflineStore.ts already removed queue entries correctly (by localId/planId, not by
-- reference) but still lacked idempotency_key + concurrency protection. All four queues now get
-- the same queueId + idempotency_key + in-flight-lock treatment — see
-- 15_add_idempotency_keys_output_dispatch_spectro_batch.sql.

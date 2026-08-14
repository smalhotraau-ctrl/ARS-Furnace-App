-- Migration: idempotency key for the Pit Furnace offline queue
--
-- Context / root cause: same pattern documented in
-- 14_add_idempotency_keys_offline_queue.sql and
-- 15_add_idempotency_keys_output_dispatch_spectro_batch.sql (see those files, and
-- src/lib/heatOfflineStore.ts / src/lib/heatService.ts, for the full writeup).
--
-- src/lib/offlineStore.ts's removePendingByLocalId() already removed queue entries by a stable
-- value (localId), not by object reference, so this queue never had the reference-equality bug
-- the heat/output/dispatch queues had. It was, however, still doing a plain
-- `.insert(action.payload)` with no idempotency protection — a concurrent double-flush (a page's
-- 'online' listener firing at the same time as another trigger, two tabs open at once, etc.)
-- could still submit the same pit-heat insert twice before either flush removed it from the
-- local queue.
--
-- The client-side fix (src/lib/pitFurnaceService.ts, src/lib/offlineStore.ts) now:
--   1. Bakes a client-generated `idempotency_key` into every pit-heat insert action's payload at
--      creation time (src/lib/pitFurnaceService.ts's saveProductionEntry()).
--   2. Uses the shared insertIdempotent() helper from src/lib/offlineQueueSync.ts —
--      `.upsert(payload, { onConflict: 'idempotency_key', ignoreDuplicates: true })` — so a
--      retried insert can never create a second row.
--   3. Runs syncPendingActions() behind the shared in-flight lock (createInFlightLock()), so no
--      two callers can flush this queue concurrently.
--   4. Self-heals any pre-existing queue entries in a user's browser that predate
--      idempotency_key, backfilling them on next read instead of dropping them.
--
-- This migration adds the server-side safety net matching that upsert-on-conflict call: every
-- insert-type payload the client sends now carries a client-generated `idempotency_key`, and the
-- column has a UNIQUE constraint so Postgres itself guarantees the row can never be duplicated
-- even if a client-side race somehow still gets through.
--
-- This does NOT touch or delete any existing data. Existing rows get idempotency_key = NULL,
-- which is fine — a UNIQUE constraint in Postgres permits any number of NULLs, it only rejects a
-- second row with the same non-NULL value.
--
-- Safe to run multiple times: each ALTER uses IF NOT EXISTS / conflict-safe constraint naming.
--
-- Apply after: 15_add_idempotency_keys_output_dispatch_spectro_batch.sql

-- pit_heats — inserted by pitFurnaceService.ts's syncPendingActions() (action.kind === 'insert')
ALTER TABLE furnace.pit_heats
  ADD COLUMN IF NOT EXISTS idempotency_key uuid;

ALTER TABLE furnace.pit_heats
  DROP CONSTRAINT IF EXISTS pit_heats_idempotency_key_key;

ALTER TABLE furnace.pit_heats
  ADD CONSTRAINT pit_heats_idempotency_key_key UNIQUE (idempotency_key);

-- No RLS changes needed: idempotency_key is just another column on a table whose INSERT/SELECT
-- policies already exist (schema.sql) and already permit the same roles to read back what they
-- just wrote (needed for the client's post-conflict SELECT ... WHERE idempotency_key = ...
-- reconciliation lookup — see insertIdempotent() in src/lib/offlineQueueSync.ts).

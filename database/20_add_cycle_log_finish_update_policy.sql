-- Migration: allow the one-time Start -> Finish transition on furnace.cycle_log
--
-- Context: furnace.cycle_log was deliberately given no UPDATE policy at all (see the
-- "Deliberately no UPDATE or DELETE policies" comment in schema.sql) to enforce immutability.
-- That's stricter than intended: finishCycleStage (src/lib/heatService.ts) needs to UPDATE the
-- existing row to set finish_ts once a stage is finished, so with zero UPDATE policies, every
-- Finish tap has been silently blocked by RLS since this table existed — independent of, and in
-- addition to, the id-tracking bugs fixed earlier tonight in heatService.ts.
--
-- This adds a narrow, self-limiting UPDATE policy instead of removing immutability altogether:
--   - Only supervisor (same furnace.has_role(...) pattern as cycle_log_insert_supervisor).
--   - USING requires finish_ts IS NULL on the existing row — only a not-yet-finished stage can
--     ever be the target of an UPDATE in the first place.
--   - WITH CHECK requires the resulting row has finish_ts IS NOT NULL and the same start_ts as
--     before the update (compared via a self-join by id, since WITH CHECK only sees the new row
--     directly).
--
-- Once finish_ts is set, USING (finish_ts IS NULL) can never match that row again, so no future
-- UPDATE attempt — by anyone, for any reason — can ever be applied to it. That's a strictly
-- stronger guarantee of "no corrections, ever" than blocking all updates did, since blocking all
-- updates also blocked the one legitimate transition.
--
-- Does NOT touch or delete any existing data. DELETE remains fully blocked (no DELETE policy,
-- unchanged).
--
-- IMPORTANT: this policy was not (and could not be) verified by the in-memory fake-Postgres test
-- harness used earlier tonight to trace the Start/Finish id-tracking bugs — that harness doesn't
-- enforce RLS at all. It must be verified against the live database (e.g. a real Start -> Finish
-- tap as supervisor, confirmed to persist after reload) before being treated as fixed.
--
-- Safe to run multiple times: uses DROP POLICY IF EXISTS before CREATE POLICY.
--
-- Apply after: 19_make_charge_lines_bin_bay_gross_tare_optional.sql

DROP POLICY IF EXISTS cycle_log_finish_update_supervisor ON furnace.cycle_log;

CREATE POLICY cycle_log_finish_update_supervisor
  ON furnace.cycle_log FOR UPDATE
  TO authenticated
  USING (
    furnace.has_role(ARRAY['supervisor'])
    AND finish_ts IS NULL
  )
  WITH CHECK (
    finish_ts IS NOT NULL
    AND start_ts = (SELECT c.start_ts FROM furnace.cycle_log c WHERE c.id = cycle_log.id)
  );

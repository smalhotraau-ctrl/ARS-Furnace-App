-- Migration: allow a grade_code to be reused across versions in furnace.grade_specs
--
-- Bug: schema.sql's UNIQUE (grade_code, element) constraint on furnace.grade_specs is enforced
-- across ALL rows, active or not. Grade codes are customer-facing names meant to be reused
-- across re-specs (03i §5 grade_specs immutability rule: "a customer re-spec always creates a
-- brand new grade_code" is the *documented* rule, but in practice a re-spec commonly keeps the
-- same customer-facing grade_code, e.g. re-specing "ADC12" again — only superseded_by/active
-- distinguish the versions). Approving a re-spec for a grade_code that already has a (now
-- superseded) history under that same grade_code+element hits this constraint and fails with
-- 23505, even though only one row per grade_code+element should ever be *active* at a time —
-- old superseded rows and the one current active row are meant to coexist.
--
-- Fix: drop the table-wide UNIQUE constraint and replace it with a partial unique index that
-- only applies to active rows. Historical superseded rows with the same grade_code+element can
-- now coexist with the one current active version; two active rows for the same
-- grade_code+element remains impossible (the actual invariant that matters), enforced by the
-- database itself, not just by application-level ordering in masterAdminService.ts.
--
-- Does NOT touch or delete any existing data — this only changes which combination of columns
-- the uniqueness check applies to; every existing row keeps its current grade_code, element,
-- and active value untouched.
--
-- Safe to run multiple times: uses DROP CONSTRAINT/INDEX IF EXISTS before creating the new index.
--
-- Apply after: 22_costing_module_rls.sql

ALTER TABLE furnace.grade_specs
  DROP CONSTRAINT IF EXISTS grade_specs_grade_code_element_key;

DROP INDEX IF EXISTS furnace.grade_specs_active_grade_code_element_key;

CREATE UNIQUE INDEX grade_specs_active_grade_code_element_key
  ON furnace.grade_specs (grade_code, element)
  WHERE active = true;

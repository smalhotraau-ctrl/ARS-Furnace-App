-- Migration: remove investigation test charge_lines (not real floor data)
--
-- Two SCRAP/SCRAP2 rows were inserted on heat AH26-04 during a 409-debug session.
-- charge_lines has no DELETE RLS policy, so this must be run in the Supabase SQL Editor.
--
-- Safe to run multiple times.
--
-- Apply after: 19_make_charge_lines_bin_bay_gross_tare_optional.sql

DELETE FROM furnace.charge_lines
WHERE heat_id = (
  SELECT id FROM furnace.heats WHERE heat_no = 'AH26-04' LIMIT 1
)
AND material_code IN ('SCRAP', 'SCRAP2');

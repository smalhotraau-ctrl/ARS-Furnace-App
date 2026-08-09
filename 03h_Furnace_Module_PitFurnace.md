# Module — Pit Furnace
### Screen 9 · Table: `furnace.pit_heats` · View: `furnace.pit_balance`

> Build from this file + `03a_Furnace_DataModel.md` + `03b_Furnace_Roles_Permissions.md`.
> This module is fully isolated from the rest of the app — good candidate to build and test
> first, since it doesn't depend on any other module's tables (see `03l` build guide).

## Purpose

A standalone, simple form for the pit furnace — deliberately not wired into RM stock or main
FG stock in v1.

## Who does what

- **Supervisor** — production entries: date, heat no, weight_kg, ingot_kg, dross_kg,
  pit_iron_kg, wood_fuel_kg, sale_kg.
- **QA** — quality check: enters the 6-element composition (Si/Fe/Cu/Mn/Mg/Zn) as a
  **record only**. No tolerance bands exist for pit furnace output, so there is no pass/fail
  flag here — unlike the main furnace's spectro flags. This is a deliberate simplification,
  confirmed with the product owner, not a gap.
- **Plant Head / Owner** — view only.

## heat_no

Pit furnace keeps its own separate sequence, independent of the main-furnace `AH26-10`-style
code (there's only one pit furnace, so no furnace-letter component applies). Flagging as an
assumption: confirm the exact format needed to match the existing paper PT-01 sheet before
building the sequence-generation logic — nothing more specific than "own sequence" has been
defined yet.

## balance_kg — do not build as a stored/editable field

This is the one place in the original design that had a real offline-safety problem, now
fixed structurally: **`pit_heats` has no `balance_kg` column.** Instead:

```
furnace.pit_balance (view)
balance_kg as of date X = SUM(pit_heats.ingot_kg WHERE date <= X)
                           − SUM(pit_heats.sale_kg WHERE date <= X)
```

Devices only ever insert new immutable `pit_heats` rows, offline or online — never edit a
shared running total — so there is nothing for two tablets to collide over. If the UI needs
an instant-feeling number, cache the computed value and refresh it via trigger on insert, but
the source of truth is always the summed transaction history, never a hand-typed counter.

## Independence rules (unchanged from v1 intent)

- No RM stock deduction.
- No linkage to `furnace.fg_stock`.
- No batch plan, no cycle log, no costing.
- If pit furnace integration into shared RM/FG stock is ever needed, that's a deliberate v2+
  decision, not something to build toward now.

## Acceptance criteria

- [ ] Standalone form, Supervisor enters production figures, QA enters composition as a
      record with no pass/fail flag.
- [ ] `balance_kg` is never a stored, hand-edited field — always computed from summed history.
- [ ] Own heat_no sequence, separate from the main furnace's code format.
- [ ] Zero linkage to RM stock or main `furnace.fg_stock`.

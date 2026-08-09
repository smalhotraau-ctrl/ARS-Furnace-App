# Module — Spectro
### Screen 5 · Table: `furnace.spectro_reports`

> Build from this file + `03a_Furnace_DataModel.md` + `03b_Furnace_Roles_Permissions.md`.

## Purpose

QA records process and final spectrometer composition readings against a heat, flagged
against the heat's grade spec, with an optional on-demand correction suggestion.

## Who does what

- **QA** — sole entry role. Enters `report_type` (process | final), `composition`
  (element/actual_pct/spec_min/spec_max/flag per element), `sample_time`.
- **Supervisor, Plant Head, Owner** — view only.

## Behavior

- Composition entry is manual, numeric-only per element (see `03k_Furnace_UX_Guidelines.md`)
  — this app has no spectrometer hardware integration in v1; QA is retyping from a printed
  slip or instrument display.
- Each element is flagged against the heat's `grade_specs` band — green/red, advisory only,
  never blocks saving a report or progressing the heat.
- **Correction suggestion** — computed on request only (not automatic), using total charged
  net kg (sum of `charge_lines.net_kg` for the heat) as the melt-weight estimate. This is a
  simplification, not a true melt-weight measurement — it doesn't account for losses that may
  have already occurred before the sample was taken. Treat the output as advisory guidance for
  QA, not a precise correction; never blocks anything.
- QA can view (but not edit) the heat's charge lines from this screen for context, per
  `03b_Furnace_Roles_Permissions.md`.

## Acceptance criteria

- [ ] QA-only entry; all other roles view-only.
- [ ] Spec flags computed against `grade_specs`, advisory, never blocking.
- [ ] Correction suggestion computed on-demand from charged net kg, clearly presented as an
      estimate, not a precise figure.

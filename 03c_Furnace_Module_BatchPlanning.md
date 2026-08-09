# Module — Batch Planning
### Screen 2 · Table: `furnace.batch_plans`

> Build from this file + `03a_Furnace_DataModel.md` (batch_plans table) +
> `03b_Furnace_Roles_Permissions.md`. Do not reference other module files.

## Purpose

Plant Head plans a heat before it runs: which furnace, which grade, what materials at what
planned quantities. The plant then charges against this plan on the shop floor.

## Who does what

- **Plant Head** — sole author. Creates and edits batch plans. This is not a maker-checker
  flow — a saved plan is immediately live and usable by the floor.
- **Supervisor / QA** — read-only. They see the plan to know what material to prepare, per
  Plant Head's instruction. No edit capability.
- **Owner** — read-only, plus one extra action: mark the plan reviewed (`owner_reviewed`),
  optionally with a note. This is purely for Owner's own costing assessment. **It does not
  gate anything** — Supervisor can start charging against an unreviewed plan exactly as
  freely as a reviewed one.

## Screen behavior

1. Plant Head selects furnace + grade, adds planned material lines (`material_code`,
   `planned_kg`) one at a time.
2. As lines are added, the screen live-computes `expected_composition` from
   `material_std_composition` and flags any element outside the grade's `grade_specs` band —
   advisory only, color-coded (green/red per `03k_Furnace_UX_Guidelines.md`), never blocks
   saving.
3. Save writes `batch_plans` with `created_by = plant_head`, `status` set to whatever the
   initial workflow state is (define as a single default state in v1 — this app has no
   multi-stage plan approval, just "planned" and implicitly "in use" once a heat references
   it).
4. Owner sees a list of plans with an "Acknowledge for costing" action → sets
   `owner_reviewed = true`, `owner_reviewed_by`, `owner_reviewed_at`, optional
   `owner_review_note`. No effect on plan usability.

## Business rules (advisory, non-blocking, unchanged from v1 intent)

- **Batch plan is soft-required for a heat, not hard-required.** A heat can reference
  `batch_plan_id` or leave it NULL (unplanned heat) — either is allowed. If a heat charges
  without a plan, that's a [FLAG] on the dashboard, not a block.
- **Plan-vs-actual variance** (planned_kg vs. sum of `charge_lines.net_kg` per material) is
  shown on the Charging screen (see `03d`), computed live, never blocking.
- Composition math here is pure arithmetic against `grade_specs` — no AI, no external calls.

## Acceptance criteria

- [ ] Only Plant Head can create/edit a batch plan.
- [ ] Supervisor and QA can view but not edit.
- [ ] Owner's review flag is visible but never blocks charging against the plan.
- [ ] Live expected-composition calc with spec flags, advisory only.
- [ ] A heat can start with or without a linked batch plan.

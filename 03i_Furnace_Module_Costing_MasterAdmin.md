# Module — Costing & Master Admin
### Screens 10–11 · Tables: `furnace.rate_master`, `furnace.rate_consumption_log`,
### `furnace.heat_costing`, `furnace.approval_settings`, `furnace.master_admin_change_requests`,
### `furnace.grade_specs`, `furnace.material_yield_standards`, `furnace.furnaces`

> Build from this file + `03a_Furnace_DataModel.md` + `03b_Furnace_Roles_Permissions.md`.
> Build this module **last** — it's the most sensitive (financial data, system config) and
> the smallest audience (Plant Head + Owner only). See `03l` build guide.

## 1. Access — enforced at the database, not just the screen

**Supervisor and QA have zero access to this entire module.** Not "hidden tab" zero access —
RLS-enforced zero rows returned, even on a direct API call. Only Plant Head and Owner can see
or touch anything here.

## 2. Rate master — current rate per material

`furnace.rate_master` is one current rate/kg per item, versioned by `effective_from`. There
is no lot-vs-flat split and no quantity field in the UI. Every item (charged materials and
non-material rates such as electricity, labour, overhead, transport) is the same shape:
item name, `rate_per_kg`, `effective_from`.

A heat's material cost uses whichever rate was in effect for each charged material — the
latest `effective_from <= heat close date`. Charged kg with no matching rate contributes
zero and is flagged in the UI; it never blocks costing.

`quantity_kg`, `remaining_qty_kg`, and `furnace.rate_consumption_log` remain in the schema
for historical FIFO lots. The app does not write them. Do not drop existing data.

`rate_master.source_ref_id` is an empty placeholder in v1 — reserved for the future Raw
Material app to populate directly from its own material-receipt records. No schema change
will be needed when that integration is built; just start populating this column.

## 3. Actual material cost (Plant Head maker / Owner checker, configurable)

- `heat_costing.material_cost_computed` — the Rate Master estimate (latest effective rate ×
  charged kg), calculated once when costing is computed, never overwritten.
- `heat_costing.material_cost_final` — what the rest of the costing math actually uses, and
  the **everyday** field for entering a known actual cost (invoice / known mix). Defaults to
  `material_cost_computed`. Plant Head enters the actual figure with a reason.
- Whether that write applies immediately or needs Owner sign-off depends on
  `approval_settings.requires_owner_approval` for `rate_override` — gated by default at
  launch, configurable by Owner later.

## 4. Full costing

`furnace.heat_costing` — material, fuel, manpower, consumables, electrical, transport →
cost/kg → selling price → savings. All computed fields except `material_cost_final`
(overridable per above) and the base cost inputs are read-only outputs, not hand-entered.

## 5. Master Admin

Covers: `rate_master` (base entries), `grade_specs`, `furnaces` (add/remove,
`heat_code_letter` assignment), `material_std_composition`, `material_yield_standards`.

- **Plant Head** proposes changes via `master_admin_change_requests` (maker).
- **Owner** approves/rejects (checker) — or, if Owner has set
  `approval_settings.requires_owner_approval = false` for `master_admin_change`, the change
  applies immediately and the request row is auto-marked approved for audit.
- Default at launch: gated (`true`) for this action type, same as rate override.

### Grade specs — immutability rule

`grade_specs` rows are **never edited in place.** A customer re-spec always creates a brand
new `grade_code` — old heats keep pointing at the original, untouched, so historical spec
flags never silently change meaning. Use `active`/`superseded_by` to show "replaced by X" in
the UI rather than mutating history.

### Furnace master

Adding a furnace requires assigning its `heat_code_letter` at creation time (see `03d` for how
this feeds heat-number generation). Removing a furnace should always be a soft-deactivate
(`active = false`), never a hard delete — existing heats must never be orphaned.

## 6. Approval settings (Owner-only)

`furnace.approval_settings` — one row per configurable `action_type`
(`rate_override`, `master_admin_change`). Owner toggles `requires_owner_approval` per type.
**Does not cover** heat cancellation or heat-number correction — those stay permanently fixed
maker-checker regardless of this table (see `03d`).

## Acceptance criteria

- [ ] Supervisor and QA have zero access to costing or Master Admin, enforced via RLS.
- [ ] Every material uses the latest `effective_from <= heat close date`; no FIFO lot draw.
- [ ] Actual material cost (`material_cost_final`) is Plant-Head-maker, gated by
      `approval_settings` `rate_override` (default: gated).
- [ ] Master Admin edits are Plant-Head-maker/Owner-checker, gated by `approval_settings`
      (default: gated).
- [ ] Grade re-specs always create a new grade_code; existing specs are immutable.
- [ ] Furnace removal is always a soft-deactivate, never a hard delete.
- [ ] Approval settings screen is Owner-only and does not expose heat-cancel or
      heat-number-correction toggles, since those are permanently fixed.

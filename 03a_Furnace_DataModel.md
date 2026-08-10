# Furnace App — Data Model (source of truth)
### Schema: `furnace` · v2 — supersedes all schema shown in prior drafts

> **For Cursor:** this file is the single source of truth for every table in the `furnace` schema. Every module doc (03c–03j) references tables defined here — if a module doc and this file ever disagree, this file wins. Do not invent columns not listed here without flagging it back to the product owner first.
>
> **[GATE]** = hard block, enforced in the database, not just the UI. **[FLAG]** = non-blocking, advisory. This app has exactly **one** true [GATE] in v2 (one active heat per furnace) — everything else that looks like a control is a maker-checker approval flow, which is a different mechanism (see 03b Roles & Permissions).

---

## 1. Masters

```
furnace.furnaces(id, code, name, type, heat_code_letter, active)
   -- type: main | pit
   -- heat_code_letter: single letter (A, B, C…) assigned by admin when a furnace is added.
   --    Used to build heat_no (see 03d). Only applies to type = main; pit furnace has its own
   --    separate sequence and does not use a letter.
   -- furnaces are configurable masters: add/remove via Master Admin, no code change required.

furnace.grade_specs(id, grade_code, element, min_pct, max_pct, active, superseded_by NULL,
   created_by, created_at)
   -- one row per element per grade, sourced from existing BG-xx sheets.
   -- IMMUTABLE once created. A customer re-spec is never an edit — it is a new grade_code.
   -- superseded_by: self-reference to the grade_code that replaced this one, for UI display
   --    ("this grade was replaced by X"). NULL while still current.

furnace.materials(id, code, name, active, created_by, created_at, updated_by, updated_at)
   -- reference list of raw material codes, used to drive the Material dropdown on Charging's
   -- Add Charge Line form (previously free text — see database/10_add_materials_master.sql).
   -- Master Admin data: Plant Head proposes (maker) via master_admin_change_requests,
   -- Owner approves (checker). Same pattern as furnaces/grade_specs/material_std_composition/
   -- material_yield_standards.

furnace.material_std_composition(id, material_code, element, std_pct)
   -- standard composition per RM material category, used for expected-composition calc at
   -- batch-planning time. Unchanged from v1.

furnace.material_yield_standards(id, material_code, metric, min_pct, max_pct, active,
   created_by, created_at, updated_by, updated_at)
   -- metric: ingot_pct | dross_pct | rejection_pct | burn_loss_pct
   -- one row per material_code per metric. This is the "crucial feature" standards table —
   -- see 03f for how it's used to flag out-of-range heat output.
   -- Master Admin data: Plant Head proposes (maker) via master_admin_change_requests,
   -- Owner approves (checker).
```

## 2. Rate master & FIFO costing

```
furnace.rate_master(id, item, item_type, rate_per_kg, quantity_kg NULL, remaining_qty_kg NULL,
   effective_from, source_ref_id NULL, updated_by, updated_at)
   -- item_type: lot_material | flat_rate
   -- lot_material (ingot, returns, Al ingot, Si, Cu, scrap, flux, degassing): has a quantity_kg
   --    (lot size) and remaining_qty_kg, drawn down FIFO — oldest effective_from first — as
   --    heats consume material.
   -- flat_rate (electricity, labour, overhead, transport): quantity fields stay NULL; costing
   --    always uses the latest rate with effective_from <= heat close date.
   -- source_ref_id: empty placeholder in v1, reserved so the future Raw Material app can drop
   --    its material-receipt ID in here directly — no schema change needed when that happens.

furnace.rate_consumption_log(id, heat_id, rate_master_id, item, kg_consumed, rate_used,
   created_at)
   -- audit trail of exactly which lot(s) and rate(s) covered a given heat's material cost.
   -- needed because one heat's charge can span more than one lot boundary (blended rate).
```

## 3. Batch planning

```
furnace.batch_plans(id, furnace_code, grade_code, plan_date, planned_lines jsonb,
   expected_composition jsonb, status,
   owner_reviewed boolean default false, owner_reviewed_by NULL, owner_reviewed_at NULL,
   owner_review_note NULL,
   created_by, created_at, updated_by, updated_at)
   -- created_by is always plant_head — Plant Head is the sole author of batch plans.
   -- owner_reviewed is INFORMATIONAL ONLY. Charging can start against this plan whether or
   --    not Owner has reviewed it — Owner's review exists purely to assess costing, it is
   --    never a gate on operations.
   -- planned_lines: [{material_code, planned_kg}]
   -- expected_composition: [{element, expected_pct, spec_flag}] — advisory only, computed
   --    from material_std_composition.
```

## 4. Heats — core record

```
furnace.heats(id, heat_no, furnace_code, batch_plan_id NULL, grade_code, customer NULL,
   shift_id, crew jsonb, status, fuel_reading,
   verified_by NULL, verified_at NULL,
   created_by, created_at, updated_by, updated_at)
   -- heat_no: system-generated, format and generation rule defined in 03d.
   -- status: Planned -> Charging -> Melting -> Casting -> Output Entered -> Closed | Cancelled
   -- crew: structured multi-select against common.users — never free text.
   -- verified_by / verified_at: set when QA or Plant Head verifies heat_output; this is what
   --    actually moves status from "Output Entered" to "Closed" and posts fg_stock (see 03f).
   -- [GATE] at most one heat per furnace_code with status NOT IN (Closed, Cancelled) at any
   --    time. Enforced as a partial unique index, not just a UI check:
   --    CREATE UNIQUE INDEX one_active_heat_per_furnace ON furnace.heats(furnace_code)
   --    WHERE status NOT IN ('Closed','Cancelled');

furnace.heat_cancel_requests(id, heat_id, requested_by, requested_at, reason, status,
   decided_by NULL, decided_at NULL, decision_note NULL)
   -- status: pending | approved | rejected
   -- maker: plant_head only. checker: admin_owner only.
   -- FIXED rule — not covered by approval_settings, never auto-approvable, no matter how
   --    Owner configures other maker-checker items.
   -- heats.status only moves to Cancelled on approval.

furnace.heat_no_corrections(id, heat_id, original_heat_no, requested_heat_no, requested_by,
   requested_at, reason, status, decided_by NULL, decided_at NULL)
   -- maker: plant_head. checker: admin_owner.
   -- heats.heat_no only updates on approval. original_heat_no is preserved permanently —
   --    a correction is an addition to the record, never a silent overwrite.
```

## 5. Charging & cycle

```
furnace.charge_lines(id, heat_id, bin_bay, material_code, gross_kg, tare_kg, net_kg,
   is_mid_heat_addition boolean, added_at, created_by, created_at)
   -- net_kg = gross_kg - tare_kg. Entered by Supervisor only.
   -- line-wise pickups + mid-heat hardener/flux/degasser additions on the same table.
   -- there is no "abandoned heat" case by policy — every started heat reaches Cancelled
   --    (via the maker-checker flow above) or Closed. No orphan-charge state to design for.

furnace.cycle_log(id, heat_id, stage, start_ts, finish_ts, recorded_by, recorded_at)
   -- stage: preheating | charging | melting | drossing | iron_removal | alloying |
   --    degassing | casting | cleaning
   -- start_ts / finish_ts are captured AUTOMATICALLY from the device clock at the instant
   --    Supervisor taps start/finish. Never typed. Never editable by anyone, at any time,
   --    including Plant Head and Owner. There is deliberately no edit-trail field, because
   --    there is nothing that can ever be edited.
   -- known accepted tradeoff: a wrong device clock produces a permanently wrong stage time
   --    with no recourse. Accepted in exchange for a genuinely tamper-proof record.

furnace.temp_readings(id, heat_id, checkpoint, value, spec_min, spec_max, recorded_by,
   recorded_at)
   -- checkpoint: mould_preheat | melting | iron_removal | alloying | casting — all optional.
```

## 6. Spectro

```
furnace.spectro_reports(id, heat_id, report_type, composition jsonb, sample_time,
   correction_suggested jsonb NULL, recorded_by, recorded_at)
   -- report_type: process | final
   -- composition: [{element, actual_pct, spec_min, spec_max, flag}]
   -- correction_suggested: [{material_code, suggested_kg}] — computed on request from
   --    charged net kg, never blocks heat progress. Unchanged from v1.
```

## 7. Output, close & yield standards

```
furnace.heat_output(id, heat_id, ingot_kg, dross_kg, rejection_kg,
   exceptional_label NULL, exceptional_kg NULL, burn_loss_kg,
   ingot_pct, dross_pct, rejection_pct, burn_loss_pct,
   verified_by NULL, verified_at NULL,
   recorded_by, recorded_at)
   -- burn_loss_kg = charged net kg − (ingot_kg + dross_kg + rejection_kg + exceptional_kg)
   -- ingot_pct = ingot_kg / charged net kg
   -- dross_pct = dross_kg / charged net kg
   -- rejection_pct = rejection_kg / charged net kg
   -- burn_loss_pct = burn_loss_kg / charged net kg (the balancing figure)
   -- exceptional_kg is a kg-only "extra" line — not part of the core % split.
   -- entered by Supervisor. Does NOT close the heat or post fg_stock on its own — see
   --    verified_by/verified_at: heat only closes and fg_stock only posts once QA or
   --    Plant Head verifies (either role, not both).

furnace.heat_output_flags(id, heat_id, metric, actual_pct, expected_min_pct, expected_max_pct,
   acknowledged_by NULL, acknowledged_at NULL, acknowledgement_note NULL, created_at)
   -- one row per metric (ingot_pct/dross_pct/rejection_pct/burn_loss_pct) that falls outside
   --    its expected band at verification time.
   -- expected_min_pct / expected_max_pct = kg-WEIGHTED BLEND of material_yield_standards
   --    across every charge_lines row for that heat, weighted by net_kg. A heat that charges
   --    3 materials gets an expected band blended from all 3 materials' standards in
   --    proportion to how much of each was charged.
   -- [FLAG] only — never blocks heat close. Visible exclusively on the Plant Head / Owner
   --    dashboard ("Yield Exceptions" panel), not shown to Supervisor or QA at all.
   -- stays listed as open until acknowledged (with an optional note) by Plant Head or Owner.
   -- no phone/SMS/WhatsApp delivery in v1 — dashboard-only, consistent with no-paid-services.
```

## 8. Finished goods, bundling & dispatch

```
furnace.fg_stock(id, heat_id, grade_code, kg_available, created_at, updated_at)
   -- kg is the ledger of record; increments at heat close (on verification) from
   -- heat_output.ingot_kg. Decrements via dispatch_lines below.

furnace.bundles(id, heat_id, bundle_no, pieces, weight_kg, packed_by, packed_at)
   -- reference/traceability record only; pieces do not drive stock quantity.

furnace.dispatches(id, party_name, invoice_no, dispatch_date, kg_dispatched,
   shortage_kg NULL, shortage_reported_date NULL,
   created_by, created_at, updated_by, updated_at)
   -- kg_dispatched is denormalized as SUM(dispatch_lines.kg_dispatched) for fast dashboard
   --    reads, kept in sync via trigger on dispatch_lines insert/update.
   -- invoice-only in v1; no PO master, no running balance (unchanged from v1 intent).

furnace.dispatch_lines(id, dispatch_id, heat_id, kg_dispatched, created_at)
   -- one row per (dispatch, heat) pair. A single-heat dispatch is one row; an order
   --    combining several heats is several rows against the same dispatch_id.
   -- decrements furnace.fg_stock.kg_available for that specific heat_id on save — this is
   --    what gives true lot-level traceability on shipped goods, replacing the old
   --    heat_refs jsonb array which could not support this.
   -- [FLAG] if kg_dispatched would exceed that heat's current fg_stock.kg_available — warn,
   --    don't block, consistent with the rest of this app.
```

## 9. Pit furnace (fully independent)

```
furnace.pit_heats(id, date, heat_no, weight_kg, ingot_kg, dross_kg, pit_iron_kg,
   wood_fuel_kg, composition jsonb, sale_kg,
   quality_recorded_by NULL, quality_recorded_at NULL,
   created_by, created_at)
   -- composition: 6 elements (Si/Fe/Cu/Mn/Mg/Zn), entered/verified by QA as a QUALITY
   --    RECORD ONLY — no tolerance bands, no pass/fail flag, unlike the main furnace.
   -- own heat_no sequence, separate from the main-furnace AH26-style code (there's only one
   --    pit furnace, so no furnace-letter component is needed) — flagging this as an
   --    assumption; confirm the exact pit heat_no format if it needs to match a specific
   --    paper convention.
   -- fully independent: no RM stock deduction, no furnace.fg_stock linkage, no batch plan,
   --    no cycle log, no costing.
   -- NOTE: this table intentionally has no balance_kg column — see the view below.
```

```
VIEW furnace.pit_balance
   -- balance_kg as of any date = SUM(pit_heats.ingot_kg WHERE date <= X)
   --                              − SUM(pit_heats.sale_kg WHERE date <= X)
   -- Always computed fresh from the full immutable transaction history — never a
   --    hand-edited running counter. This is deliberate: two offline tablets can each insert
   --    new pit_heats rows without ever touching a shared number, so there is nothing for
   --    them to collide over. If a fast on-screen number is needed, cache it and refresh via
   --    trigger, but the source of truth is always the summed history, not the cache.
```

## 10. Governance — approvals & Master Admin

```
furnace.approval_settings(id, action_type, requires_owner_approval boolean default true,
   updated_by, updated_at)
   -- action_type: rate_override | master_admin_change
   -- Owner-only screen. Default at launch: true (gated) for every action_type — Owner
   --    loosens specific items later if/when they choose.
   -- Does NOT cover heat_cancel_requests or heat_no_corrections — those two are permanently
   --    fixed maker-checker and cannot be configured to auto-approve, regardless of this
   --    table's settings.

furnace.master_admin_change_requests(id, target_table, target_id NULL, action, payload jsonb,
   requested_by, requested_at, status, decided_by NULL, decided_at NULL, decision_note NULL)
   -- generic request wrapper for Plant-Head-proposed changes to rate_master, grade_specs,
   --    furnaces, materials, material_std_composition, and material_yield_standards.
   -- action: create | update
   -- if approval_settings.requires_owner_approval = false for 'master_admin_change', the
   --    change applies immediately and this row is auto-marked approved, purely for audit.
```

## 11. Costing

```
furnace.heat_costing(id, heat_id,
   material_cost_computed, material_cost_final,
   material_cost_override_reason NULL, overridden_by NULL, overridden_at NULL,
   fuel_cost, manpower_cost, consumables_cost, electrical_cost, transport_cost,
   cost_per_kg, selling_price_per_kg, savings,
   created_by, created_at)
   -- material_cost_computed: always calculated from rate_consumption_log (FIFO). Never
   --    overwritten — kept as the system's own record.
   -- material_cost_final: what costing math actually uses. Defaults to
   --    material_cost_computed; Plant Head can override it (maker), subject to
   --    approval_settings for 'rate_override'.
   -- Visible only to Plant Head and Owner. Supervisor and QA have NO access to this table —
   --    enforced via RLS at the database level, not just hidden in the UI (see 03b).
```

---

## Removed from v1 (do not build)

- `furnace.charge_lines` overdraw checks against live RM stock — dropped; this app does not
  read the `material` schema in v1.
- Any table or field referencing the Maintenance app's cleaning-checklist state — dropped;
  this app does not read the `maintenance` schema in v1.
- `dispatches.heat_refs` (jsonb) — replaced by `dispatch_lines`.
- Any `edited_by`/`edited_at` fields on `cycle_log` — replaced by full immutability.

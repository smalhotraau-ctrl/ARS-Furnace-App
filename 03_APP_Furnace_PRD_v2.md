# PRD — APP: Furnace (v2) ⭐ MOST IMPORTANT APP · FIRST TO GO LIVE
### Standalone app · Auto Recycling Systems Pvt Ltd

> **This is the master/index document.** It covers scope, roles, screen index, and the
> handful of rules that apply across every screen. Everything else lives in the module files
> listed in section 6 — each one is scoped so a Cursor session working on that module doesn't
> need to load the whole app's context at once.
>
> **This app is fully standalone in v2.** It does not read from the Maintenance app's
> cleaning-checklist state and does not read live material stock from the Raw Material app.
> Both of those integrations are dropped for v1 — this app owns everything it needs on its
> own. If/when the other apps exist, those reads can be added without changing this app's
> core schema (see `03a_Furnace_DataModel.md`, section "Removed from v1").
>
> **[GATE]** = hard block, database-enforced. **[FLAG]** = advisory, never blocks. This app
> has exactly one true [GATE] — see section 7. Everything else that looks like a control is a
> maker-checker approval flow (section 5), which is a different mechanism from a gate: it
> doesn't stop the floor from working, it just requires sign-off to become official.

---

## 1. Scope

Digitize the full heat sheet system: batch planning, line-wise material charging (including
mid-heat additions), live cycle-stage timestamps (auto-captured, immutable), optional
temperature checkpoints, spectro entry with advisory correction suggestions, heat output with
a two-step verification close, a yield-standards flagging system for Plant Head/Owner
oversight, finished-goods stock (kg) with lot-level dispatch traceability, bundling for pack
traceability, invoice-based dispatch, and full batch costing (Plant Head/Owner only). A
separate simple form handles the pit furnace, intentionally isolated from RM stock and FG
stock.

## 2. Tech & conventions

- React PWA, Supabase backend, username + PIN login.
- Offline-first for almost everything — the one deliberate exception is starting a new heat,
  which requires connectivity (see `03d_Furnace_Module_HeatCharging_Cycle.md`), with an
  emergency offline fallback for genuine connectivity outages.
- Bilingual (English + Hindi) on every screen — not just labels, but flags, statuses, and
  errors. See `03k_Furnace_UX_Guidelines.md` before building any screen.
- PDF + Excel export on every report screen.
- No AI/LLM APIs of any kind.
- Supabase's free tier is the starting point; a paid tier is acceptable once the app is
  proving value — not a blocker to launch decisions.

## 3. Roles

Four roles. **Operator does not exist as a role in v2** — its tasks are folded into
Supervisor. See `03b_Furnace_Roles_Permissions.md` for the full access matrix; this is just
the one-line summary:

- **Supervisor** — the primary shop-floor user. All live data entry: charging, cycle taps,
  temperatures, output figures, bundling, dispatch. No costing visibility at all.
- **QA** — spectro entry, heat-charge visibility, heat-output verification (shared with Plant
  Head), pit furnace quality recording, dispatch entry.
- **Plant Head** — second-in-command, but not full parity with Owner. Creates batch plans.
  Maker on heat cancellation, heat-number correction, rate override, and Master Admin
  changes — all require Owner sign-off by default. Full costing visibility.
- **Admin/Owner** — checker on every Plant Head maker action. Configures which maker actions
  are auto-approved vs. gated. Full access everywhere.

## 4. Screens

| # | Screen | Module file |
|---|---|---|
| 1 | Dashboard (role-scoped, incl. Yield Exceptions panel) | `03j_Furnace_Module_Dashboard_Reports.md` |
| 2 | Batch Plan | `03c_Furnace_Module_BatchPlanning.md` |
| 3 | Heat — Charging | `03d_Furnace_Module_HeatCharging_Cycle.md` |
| 4 | Heat — Cycle & Temps | `03d_Furnace_Module_HeatCharging_Cycle.md` |
| 5 | Heat — Spectro | `03e_Furnace_Module_Spectro.md` |
| 6 | Heat — Output & Close | `03f_Furnace_Module_Output_YieldStandards.md` |
| 7 | Bundling | `03g_Furnace_Module_Bundling_Dispatch.md` |
| 8 | Dispatch | `03g_Furnace_Module_Bundling_Dispatch.md` |
| 9 | Pit Furnace | `03h_Furnace_Module_PitFurnace.md` |
| 10 | Costing (Plant Head/Owner only) | `03i_Furnace_Module_Costing_MasterAdmin.md` |
| 11 | Master Admin | `03i_Furnace_Module_Costing_MasterAdmin.md` |
| 12 | Reports | `03j_Furnace_Module_Dashboard_Reports.md` |

*(The v1 draft's "Cleaning gate check" screen is removed — see the standalone-scope note above.)*

## 5. The maker-checker model (applies across the whole app)

Plant Head is not full parity with Owner. The default posture for every consequential
Plant-Head action is: Plant Head proposes (maker), Owner approves (checker), nothing takes
effect until approved. Two categories:

- **Fixed, never configurable:** heat cancellation, heat-number correction. Always
  maker-checker, no matter what.
- **Configurable via `approval_settings`:** rate override, Master Admin changes. Owner can
  flip these to auto-approved for Plant Head later. Default at launch: gated.

Batch plans are a third, different pattern: Plant Head creates them outright (no maker-checker
needed to start work), and Owner's review is purely informational — for assessing costing —
never a gate on whether charging can start against that plan.

Full detail and the complete role/action matrix: `03b_Furnace_Roles_Permissions.md`.

## 6. Module file index

1. `03a_Furnace_DataModel.md` — full schema, source of truth for every table.
2. `03b_Furnace_Roles_Permissions.md` — full access matrix, maker-checker detail.
3. `03c_Furnace_Module_BatchPlanning.md`
4. `03d_Furnace_Module_HeatCharging_Cycle.md`
5. `03e_Furnace_Module_Spectro.md`
6. `03f_Furnace_Module_Output_YieldStandards.md`
7. `03g_Furnace_Module_Bundling_Dispatch.md`
8. `03h_Furnace_Module_PitFurnace.md`
9. `03i_Furnace_Module_Costing_MasterAdmin.md`
10. `03j_Furnace_Module_Dashboard_Reports.md`
11. `03k_Furnace_UX_Guidelines.md`
12. `03l_Furnace_BuildGuide_Cursor.md` — recommended build order and how to feed these files
    into Cursor session by session.

## 7. The one true [GATE]

At most one active heat (status not Closed/Cancelled) per furnace, at any moment, enforced by
a database constraint, not just the UI. This is the single exception to "flag, don't block" —
a furnace physically cannot run two heats at once, so there's nothing to warn about, only
something to prevent. Full detail: `03d_Furnace_Module_HeatCharging_Cycle.md`.

## 8. Acceptance criteria

- [ ] Batch plan created by Plant Head only; Owner's review is non-blocking; Supervisor/QA see
      it read-only for material prep.
- [ ] Heat numbers are system-generated (`AH26-10` style), never typed; starting a heat
      requires connectivity except in an explicit emergency-offline path.
- [ ] One active heat per furnace enforced at the database level.
- [ ] Cycle-stage timestamps captured automatically on tap, fully immutable, no edit path for
      any role.
- [ ] Heat output entered by Supervisor; heat only closes and FG stock only posts after QA or
      Plant Head verifies.
- [ ] Output percentages (Ingot/Dross/Rejection/Burn Loss) computed and checked against a
      kg-weighted blend of `material_yield_standards`; out-of-range heats flagged on the Plant
      Head/Owner dashboard only, never blocking close.
- [ ] Dispatch supports both single-heat and multi-heat combined orders via `dispatch_lines`,
      with lot-level FG stock decrement per heat.
- [ ] Rate master is FIFO-costed for lot materials, flat-rate for consumables/labour/etc.,
      with a Plant-Head rate override subject to Owner approval settings.
- [ ] Grade re-specs always create a new `grade_code`; existing grade specs are never edited.
- [ ] Heat cancellation and heat-number correction are fixed maker(Plant Head)-checker(Owner)
      flows, never auto-approvable.
- [ ] Master Admin edits (rate master, grade specs, furnace master, yield standards) are
      Plant-Head maker / Owner checker, gated by default, configurable per Owner later.
- [ ] Costing (all cost fields) visible only to Plant Head and Owner, enforced via RLS —
      Supervisor and QA have zero access, not just a hidden tab.
- [ ] Pit furnace stays fully independent; QA records composition as a quality note with no
      pass/fail flag; `balance_kg` is always computed from summed history, never hand-edited.
- [ ] Offline writes queue + sync for everything except heat-start; bilingual; PDF+Excel
      export; no AI APIs.

## 9. Future integration (no work now)

- If/when the Maintenance and Raw Material apps go live, the cleaning-gate check and live
  material-stock read can be added back — `03a_Furnace_DataModel.md` was designed so this
  doesn't require changing this app's core tables, only adding new read-only lookups.
- `rate_master.source_ref_id` is a placeholder for the future Raw Material app's
  material-receipt IDs to feed rates directly — no schema change needed when that's built.
- PO-linked dispatch (party/grade/qty/rate/running balance) deferred to v2, layering on top of
  the invoice-only `dispatches`/`dispatch_lines` tables already built.

# Module — Heat Charging & Cycle Log
### Screen 3 (combined) · Tables: `furnace.heats`, `furnace.charge_lines`, `furnace.cycle_log`,
### `furnace.heat_cancel_requests`, `furnace.heat_no_corrections`

> **Updated:** Charging and Cycle Log are one combined screen, not two separate tabs. If
> there's no active heat on the selected furnace, show the "Start New Heat" form. Once a heat
> is active, show one combined view with the 9-stage cycle-tap grid and the charge-line entry
> form together — charge lines can be entered at any point during the active heat, not locked
> to a specific cycle stage. Plan-vs-actual variance stays visible in this combined view. Access
> rules are unchanged by this merge: Supervisor enters both; QA has view-only access to
> charging and no access to cycle/temps; Plant Head/Owner view both.

> Build from this file + `03a_Furnace_DataModel.md` + `03b_Furnace_Roles_Permissions.md`.
> This is the most control-heavy module in the app — read it fully before writing any code
> here, especially the heat-number generation logic and the one true [GATE].

## 1. Heat-number generation

Format: `{FurnaceLetter}{MonthLetter}{YY}-{Seq}` — e.g. `AH26-10` = Furnace with
`heat_code_letter = A`, August (`H`, the 8th letter), year 2026, 10th heat run on that
furnace that month.

- **Furnace letter** — from `furnaces.heat_code_letter`, assigned once per furnace in Master
  Admin when it's added.
- **Month letter** — computed from the heat's start date: A=Jan … L=Dec.
- **Year** — two digits, from the heat's start date.
- **Sequence** — resets to 1 on the 1st of each month, per furnace. Normally two digits; if a
  furnace somehow exceeds 99 heats in a month, roll to three digits rather than erroring.

This code is **never typed by any user.** It is always system-generated.

### Connectivity requirement

Starting a new heat requires a live connection, by design — the server needs to safely
confirm and reserve the next sequence number, which two offline devices cannot safely agree
on independently. This is the one deliberate exception to this app's offline-first
architecture; everything that happens *during* an already-started heat (charging, cycle taps,
temps, output, bundling) stays fully offline-capable.

**Emergency offline start:** if there is genuinely no connectivity, Supervisor sees an
"Emergency Start — No Connection" option, requiring one explicit tap to acknowledge. This
creates the heat locally with a temporary placeholder code (clearly marked, e.g.
`PENDING-SYNC-<device-local-id>`), fully usable offline from that point on exactly like a
normal heat. The moment the device reconnects, the server assigns the real `AH26-10`-style
code automatically and every screen referencing that heat updates — no re-entry required.

### Heat-number correction

If a generated code is wrong or confusing (e.g., wrong furnace was selected before any
material was charged), Plant Head can request a manual correction via
`furnace.heat_no_corrections` — maker/checker, Owner approves, `original_heat_no` preserved
permanently for audit. The displayed code only changes on approval.

## 2. The one true [GATE] — one active heat per furnace

**[GATE]** At most one heat with status not in (`Closed`, `Cancelled`) may exist per
`furnace_code` at any time. Enforced by a partial unique index (see `03a`), not just a UI
check — attempting to start a second heat on an already-active furnace must fail at the
database layer.

This is the only hard block in the entire app. Everything else described below is either a
[FLAG] or a maker-checker approval — neither of which prevents the floor from working.

## 3. Heat lifecycle & cancellation

`Planned -> Charging -> Melting -> Casting -> Output Entered -> Closed`, or `Cancelled` at any
point before Closed.

There is no "abandoned heat" state by policy — cancellation is the only exit path for a heat
that can't reach a normal close. Cancellation is a **fixed maker-checker flow**, never
configurable to auto-approve:

- Plant Head submits a cancel request (`furnace.heat_cancel_requests`) with a reason. Heat
  status is untouched while pending.
- Only Owner can approve or reject. Approval flips `heats.status` to `Cancelled`.
- Rejected requests leave the heat exactly as it was — the floor keeps working on it.

## 4. Charging

`furnace.charge_lines` — Supervisor enters bin/bay, material, gross/tare/net kg per pickup,
including mid-heat additions (`is_mid_heat_addition = true`) on the same table, timestamped
via `added_at`. Numeric-only entry, see `03k_Furnace_UX_Guidelines.md`.

- Plan-vs-actual variance (against `batch_plans.planned_lines`, if a plan is linked) is shown
  live as a [FLAG], never blocking a save.
- QA has view-only access to this screen (they don't enter charges, but can see what was
  charged).
- No RM stock-availability check in v1 — this app doesn't read the `material` schema (see
  master PRD, standalone-scope note).

## 5. Cycle log — fully immutable

`furnace.cycle_log` — Supervisor taps start/finish per stage (preheating, charging, melting,
drossing, iron_removal, alloying, degassing, casting, cleaning). `start_ts`/`finish_ts` are
captured **automatically from the device clock at the instant of the tap** — never a manual
time-entry field.

**There is no correction mechanism for this table. None. Not for Supervisor, not for Plant
Head, not for Owner.** Once written, a row is permanent. If a stage was tapped at the wrong
moment, that is the recorded history — there is no edit, no soft-delete, no amendment row.
This is a deliberate, explicit product decision, not an oversight: flag it back to the product
owner if a future request asks for any kind of cycle-log editing, since it directly
contradicts this rule.

Cursor implementation note: do not build an edit button, an "amend" flow, or an
`edited_by`/`edited_at` field for this table under any circumstance without an explicit,
separate sign-off.

## Acceptance criteria

- [ ] Heat numbers are system-generated in the `AH26-10` format, never manually typed.
- [ ] Starting a heat requires connectivity except via the explicit Emergency Start path,
      which uses a placeholder code auto-upgraded on sync.
- [ ] Database-level constraint prevents a second active heat on the same furnace.
- [ ] Heat cancellation is Plant-Head-maker / Owner-checker, always, no exceptions.
- [ ] Heat-number correction is Plant-Head-maker / Owner-checker, original code preserved.
- [ ] Cycle log timestamps are auto-captured on tap and cannot be edited by any role, ever.
- [ ] Charge-line entry is Supervisor-only; QA has view access; no live RM stock check.

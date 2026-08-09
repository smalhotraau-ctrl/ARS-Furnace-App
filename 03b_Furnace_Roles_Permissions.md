# Furnace App — Roles & Permissions
### Reference for RLS policies and UI navigation on every module

> **For Cursor:** every screen's access control should be implemented as a Postgres RLS
> policy keyed on role, not just conditional rendering in the frontend. Costing especially —
> Supervisor and QA must never be able to retrieve cost data even by calling the API directly.

---

## 1. Roles

- **supervisor** — primary shop-floor user. Operator's former tasks (charging, cycle taps,
  temps, output entry, bundling) are merged into this role.
- **qa** — spectro, heat-output verification, pit furnace quality, dispatch entry.
- **plant_head** — second-in-command. Not full parity with Owner — default posture is
  maker-checker on everything consequential (see section 3).
- **admin_owner** — checker on all Plant Head maker actions; owns `approval_settings`; full
  access everywhere.

## 2. Full access matrix

| Screen / Action | Supervisor | QA | Plant Head | Admin/Owner |
|---|---|---|---|---|
| Dashboard | View assigned furnace(s), full ops | View composition flags, pit QA status | View all furnaces, full | View all + Yield Exceptions + approval queue |
| Batch Plan | View only (receives for prep) | View only (receives for prep) | Create/edit (sole author) | Reviews for costing — **non-blocking**, batch runs regardless |
| Heat — Charging | Enter (bin/bay/material/gross/tare/net + mid-heat additions) | View | View | View |
| Heat — Cycle & Temps | Enter live taps + temps (auto-timestamped, permanently locked, no correction path for anyone) | No access | View | View |
| Heat — Spectro | View | Enter process/final reports, correction suggestion | View | View |
| Heat — Output & Close | Enter output figures only (does not close) | Verify & close (either QA or Plant Head) | Verify & close (either QA or Plant Head) | View |
| Heat — Cancel | No access | No access | Maker (request only) | Checker |
| Heat-number correction | No access | No access | Maker (manual edit request) | Checker |
| Bundling | Enter | View | View | View |
| Dispatch | Enter | Enter | Enter | View |
| Pit Furnace — production | Enter | View | View | View |
| Pit Furnace — quality check | View | Enter composition (record only, no flag) | View | View |
| Costing (view) | **No access** | **No access** | Full | Full |
| Rate override | No access | No access | Maker | Checker; sets auto-approve rules |
| Master Admin (rate master, grade specs, furnace master, material std comp, yield standards) | No access | No access | Maker (proposes) | Full edit; checker |
| Approval settings | No access | No access | No access | Owner-only |
| Yield Exceptions panel | Not shown | Not shown | Shown; can acknowledge | Shown; can acknowledge |
| Reports | Export own/assigned scope | Export spectro + pit QA scope | Export all | Export all |

## 3. Maker-checker mechanics

Two distinct patterns are used across this app — do not conflate them:

**Pattern A — fixed, permanent, never configurable.**
Applies to: heat cancellation, heat-number correction.
Plant Head submits a request with a reason. The underlying record (`heats.status` or
`heats.heat_no`) does not change until Owner approves. Rejected requests leave the record
untouched. This cannot be toggled to auto-approve under any `approval_settings` configuration.

**Pattern B — configurable via `approval_settings`.**
Applies to: rate override, Master Admin changes.
Default at launch: `requires_owner_approval = true` for both action types — every Plant Head
proposal sits pending until Owner acts on it. Owner can later flip either action type to
auto-approved via the Approval Settings screen (Owner-only). When auto-approved, the change
applies immediately and the request row is still written for audit, just pre-marked approved.

**Batch plans are neither pattern.** Plant Head's plan is live the moment it's saved — no
request/approval object involved. Owner's "review" is a separate, optional acknowledgement
flag purely for their own costing assessment; it has zero effect on whether Supervisor/QA can
act on the plan.

## 4. RLS implementation notes for Cursor

- Every table with a Plant-Head-or-above visibility restriction (`heat_costing`,
  `rate_master`, `material_yield_standards`, `approval_settings`,
  `master_admin_change_requests`, `heat_cancel_requests`, `heat_no_corrections`) needs a
  policy that checks the requesting user's role directly from the `common.users` table (or
  session claim), not from any client-supplied flag.
- `heat_costing` and `rate_master.rate_per_kg` in particular: Supervisor and QA roles get zero
  rows back, not redacted fields — the query itself should return nothing, so there's no
  partial-data leak to reverse-engineer.
- `furnace.heat_output_flags` (Yield Exceptions): policy restricts SELECT to `plant_head` and
  `admin_owner` only.
- `furnace.cycle_log`: no UPDATE or DELETE policy should exist for any role — enforce
  immutability at the database level, not just by omitting an edit button in the UI.

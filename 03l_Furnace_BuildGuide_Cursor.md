# Furnace App — Build Guide for Cursor
### How to work through this PRD set without losing context

## The file set

```
03_APP_Furnace_PRD_v2.md          master/index — start every new Cursor session by pointing it here
03a_Furnace_DataModel.md          full schema — the source of truth, reference constantly
03b_Furnace_Roles_Permissions.md  access matrix + RLS notes
03c...03j                         one module per screen group
03k_Furnace_UX_Guidelines.md      applies to every screen, reference constantly
03l (this file)                   build order
```

## Why modular

This app has a lot of interlocking rules — maker-checker flows, an immutable cycle log, FIFO
costing, a weighted-blend flagging engine. Feeding Cursor the entire PRD at once for every
task invites it to blend rules across modules that don't actually interact. Instead: **point
Cursor at `03a` (schema) + `03b` (roles) + the one module file for whatever you're building
right now.** Don't load unrelated module files into the same session unless there's a direct
dependency (called out below).

## Recommended build order

1. **`03a` + `03b`** — stand up the full schema and RLS policies first, even though no screen
   exists yet. Everything else builds on this being right.
2. **`03h` Pit Furnace** — build this first among the actual screens. It's fully isolated
   (confirmed independent of every other module), so it's the fastest way to prove the
   stack — auth, offline queue, Supabase writes, PWA shell — before touching anything with
   real interdependencies.
3. **`03c` Batch Planning** — no dependencies beyond `03a`/`03b`.
4. **`03d` Heat Charging & Cycle** — depends on `03c` (batch_plan_id is optional but the
   charging screen should be able to link one). This is the most control-heavy module — the
   heat-number generation logic and the one-active-heat-per-furnace gate live here. Get this
   right before moving on; several later modules assume a correctly-behaving `heats` table.
5. **`03e` Spectro** — depends on `03d` (heat must exist).
6. **`03f` Output, Close & Yield Standards** — depends on `03d` (charge lines, for the
   weighted-blend calc) and needs `material_yield_standards` seeded via `03i`'s Master Admin
   screen before the flagging logic can be meaningfully tested.
7. **`03g` Bundling & Dispatch** — depends on `03f` (fg_stock only exists after a heat
   closes).
8. **`03i` Costing & Master Admin** — build last among the functional modules. Most sensitive
   (financial data, system config), smallest audience (Plant Head/Owner only), and other
   modules (03f, 03d) need some of its master data (yield standards, rate master, furnace
   letters) seeded before they can be fully tested — so Master Admin's *data entry* screens
   may need to exist earlier than the full costing calculation logic. Build the Master Admin
   CRUD screens early enough to seed data, but the FIFO costing engine and rate-override flow
   can genuinely come last.
9. **`03j` Dashboard & Reports** — last. It's a read-only layer over everything above; there's
   nothing to show until the other modules produce data.

## Conventions to hold across every session

- **[GATE]** appears exactly once in this whole app (one active heat per furnace, in `03d`).
  If Cursor ever proposes blocking behavior anywhere else, stop and check it against `03a`/the
  relevant module file — it's almost certainly supposed to be a [FLAG] or a maker-checker
  request instead.
- Every maker-checker table follows the same shape: `requested_by`, `requested_at`, `reason`,
  `status` (pending/approved/rejected), `decided_by`, `decided_at`. Reuse this pattern rather
  than inventing a new shape per feature.
- RLS policies belong in the database, not just conditional rendering — especially for
  costing (`03i`) and the Yield Exceptions panel (`03f`/`03j`).
- Nothing in this app calls an AI/LLM API. If a task seems to want one (e.g., "smart"
  suggestions beyond the simple arithmetic already specified), that's out of scope — flag it
  back rather than reaching for one.

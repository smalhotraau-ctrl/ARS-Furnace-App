# Module — Bundling & Dispatch
### Screens 7–8 · Tables: `furnace.bundles`, `furnace.dispatches`, `furnace.dispatch_lines`

> Build from this file + `03a_Furnace_DataModel.md` + `03b_Furnace_Roles_Permissions.md`.

## 1. Bundling

`furnace.bundles(heat_id, bundle_no, pieces, weight_kg, packed_by, packed_at)` — Supervisor
enters, everyone else views. Reference/traceability record only — `pieces` is a data field,
not a stock-driving quantity. Bundling happens after a heat closes and FG stock has posted;
it does not itself move stock.

## 2. Dispatch

`furnace.dispatches` + `furnace.dispatch_lines` — replaces the old single `heat_refs jsonb`
array design. This is the fix for a real traceability gap: one dispatch can now legitimately
cover either a single heat or several heats combined into one invoice.

### Schema shape

- `dispatches`: party_name, invoice_no, dispatch_date, `kg_dispatched` (denormalized total,
  kept in sync via trigger), shortage_kg (editable later), shortage_reported_date.
- `dispatch_lines`: one row per `(dispatch_id, heat_id)` pair, each carrying its own
  `kg_dispatched`. A single-heat dispatch is one row. A combined order across multiple heats
  is multiple rows under the same `dispatch_id`.

### Behavior

- Entry screen: pick party + invoice details, then add one or more heat/kg lines — each line
  picks a heat with available `fg_stock` and a kg amount.
- On save, each `dispatch_lines` row decrements `fg_stock.kg_available` for that specific
  `heat_id` — this is what preserves lot-level traceability on what shipped from which heat,
  even when several heats are combined on one invoice.
- **[FLAG], not a block:** if a line's `kg_dispatched` would exceed that heat's current
  `fg_stock.kg_available`, warn but allow the save — consistent with this app's flag-first
  philosophy everywhere else.
- Shortage field remains editable 1–2 days after dispatch, same as v1 intent — no hard cutoff
  window is enforced in v1.

### Who can enter dispatch

**Supervisor, QA, and Plant Head** can all create dispatch entries — this was widened from
v1's supervisor-only design. Owner has view-only access.

## Acceptance criteria

- [ ] Bundling entered by Supervisor, viewed by all other roles; pieces are reference-only.
- [ ] Dispatch supports both single-heat and multi-heat combined invoices via `dispatch_lines`.
- [ ] Each dispatch line decrements FG stock at the specific heat level, not an aggregate pool.
- [ ] Over-draw against a heat's available stock is a warning, never a hard block.
- [ ] Supervisor, QA, and Plant Head can all enter dispatch; Owner is view-only.
- [ ] Shortage field stays editable after the fact, no fixed lockout window in v1.

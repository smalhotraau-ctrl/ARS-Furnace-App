# Module — Dashboard & Reports
### Screens 1, 12 · Reads across all `furnace` tables (no new tables of its own)

> Build from this file + `03a_Furnace_DataModel.md` + `03b_Furnace_Roles_Permissions.md`.
> Build this module after the core heat-flow modules exist, since it's a read-only view over
> their data.

## 1. Dashboard — role-scoped, not one screen for everyone

Each role gets a different view, not the same screen with things hidden:

- **Supervisor** — assigned furnace(s), heats in progress, today's charging/output status.
  No costing, no Yield Exceptions panel.
- **QA** — composition flags awaiting action, pit furnace quality status, spectro queue. No
  costing, no Yield Exceptions panel.
- **Plant Head / Owner** — full plant view across all furnaces: heats in progress, today's
  recovery breakdown, pending dispatch shortages, open batch-plan reviews (Owner only), open
  approval requests (cancellations, rate overrides, Master Admin changes), and the **Yield
  Exceptions panel** (see `03f`) — the one thing that must never be missable on this screen.

## 2. Reports

PDF + Excel export of any heat, batch plan, dispatch, or costing record, scoped to what that
role can see per `03b_Furnace_Roles_Permissions.md`:

- Supervisor — own/assigned entries.
- QA — spectro and pit-furnace-quality-related records.
- Plant Head / Owner — everything, including costing.

## 3. UI density

Given the tablet/phone personas (see `03k_Furnace_UX_Guidelines.md`), the dashboard must be
scannable at a glance — large numbers, color state (not dense tables) for anything Supervisor
or QA see. Plant Head/Owner's fuller view can carry more density since they're the
power-user layer, but the Yield Exceptions panel specifically should still be impossible to
miss even there — treat it as the top of the visual hierarchy on their dashboard, not a
buried tab.

## Acceptance criteria

- [ ] Dashboard is genuinely role-scoped — different content per role, not one screen with
      conditional visibility.
- [ ] Yield Exceptions panel appears only for Plant Head/Owner and is visually prominent.
- [ ] Reports export PDF + Excel, scoped to each role's visibility.

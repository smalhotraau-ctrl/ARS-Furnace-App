# Module — Heat Output, Close & Yield Standards
### Screen 6 · Tables: `furnace.heat_output`, `furnace.heat_output_flags`,
### `furnace.material_yield_standards`, `furnace.fg_stock`

> Build from this file + `03a_Furnace_DataModel.md` + `03b_Furnace_Roles_Permissions.md`.
> The yield-standards flagging feature in section 3 is the single most important quality
> control in this app — read it fully before implementing.

## 1. Output entry (Supervisor)

Supervisor enters `ingot_kg`, `dross_kg`, `rejection_kg`, `iron_kg`, and optionally one
`exceptional_label` + `exceptional_kg` free-text/kg line. Numeric-only entry.

`iron_kg` is a fourth core output field, equally weighted with Ingot/Dross/Rejection —
material removed during the `iron_removal` cycle stage. Required, same as the other three;
never optional and never folded into Dross.

`burn_loss_kg` is always derived, never entered:
```
burn_loss_kg = charged_net_kg − (ingot_kg + dross_kg + rejection_kg + iron_kg + exceptional_kg)
```
where `charged_net_kg` = sum of `charge_lines.net_kg` for the heat.

**Entering output does not close the heat.** `heats.status` moves to `Output Entered`, not
`Closed`. FG stock is not posted yet. See section 2.

## 2. Two-step close (QA or Plant Head verification)

A heat only closes — and `furnace.fg_stock` only increments — once QA **or** Plant Head
(either one, not both) verifies the entered output. This is a deliberate change from a single
person both entering and closing output.

- Verification screen shows the entered figures plus the recovery breakdown (section 3) and
  any yield-standard flags (section 4), so the verifier sees exceptions before confirming.
- On verify: `heat_output.verified_by`/`verified_at` set, `heats.status` → `Closed`,
  `fg_stock` row created/incremented from `heat_output.ingot_kg`.
- No reject/reopen flow is specified in v1 — if a verifier finds the entered figures wrong,
  that's a correction to `heat_output` itself before verifying, not a formal reject step.
  (Flag back to product owner if a reject-and-return-to-Supervisor flow turns out to be
  needed in practice.)

## 3. Recovery breakdown

Computed and stored on `heat_output` at entry time:

| Metric | Formula |
|---|---|
| Ingot % | `ingot_kg / charged_net_kg` |
| Dross % | `dross_kg / charged_net_kg` |
| Rejection % | `rejection_kg / charged_net_kg` |
| Iron % | `iron_kg / charged_net_kg` |
| Burn loss % | `burn_loss_kg / charged_net_kg` (the balancing figure) |

`exceptional_kg` is reported as a kg-only "extra" line on the output screen — it is not part
of this core percentage split.

## 4. Yield standards — the flagging feature

### Standards table

`furnace.material_yield_standards(material_code, metric, min_pct, max_pct)` — one row per
input material per metric (`ingot_pct`/`dross_pct`/`rejection_pct`/`iron_pct`/`burn_loss_pct`).
Lives in Master Admin: Plant Head proposes, Owner approves (see `03i`).

### Why per-material, not per-grade or per-furnace

Different scrap/input materials have different achievable yield characteristics — a standard
belongs to the material being melted, not the grade being produced or the furnace running it.

### Computing the expected band for a heat

A heat almost always charges more than one material. The expected range for that heat's
output is a **kg-weighted blend** across every material actually charged into it:

```
expected_min_pct(metric) = Σ(material_i.min_pct × material_i.net_kg) / Σ(material_i.net_kg)
expected_max_pct(metric) = Σ(material_i.max_pct × material_i.net_kg) / Σ(material_i.net_kg)
```
summed over every `charge_lines` row for that heat (including mid-heat additions), for each
of the five metrics independently.

### Flagging

At verification time (section 2), for each metric: if the heat's actual % falls outside its
blended expected band, write a row to `furnace.heat_output_flags` (actual_pct,
expected_min_pct, expected_max_pct).

- **[FLAG] only — this does not block heat close.** The heat closes and FG stock posts
  normally regardless of any flags raised.
- Visible **exclusively** on the Plant Head and Owner dashboards, in a dedicated "Yield
  Exceptions" panel — Supervisor and QA never see this panel (enforce via RLS, not just UI).
- A flagged item stays listed as open until Plant Head or Owner acknowledges it (optional
  note). Review is expected, not optional, even though it's non-blocking — the panel should
  make open/unacknowledged count impossible to miss.
- Dashboard-only delivery in v1 — no SMS/WhatsApp/push notification. That would require a
  paid service, which conflicts with this app's no-paid-services baseline; flag to the
  product owner if that tradeoff needs revisiting later.

## Acceptance criteria

- [ ] Supervisor enters output; heat does not close on entry alone.
- [ ] QA or Plant Head must verify before `heats.status` → `Closed` and FG stock posts.
- [ ] Burn loss is always derived, never entered directly.
- [ ] Five recovery percentages (Ingot/Dross/Rejection/Iron/Burn Loss) computed and stored per
      the formulas above — Iron is a required core field, equally weighted, never folded into
      Dross.
- [ ] `material_yield_standards` maintained in Master Admin, Plant-Head-maker/Owner-checker.
- [ ] Expected band per heat computed as a kg-weighted blend across all charged materials.
- [ ] Out-of-range metrics flagged to `heat_output_flags`, visible only on Plant Head/Owner
      dashboards, never blocking close, open until acknowledged.

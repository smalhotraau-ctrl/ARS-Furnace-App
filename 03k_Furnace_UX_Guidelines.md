# Furnace App — UX Guidelines
### Applies to every screen in every module — read this before building any UI

## Who's using this app

- **Supervisor / QA** — basic Android tablets/phones issued by the company, limited formal
  education, comfortable with plant operations but not with software. This is the app's core
  user base and the design center of gravity.
- **Plant Head / Owner** — basic education, basic Android phones, but higher operational
  authority and more screen time on oversight/costing views.

Design for the floor first. If a design choice is easy for a power user but hard for a
Supervisor entering data forty times a shift, it's wrong.

## 1. Icon-first, not text-first

The 9-stage cycle log especially — preheating through cleaning — needs to read as a row of
large, distinct icons with bilingual labels underneath, not a text list. A user should be able
to tell which stage they're tapping without reading the word.

## 2. Numeric entry only where numbers are expected

Weight entry (gross/tare/net), temperature, and spectro composition are all manual numeric
typing in v1 (no scale or spectrometer hardware integration). Every one of these fields should
force a numeric keypad, not a full keyboard — fewer ways to mistype, faster to use, and it
visually signals "this expects a number" to someone who may not read the label confidently.
Large touch targets, generous spacing, auto-formatted decimals so a stray tap can't turn 9.6
into 96.

## 3. Color before text on any flag

Every spec/composition/yield flag in this app follows one convention, everywhere, no
exceptions: **green = within standard, red = out of standard.** Color is the primary signal;
the number and label are secondary, for the users who do read them. Don't rely on subtle color
shifts — use a strong, unambiguous red/green, ideally paired with a simple check/cross icon so
it doesn't depend on color perception alone.

## 4. Role-scoped navigation, not a shared menu with hidden items

Each role should see a menu built only from what applies to it (Supervisor's menu has no
costing tab lurking anywhere, not even grayed out). Don't build one shared navigation
component with conditional visibility per item — build the navigation set per role. A
confusing, cluttered menu is worse for this user base than a slightly less elegant codebase.

## 5. Saving vs. syncing — don't show the floor a technical concept

Supervisor and QA should never see sync states, connection status, or queue counts on their
entry screens. The only feedback they need: an instant, unmistakable "Saved" confirmation
(checkmark, brief animation, whatever's clear) the moment they submit — this happens instantly
from local storage regardless of connectivity, so it's always immediate. Sync to the server
happens silently in the background. Only Plant Head/Owner dashboards get a small, secondary
"X entries pending upload" indicator, since they're the ones who'd actually need to notice a
device has been offline too long.

The one exception is heat-start (see `03d`), which does need an explicit
"Emergency Start — No Connection" acknowledgment when offline — that's a deliberate, rare
interruption, not a general sync-status display.

## 6. Bilingual everywhere, not just labels

English + Hindi applies to field labels, button text, status names, and flags/errors — not
just the static chrome. A red flag that says "Out of range" needs a Hindi equivalent right
there, not just the field label above it.

## 7. Keep entry flows short and linear

Given the literacy and device constraints, prefer one clear action per screen/step over dense
multi-field forms. Charging, output entry, and dispatch especially should read as a short
sequence rather than a form to fill out top to bottom.

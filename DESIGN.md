# Design

<!-- impeccable:design-schema 1 -->

The system norr.fun commits to. Change it here first; anything that drifts from
this is a bug, not a variation.

## The world — "polar night ledger"

A records instrument for a sealed sale, read through the northern winter dark.
Fjord-slate ground, snow ink, iron-oxide signal.

Every surface is **Operate**: someone completing a task with money attached.
There is no marketing page. Expression never outranks the task, state, or a
familiar affordance — brand lives in precise details.

**Why this and not the obvious one.** This category ships one look: pure black,
one neon accent, glowing edges, rounded glassy cards, a candlestick chart. Every
AI-generated trading UI converges on the same thing. It was also where this
codebase started — 80 uses of `gray-500`, cyan-to-fuchsia gradients, blue glow
shadows.

Dark is pinned by the brief. So this is a *different* dark:

- the ground is **desaturated blue-slate with real hue**, never `#000` — pure
  black also destroys the hairlines the whole system depends on;
- the accent is **iron oxide**, a pigment rather than a light source;
- **nothing glows.** No gradient fills, no glassmorphism, no drop shadows.

Two disciplines are borrowed on purpose:

- **Security printing.** A value lives in a bounded, tinted field with a rule
  around it, not floating in a card. Figures are tabular and column-aligned.
- **Transit-timetable typography.** Few sizes, rank carried by weight, case,
  reversal and rule. See the honest correction under Type.

## Color

Restrained: near-neutral ground, one signal, three state pigments. Color is
never decoration — a hue on this surface always means something.

| Token | Value | Role |
|---|---|---|
| `--snow` | `#101a20` | page ground |
| `--snow-sunk` | `#0c141a` | input wells, recessed cells |
| `--sheet` | `#16222a` | ruled sections |
| `--sheet-raised` | `#1c2b34` | the one level above a sheet |
| `--ink` … `--ink-4` | `#e6edf1` → `#5c6e7a` | text, four steps |
| `--rule` | `#2b3a44` | hairlines; the structural element |
| `--falu` | `#c9553a` | signal, primary action, live |
| `--lichen` | `#6aa585` | settled, confirmed, paid |
| `--ochre` | `#c2a04a` | waiting, pending, held |
| `--fjord` | `#6d9fb8` | **sealed** — this product's signature state |

Each state pigment has a `-wash` at ~12% for filled marks.

**Allocation ramp** (`--cat-*`): eight fee buckets share one bar, so they must
separate at 4px wide. Built by walking the world's pigments warm→cold while
alternating lightness — adjacent buckets differ in value as well as hue, which
is what carries the distinction in greyscale and for red-green color-blind
readers. Never substitute a rainbow.

## Type

System stacks. An Operate surface is well served by them, and character comes
from case, weight, tracking and rule rather than a webfont that must be fetched.

- `--face-ui` — system-ui stack. Everything.
- `--face-data` — `ui-monospace` stack, tabular figures. Every number.
- Wordmark — condensed heavy stack led by Avenir Next Condensed. Deliberately
  not a ubiquitous grotesque: the wordmark is the one place this interface has
  a voice.

**Scale — three steps, and this is a corrected position.**

| Token | Size | Use |
|---|---|---|
| `--t-fine` | 12px | tracked uppercase labels. The floor. |
| `--t-base` | 15px | body and data |
| `--t-lead` | 32px | page lead, and the wordmark |

The timetable discipline taken literally produced 10px functional text and five
sizes inside a 1.9:1 spread. That is a legibility failure wearing a design
principle's clothes. Rank still comes from weight and case; the scale simply
stopped fighting legibility. **Nothing below 12px, ever** — and adding a step to
this table to launder a small value is the exact move the floor exists to stop.

Two cascade rules learned the hard way:

- **Never set `font-size` on `html`.** `html` *is* the root, so it rebases every
  `rem` token — a 12px floor silently became 11.25px. It lives on `body`.
- **No raw Tailwind size classes** (`text-xs`, `text-2xl`, `text-[10px]`). They
  reintroduce steps the ramp never agreed to. Use `text-[length:var(--t-*)]`.

## Layout

- **Square.** No border radius anywhere. The sheet is printed, not rounded.
- **Hairlines carry structure.** One `--rule` line separates sections; boxes do
  not each draw their own outline. No card inside a card.
- **Rail, not tabs.** Eight destinations wrap onto two rows as a horizontal
  strip; in a rail they fit one per line at any width.
- **Tabular figures always.** Digits must align down a column and must not
  reflow width as they tick.
- **Reversal, not size,** for a control that outranks its neighbours.

## Motion

Almost none, and it must mean something.

- Color transitions on interactive elements. Nothing else.
- **No hover-scale on anything that signs a transaction.** A control that moves
  under the cursor undercuts the seriousness of what it commits to.
- The wordmark's channel-tear fires briefly every 7s; disabled under
  `prefers-reduced-motion`.
- Loading uses shape-matched skeletons so layout does not jump on arrival.

## Anti-patterns

Banned here, and the detector enforces most of them:

gradient fills · glow and colored shadows · glassmorphism / backdrop blur ·
border radius · pulsing dots · particle backdrops · Inter / Roboto / Geist /
Plus Jakarta / Space Grotesk / Fraunces · text below 12px · cards inside cards ·
numbered section labels · third-party accents left at their vendor default
(RainbowKit is themed to this palette; its stock blue is 4.2:1 and belongs to
no palette here).

## Verification

`npx impeccable detect eerc-frontend/src` and
`npx impeccable detect http://localhost:5173` must both return zero. Findings
get fixed, never suppressed — the runtime scan catches what the static one
cannot, so run both.

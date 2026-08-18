# Design

<!-- impeccable:design-schema 1 -->

The system norr.fun commits to. Change it here first; anything that drifts from
this is a bug, not a variation.

## The direction — tactical telemetry

CRT terminal / aerospace HUD. Dark-exclusive, monospace-dominant, Avalanche red
on a near-black field, technical framing devices, high data density.

Committed to this archetype alone. The industrial-brutalist skill offers two
modes — Swiss industrial print and tactical telemetry — and says to pick one.
Telemetry is the fit: this is a dense operator surface for a launch platform on
Avalanche, not an editorial page.

**Ground is `#08090a`, not `#000000`.** Pure black kills the hairlines every
table here is built from and removes any sense of a lit panel above a field. It
reads as black; it still has structure.

**Avalanche red `#e84142` is the only accent**, taken from the chain this runs
on. It carries brand, the primary action, and live state.

**The one unavoidable second hue is market direction.** A trading surface
cannot express up and down without green and red, and inverting that convention
to protect a palette would cost a user money. So gain is green, loss is the same
red, and the accent is distinguished from loss by *form* — a filled control
versus a bare figure — not by hue.

**Glow is narrow and deliberate.** A generic drop shadow is a tell; a phosphor
bloom is this archetype's own lighting model. It is tinted red, applied only to
the accent, never to a panel.

**Preserved after audit** because they were working: the token-only palette
(which is why each retheme has been a token edit, not a rewrite), tabular
figures, hairline tables, shape-matched skeletons, the rail nav, and the
wordmark's chromatic split.

## Color

Restrained: near-neutral ground, one signal, three state pigments. Color is
never decoration — a hue on this surface always means something.

| Token | Value | Role |
|---|---|---|
| `--snow` | `#08090a` | page ground |
| `--snow-sunk` | `#050607` | input wells |
| `--sheet` | `#0e1013` | panels |
| `--sheet-raised` | `#15181c` | one level above a panel |
| `--ink` … `--ink-4` | `#ece9e3` → `#4f4d48` | text, warm-tinted, four steps |
| `--rule` | `#22262b` | hairlines; the structural element |
| `--falu` | `#e84142` | **the** accent — Avalanche red |
| `--falu-bright` | `#ff5c5d` | hover on the accent |
| `--gain` | `#3fcf8a` | market direction, up |
| `--loss` | `#e84142` | market direction, down |

**Geometry is square** — `--r-panel` and `--r-control` are both 2px. Terminals
do not round their corners.

**HUD framing.** `.hud` draws corner ticks via pseudo-elements, so the device
costs no markup and never intercepts a pointer. `.emissive` applies the
phosphor bloom to live figures.

**Measured contrast, all AA or better** (lowest 4.78:1): ink 16.5:1 · ink-2
7.6:1 · ink-3 5.8:1 on ground and 5.5:1 on panel · red 5.0:1 on ground · gain
9.5:1.

**Button foreground is dark ink, not white.** White on Avalanche red measures
3.99:1, under AA — the fix belongs on the foreground, not on a brand colour
nobody would recognise.

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
- **Rail, not tabs,** for navigation. Eleven destinations wrap onto two rows as
  a horizontal strip; in a rail they fit one per line at any width. Tabs are
  reserved for views of the *same* subject — the trades, discussion and holders
  of one launch — which is the only case they beat a rail.
- **Tabular figures always.** Digits must align down a column and must not
  reflow width as they tick.
- **Reversal, not size,** for a control that outranks its neighbours.

### The surface primitives

Added when the app went from one stacked column to a launch grid, a market
page and a wizard. All of them are built from tokens already above; the
information architecture is borrowed from the reference boards, the drawing
is not.

| Primitive | What it is | Rule it carries |
|---|---|---|
| `.panel` | ruled region, optional head on a full-width rule | a column of panels reads as one document |
| `.chip` | label + figure in one bounded cell | the metadata strip on a launch |
| `.seg` | bounded strip with internal rules | these are the states of **one** control |
| `.tabbar` / `.tab` | rule under the live tab | views of one subject |
| `.meter` | progress with quarter ticks | **never drawn without its denominator** |
| `.plot` | hairline graticule from `--rule` | the chart's own field |
| `.avatar` | mark, with a chain badge on the corner | falls back to the ticker, never a broken glyph |
| `.card-link` | a whole card that navigates | rule brightens, ground lifts, **nothing moves** |

**The card grid.** A reader scanning launches is comparing them, so each tile
puts its trace, its progress and its turnover in the same place. What a card
reports depends on what the launch *has*: a sealed round with no market shows
its raise and settlement, one with a live curve shows price, trace and volume.
Neither borrows the other's figures — a raise has no price and a curve has no
tally, and printing a zero for the missing one is a lie about the data.

**One emissive control.** `.cta-emissive` puts the phosphor bloom on the
primary create action and nothing else. The ban on glow below is a ban on
*decorative* glow; the accent's own lighting model, applied once per screen to
the one action that matters, is the archetype rather than a violation of it.

**Charts draw only what happened.** Candles bucket real fills; an empty
interval produces no candle rather than a flat one carried forward. Change is
labelled by the window it actually measures — a launch younger than a day
reports "since open", never a 24h figure it does not have.

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

gradient fills · decorative glow and colored shadows (the single
`.cta-emissive` bloom is the stated exception) · glassmorphism / backdrop blur ·
border radius · pulsing dots · particle backdrops · Inter / Roboto / Geist /
Plus Jakarta / Space Grotesk / Fraunces · text below 12px · cards inside cards ·
numbered section labels · third-party accents left at their vendor default
(RainbowKit is themed to this palette; its stock blue is 4.2:1 and belongs to
no palette here).

Two more, earned on this pass:

- **No progress bar without its target.** A bar with no denominator cannot
  distinguish 90% of a small goal from 9% of a large one, which on a launch
  page is the entire question.
- **No figure the contracts do not produce.** Vote counts, holder counts on a
  sealed round, a 24h change with under a day of history: if the chain does not
  say it, the surface does not print it. A number kept in this browser looks
  identical to one the network agreed on and means nothing.

## Verification

`npx impeccable detect eerc-frontend/src` and
`npx impeccable detect http://localhost:5173` must both return zero. Findings
get fixed, never suppressed — the runtime scan catches what the static one
cannot, so run both.

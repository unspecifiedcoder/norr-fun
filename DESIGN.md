# Design

<!-- impeccable:design-schema 1 -->

The system norr.fun commits to. Change it here first; anything that drifts from
this is a bug, not a variation.

## The direction — dark operator

Near-black ground, one accent, dense ruled data. The register a data-heavy dark
dashboard has used since terminals: black field, tabular figures, and a single
vivid signal that only ever means one thing.

Every surface is **Operate**: someone completing a task with money attached.
There is no marketing page. Expression never outranks the task, state, or a
familiar affordance — brand lives in precise details.

**Ground is `#0a0b0c`, not `#000000`.** Pure black crushes the hairlines that
carry every table on every surface here, and removes any sense of a lit panel
sitting above a field. It reads as black; it just still has structure.

**One accent.** Green means value moving in your favour, and nothing else. The
remaining hues are not accents — they are the three states a financial
interface cannot express without colour (waiting, negative, sealed), each held
under 70% saturation so none competes with the signal.

**Preserved from the previous system** because the audit found them working: a
token-only palette (which is why a full retheme is a token edit, not a
rewrite), tabular figures, hairline tables, shape-matched skeletons, the rail
nav, and the wordmark's chromatic split.

## Color

Restrained: near-neutral ground, one signal, three state pigments. Color is
never decoration — a hue on this surface always means something.

| Token | Value | Role |
|---|---|---|
| `--snow` | `#0a0b0c` | page ground |
| `--snow-sunk` | `#060708` | input wells |
| `--sheet` | `#101113` | panels |
| `--sheet-raised` | `#17191c` | one level above a panel |
| `--ink` … `--ink-4` | `#f2f4f5` → `#4e565c` | text, four steps |
| `--rule` | `#212427` | hairlines; the structural element |
| `--falu` | `#3fcf8a` | **the** accent — value in your favour |
| `--ochre` | `#d9a441` | waiting, pending, held |
| `--loss` | `#e05252` | negative movement |
| `--fjord` | `#7f8b93` | sealed / neutral state |

**Radius is varied, not uniform** — `--r-panel` 10px for containers,
`--r-control` 6px for controls. Uniform radius on everything is a tell.

**Allocation ramp** (`--cat-*`): eight buckets stepped through one hue family by
value rather than eight competing hues, so they separate at 4px wide, in
greyscale, and for red-green colour-blind readers.

**Measured contrast** (all AA or better): ink on ground 17.9:1 · ink-2 8.9:1 ·
ink-3 4.8:1 · accent on ground 9.9:1 · button text on accent 9.6:1 · ochre
8.4:1 · loss 5.0:1.

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

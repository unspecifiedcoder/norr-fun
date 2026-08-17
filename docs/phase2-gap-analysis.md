# Phase 2 — screen-by-screen gap analysis

Complete public surface of the reference, enumerated systematically rather than
sampled: `robots.txt` for namespaces, then a link harvest across every known
page, normalising dynamic segments into route patterns. No sitemap or build
manifest is exposed, so the harvest is the authoritative list.

Every row states what norr.fun has, or why it does not.

---

## Route inventory

| # | Reference route | What it does | norr.fun | Status |
|---|---|---|---|---|
| 1 | `/` | Discovery feed, sort modes | `/` | **shipped** |
| 2 | `/create` | Launch-archetype selector | — | **n/a** — see note A |
| 3 | `/launch-pool` | Bonding-curve launch wizard | `/start` | **shipped** — see note B |
| 4 | `/launch-flash` | Instant launch, virtual liquidity | — | **blocked** — needs an AMM |
| 5 | `/create-board` | Publisher environment creation | `/desks` | **shipped** |
| 6 | `/add-liquidity` | Create an AMM pool for a pair | — | **blocked** — needs an AMM |
| 7 | `/b/:slug` | Publisher-scoped feed | `/desk/:slug` | **shipped** |
| 8 | `/u/:addr` | Participant profile | `/u/:addr`, `/me` | **shipped** |
| 9 | `/:chain/token/:addr` | Launch detail + trading | `/raise/:sale` | **partial** — see note C |
| 10 | `/:chain/launch-pool` etc. | Chain-scoped variants of 3–6 | — | **gap** — buildable, see note D |
| 11 | Collect-fees surface | Withdraw everything accrued | `/owed` | **shipped** |
| 12 | Search | Across launches and publishers | in-feed search | **shipped** |
| 13 | Alerts surface | Activity on things you're involved in | — | **gap** — buildable, see note E |
| 14 | Preferences | Client-side display settings | — | **gap** — buildable |
| 15 | `/user/*` | Authenticated private area (robots-disallowed) | `/me`, `/owed` | **shipped** in substance |
| 16 | `/admin/*` | Operator tooling (robots-disallowed) | — | **n/a** — private tooling, not a user surface |
| 17 | `/cdn/*`, `/ipfs/*` | Asset hosting | — | **n/a** — infrastructure, not a screen |

---

## Notes

**A — archetype selector.** The reference offers three launch archetypes, so it
needs a chooser. norr.fun has one (a sealed contribution round). A selector
listing a single option is a dead click; the wizard is the entry point instead.
This becomes a real screen only if a second archetype ships.

**B — wizard parity.** Same structure: identity fields, completeness gating,
optional groups, programmable fee routing, live preview, applied settings.
Two sub-features are deliberately absent: image upload (no asset pipeline —
the reference pins to IPFS) and paid promotion tiers (no billing rail).
Faking either is worse than their absence.

**C — launch detail.** Header, metadata, phase progress, participation, fee
routing, claim, and discussion are shipped. Price chart, trade history and
holder list are not, and cannot be: a sealed round has no continuous price,
no public per-trade record, and no enumerable holder set. Building them means
inventing data the protocol does not produce.

**D — chain-scoped routes.** The reference namespaces every flow per chain
(`/robinhood/launch-pool`), so a link carries its network. norr.fun resolves
the network from the connected wallet, which means a shared link can resolve
against the wrong chain. Buildable; queued.

**E — activity surface.** The reference shows activity on things you are
involved in. Buildable here from contract events without an indexer: the
protocol's own contracts emit everything needed, and a client can query logs
scoped to one address.

---

## Blocked set, stated once

Rows 4, 6 and the trading half of row 9 all reduce to the same missing
primitive: **an automated market maker**. The reference is a continuous-price
launchpad; norr.fun is a sealed contribution round with an off-chain tally.

Adding a curve is not a missing screen — it changes what the product is, and
a public holder list would negate the privacy the protocol exists to provide.
That is a product decision, recorded here rather than made unilaterally.

Everything not downstream of an AMM is built.

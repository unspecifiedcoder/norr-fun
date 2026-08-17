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
| 4 | `/launch-flash` | Instant launch, virtual liquidity | `BondingCurve` virtual reserves | **shipped** — a curve opens with no seeded liquidity |
| 5 | `/create-board` | Publisher environment creation | `/desks` | **shipped** |
| 6 | `/add-liquidity` | Create an AMM pool for a pair | curve graduation releases reserves to seed one | **partial** — see note F |
| 7 | `/b/:slug` | Publisher-scoped feed | `/desk/:slug` | **shipped** |
| 8 | `/u/:addr` | Participant profile | `/u/:addr`, `/me` | **shipped** |
| 9 | `/:chain/token/:addr` | Launch detail + trading | `/raise/:sale` | **shipped** — trading, chart, fills, holders |
| 10 | `/:chain/...` | Chain-scoped route variants | `/:chain/raise`, `/desk`, `/u` | **shipped** — see note D |
| 11 | Collect-fees surface | Withdraw everything accrued | `/owed` | **shipped** |
| 12 | Search | Across launches and publishers | in-feed search | **shipped** |
| 13 | Alerts surface | Activity on things you're involved in | `/activity` | **shipped** — from contract logs |
| 14 | Preferences | Client-side display settings | `/settings` | **shipped** |
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

**C — launch detail.** Shipped in full: header, metadata, phase progress,
participation, fee routing, claim, discussion, trading, price chart, fills and
holders.

An earlier version of this document argued the trading half could not be built
without contradicting the sealed round. That was wrong, and the correction is
worth recording: the raise and the market are *sequential phases*, not
alternatives. Contribution amounts stay private in the eERC layer during the
raise; afterwards the distributed token is an ordinary public ERC20 whose
holder set is already visible to anyone reading the chain. Trading it reveals
nothing that was private.

**D — chain-scoped routes.** Shipped. Chain-scoped mirrors of the shareable
routes, so a link carries its network. On a mismatch the app says so and stops,
rather than switching the visitor's wallet behind their back or — worse —
silently rendering another chain's data as if it were the linked one. An
unknown slug redirects to the unscoped route instead of erroring.

**E — activity surface.** The reference shows activity on things you are
involved in. Buildable here from contract events without an indexer: the
protocol's own contracts emit everything needed, and a client can query logs
scoped to one address.

---

**F — external pool seeding.** `BondingCurve.graduate()` locks the curve and
releases both reserves to the graduation recipient, which is exactly the
capital needed to open a pool on an external DEX. The remaining step — calling
a specific DEX's factory — is deliberately left out: it binds the protocol to
one venue's interface, and the reference itself supports several. The release
is the part that belongs here.

---

## Where this landed

Every row is shipped, or marked n/a with a reason that is about the reference's
infrastructure rather than a capability we lack (asset hosting, private admin
tooling, an archetype chooser for archetypes we do not have).

Two sub-features inside shipped rows are deliberately absent, both because
faking them would be worse than their absence: image upload (no asset pipeline)
and paid promotion tiers (no billing rail). One row is partial by choice —
graduation releases the capital to seed an external pool but does not call a
specific DEX factory, since that would bind the protocol to one venue.

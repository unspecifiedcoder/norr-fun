# Phase 4 — functional parity, visual and textual divergence

Two separate claims, evidenced separately:

1. every shipped capability **does what the reference's equivalent does**, and
2. none of it **looks or reads like** the reference.

---

## Part 1 — coverage traceability

Each row of `phase2-gap-analysis.md` marked *shipped*, and where it is proven.

| Capability | Automated coverage | Manual/browser evidence |
|---|---|---|
| Discovery feed, sort modes | `EndToEnd` §12 (`page`, ordering) | Feed rendered from registry; both sort modes reorder |
| Launch creation | `EndToEnd` §2–3; `LaunchRegistry` suite | Deployed a raise from the wizard; 4 signed txs; appeared in feed |
| Publisher desks | `EndToEnd` §1, §3; `BoardsAndComments` suite | Opened a desk; underpaying raise rejected at register, compliant one accepted |
| Desk-scoped feed | `EndToEnd` §3 (`pageByBoard`) | Desk page listed only its own raise |
| Payout split, pull-based release | `EndToEnd` §4; `FeeRouter` suite (15) | Deposited and released; balances read back independently |
| Aggregated payouts (`/owed`) | `EndToEnd` §4, §12 reconciliation | Collect-all moved 250; wallet, `released`, `releasable` all agreed |
| Tally publication + claim | `EndToEnd` §5; `IDO` suite | Claimed 50 MPT against a real Merkle proof; double-claim refused |
| Market: buy / sell / quotes | `EndToEnd` §6–7; `BondingCurve` suite (13) | Two buys via UI; price moved; fee reached the router |
| Graduation | `EndToEnd` §8; `Graduation` suite (8) | Pool seeded, LP position to recipient, pool immediately swappable |
| Price chart + fills | `EndToEnd` §12 (events emitted) | Chart drew from 2 real fills; fills list matched |
| Holders | `EndToEnd` §12 (transfers emitted) | Reconstructed 2 holders with correct shares; contracts excluded |
| Discussion | `EndToEnd` §9; `BoardsAndComments` suite | Posted a comment; read back on chain with correct author |
| Follows + watchlist | `EndToEnd` §10; `SocialGraph` suite (12) | Followed (0→1) and saved; both confirmed on chain |
| Paid promotion | `EndToEnd` §11; `Promotion` suite (10) | Bought Boosted; 0.05 ETH to treasury; 24h expiry |
| Launch images | `EndToEnd` §3 (`logoURI` round-trip) | Field in wizard; dead URL falls back to ticker |
| Activity | `EndToEnd` §12 (events queryable) | Wallet-scoped and protocol-wide views over 6 event types |
| Profiles | `EndToEnd` §12 (`idsByCreator`) | Profile listed 2 raises and totals |
| Search | — (pure client filter) | "telemetry" narrowed the feed to one raise |
| Settings | — (local storage) | Backdrop toggle removed the canvas and persisted |
| Chain-scoped links | — (routing) | `/local/…` opened; `/fuji/…` warned instead of misleading |
| Private transfer (eERC) | pre-existing eERC suite | Panel renders and gates on connection; **see limitation below** |

**Limitation, stated plainly.** The eERC private-transfer path is the one
surface not exercised end to end. It needs the circom trusted setup
(`zkit make`) and deployed eERC contracts, which this environment has not run.
Everything above it in the table is verified; this one is inherited from the
original project and remains as it was found.

---

## Part 2 — divergence from the reference

Doing this check properly caught a real defect: the payout panel was titled
**"Fee Builder"**, which is the reference's own branded product name, taken
verbatim. It is now "Payout split". That is exactly the kind of thing this
audit exists to find, and it would not have surfaced from asserting divergence
in prose.

### Navigation model — different in kind

The reference uses a **persistent left sidebar rail**: brand, search, three
action items, then a scrolling publisher list, with content in a right column.

norr.fun has **no sidebar at all**. It is a single centred panel with a
horizontal tab strip beneath the header. A reader cannot map one layout onto
the other; the information architecture differs, not just the styling.

### Card content — different metrics, because different product

| Reference card | norr.fun card |
|---|---|
| Price sparkline with period-change badge | *(none — no continuous price on a sealed round)* |
| Market cap vs graduation target, progress bar | Raised, in the contribution asset |
| Transaction count, volume | Paid out %, with absolute beneath |
| — | Number of fee recipients |
| — | Provenance line: who started it, which vault |

### Palette and type

- **Reference:** near-black, one saturated green accent, proportional sans.
- **norr.fun:** `#08080c`, a cyan→fuchsia gradient identity, monospace
  throughout, and a *semantic* palette where colour carries meaning rather than
  brand — one hue per fee category, emerald reserved for claimable, rose for
  sells, violet for frozen/graduated.
- The wordmark is heavy italic with a chromatic-aberration split; the reference's
  is a proportional logotype with a mascot.

### Copy — independent lexicon

| Reference term | norr.fun term |
|---|---|
| Boards | Desks |
| Pools / Flash Tokens | Raises |
| Fee Builder | Payout split |
| Collect Fees | Owed to you |
| Create | Start one |

Section headings are written here, not adapted: *"Where the money goes"*,
*"Before it ships"*, *"Feed placement"*, *"Move value without revealing the
amount"*. Status language is ours: *accepting funds*, *tally published*,
*splits frozen*, *sealed contribution*, *fully claimed*.

Two words are shared and deliberately kept: **graduation** and **slippage**.
Both are general category vocabulary — graduation is used across launchpads,
slippage across every AMM — not marks of the reference. Renaming them would
make the product harder to understand for no gain in independence.

### Assets

None taken. No screenshots saved, no images, icons, fonts or copy extracted.
Icons are `react-icons`; the wordmark and favicon are drawn here as CSS and SVG
paths.

# Launchpad functional spec

Capability map for norr.fun, derived from studying how a mature launchpad in
this category behaves. This records **what such a product does** — screens,
flows, and state transitions. It intentionally records no visual design, no
wording, and no assets from any reference; layout, styling and all copy in
norr.fun are our own.

---

## A. Discovery feed

**Purpose:** browse every launch on the protocol.

- Feed of launch cards, each summarising one launch at a glance.
- Sort/filter modes over the same collection (e.g. curated, activity-ranked,
  recency, unfiltered). Switching mode reorders the feed, not the data.
- Each card links to the launch's detail screen.
- Entry points to the creation flow sit alongside the feed.
- A scoped variant of the feed exists per publisher (see D), showing only that
  publisher's launches plus its own creation entry points.

**norr.fun mapping:** feed reads the on-chain launch registry. Cards show
raised, fee-split allocation, sale phase, and claim progress — the figures a
sealed private sale actually has. No price chart: there is no continuous
market to plot.

---

## B. Launch creation

**Purpose:** deploy a launch without touching a CLI.

Model selection first — the product offers distinct launch archetypes
(bonding-curve pool with a graduation target; instant launch with no upfront
liquidity; publisher/white-label environment). Each leads to its own form.

Common structure of the creation form:

1. **Target network selector.**
2. **Required identity fields** — name, symbol, image. The form tracks
   completeness (N of M required fields) and blocks submission until satisfied.
3. **Optional, collapsible setting groups**, each showing a one-line summary of
   its current value while collapsed:
   - description and social links
   - market/venue settings (fee tier, starting valuation)
   - **programmable fee routing** — the signature capability: split trading or
     sale proceeds across multiple named recipients
   - creator's own initial allocation
   - sale-phase rules (caps per participant, trading delay, allowlist)
4. **Tiered launch plans** — a free tier plus paid tiers that add promotion.
5. **Live preview** rendering exactly the feed card the launch will produce,
   updating as fields change.
6. **Applied-settings summary** listing resolved values and naming what is
   still missing.
7. Submit → signs and deploys → redirect to the new launch's detail screen.

**norr.fun mapping:** a real wizard that deploys `ProjectToken`, `FeeRouter`
and `IDO`, then registers them in `LaunchRegistry`. Fee routing maps directly
onto `FeeRouter`'s basis-point splits. Sale-phase rules map onto the IDO's
start/end window. Paid promotion tiers are omitted — there is no payment rail
and inventing one would be fake.

---

## C. Launch detail

**Purpose:** everything about a single launch, plus the act of participating.

- Identity header, pair, headline price/valuation, period change.
- Metadata strip: venue, fee tier, contract address, publisher, market cap,
  liquidity, volume.
- Time-series chart with timeframe and series-type selectors.
- Key figures repeated as discrete stats.
- Tabbed secondary content: **trade history**, **discussion**, **holders**.
- Progress toward a graduation threshold, with a terminal "graduated" state.
- Primary action to participate (buy/sell, or claim once concluded).

**norr.fun mapping:** header + metadata + phase progress + the participation
action. Trade history, price chart and holders are **not built**: a sealed
private sale has no public per-trade record, no continuous price, and
deliberately no visible holder list — that is the point of the product.
Discussion needs a server this SPA does not have. Building any of them would
require inventing data.

---

## D. Publisher environments ("boards")

**Purpose:** let a third party run a branded launch surface and earn from
launches published through it.

- Creation form: name, description, banner + logo, social links, visibility,
  fee configuration, and a metered API plan.
- Completeness meter and preview, as in B.
- Publishing costs a fee.
- Each publisher gets a scoped feed and aggregate stats (launch count,
  participants, volume).
- Publisher-level fee defaults are inherited by launches created under it.

**norr.fun mapping:** deferred. Requires a registry contract for publishers
and an inheritance rule into `FeeRouter`. `FeeRouter` already supports a
partner allocation, which is the economic half; the organisational half is a
later phase.

---

## E. Secondary flows

- **Add liquidity** to an existing launch.
- **Collect fees** — recipients withdraw what they have accrued.
- **Participant profile** at `/u/<address>`: launches created and held.
- Global search across launches and publishers.
- Notification surface.

**norr.fun mapping:** fee collection already exists and works (`FeeRouter`
pull-based `release`). Profile and search follow the registry. Liquidity
provision is out of scope without a curve.

---

## Build order for norr.fun

| # | Capability | Status |
|---|---|---|
| 1 | `LaunchRegistry` — on-chain discovery | build now |
| 2 | Creation wizard deploying a real launch | build now |
| 3 | Feed backed by the registry | build now |
| 4 | Launch detail: phase, splits, claim | extend existing panels |
| 5 | Fee collection | already shipped |
| 6 | Publisher environments | later |
| 7 | Trading, charts, discussion, holders | needs a curve and a server |

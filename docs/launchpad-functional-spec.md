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
Discussion is shipped on-chain (`LaunchComments`), which needs no server.
Trade history, price chart and holders remain unbuilt because building them
would require inventing data this protocol does not produce.

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

**norr.fun mapping:** shipped as `BoardRegistry` ("desks" in our copy). A desk sets a handle, a
minimum share of any raise published through it, and open vs invite-only.
`LaunchRegistry` enforces both at registration against the raise's actual
`FeeRouter` split. Banner/logo uploads and metered API plans are omitted:
there is no asset pipeline and no billing rail, and faking either would be
worse than their absence.

---

## E. Secondary flows

Re-walked after the first pass, which had missed several of these.

- **Add liquidity** — create an AMM pool for an arbitrary ERC20 pair against a
  protocol hook, reading token metadata on-chain to confirm the pair.
- **Collect fees** — a single surface, reachable from anywhere, where a
  recipient withdraws everything they have accrued across the whole protocol.
  Not per-launch: it aggregates.
- **Participant profile** at `/u/<address>` — richer than a launch list.
  Counters for launches, publisher environments, **followers and following**,
  and tabs for launches / liquidity positions / publishers / **saved items** /
  followers / following.
- **Social graph** — accounts follow each other; follower counts are public.
- **Saved items** — a personal watchlist of launches.
- Global search across launches and publishers.
- Notification surface for activity on things you are involved in.

**norr.fun mapping:**

| Flow | Status |
|---|---|
| Collect fees, aggregated across every raise | build — `FeeRouter.release` exists but only per-raise |
| Follow / followers | build — on-chain social graph |
| Saved items | build — on-chain, so a watchlist follows the wallet not the browser |
| Profile tabs over the above | build |
| Search | shipped |
| Add liquidity, liquidity positions | out of scope — needs an AMM |
| Notifications | deferred — derivable from contract events, but wants an indexer to be useful |

---

## Build order for norr.fun

| # | Capability | Status |
|---|---|---|
| 1 | `LaunchRegistry` — on-chain discovery | shipped |
| 2 | Creation wizard deploying a real launch | shipped |
| 3 | Feed backed by the registry | shipped |
| 4 | Launch detail: phase, splits, claim | shipped |
| 5 | Per-raise fee collection | shipped |
| 6 | Publisher environments | shipped |
| 7 | Discussion | shipped, on-chain |
| 8 | Aggregated fee collection | build now |
| 9 | Social graph and saved items | build now |
| 10 | Trading, charts, liquidity, holder lists | needs an AMM; conflicts with a sealed sale |

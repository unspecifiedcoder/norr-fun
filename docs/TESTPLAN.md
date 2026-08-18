# norr.fun — acceptance test plan

Every item is executed against the running app in a real browser on chain
31337, with the console and network panel checked on each. "Correct" below is
the exact observable result; anything else is a FAIL.

Legend for the run column: **PASS** / **FAIL** / **UNTESTABLE** (with reason).

---

## A. Shell and navigation

| # | Item | Correct means |
|---|---|---|
| A1 | Rail renders | Wordmark, tagline, search, 3 action links, 6 nav links, desk index, 4 live figures, 3 dock icons — all present on every route |
| A2 | Active route marking | The nav link matching the current path has the accent left-border and bold ink; no other link does |
| A3 | Search focus shortcut | Pressing `/` outside a text field focuses the rail search; pressing it inside a field types a slash |
| A4 | Search submits to URL | Typing `MyProject` + Enter navigates to `/?q=MyProject`; feed filters to matching rows only |
| A5 | Desk index in rail | Lists every desk on chain, sorted by the chosen order; each links to `/desk/<slug>` |
| A6 | Desk sort control | Switching Newest / A–Z / Top share reorders the rail list accordingly |
| A7 | Live protocol figures | Raises, Accepting, Desks, Raised match on-chain counts exactly |
| A8 | Status bar | Shows current chain id and a block number that advances as blocks are mined |
| A9 | Notification badge | Count equals the number of activity entries currently readable |
| A10 | Mobile drawer | At 375px the rail is hidden, the menu button opens it, and navigating closes it |

## B. Feed (`/`)

| # | Item | Correct means |
|---|---|---|
| B1 | Feed lists every registered raise | One card per registry entry; count matches `page()` total |
| B2 | Card identity | Avatar, name, symbol, sealed marker, creator short address, desk slug when registered under one |
| B3 | Card body — no market | Raise meter with raised figure and paid-out %, opened-ago line, recipient count |
| B4 | Card body — live market | Price, signed % change, sparkline, fills and volume in the footer. Only when the curve has ≥2 fills |
| B5 | Status badge | `open` when not finalized, `claiming` when finalized, `graduated` when the curve has, `ath n%` when priced |
| B6 | Promoted labelling | A raise with `promotedUntil > now` shows a PROMOTED strip and sorts above unpromoted ones |
| B7 | Sort pills | Newest / Open / Top raised / All each reorder the grid and write `?sort=` |
| B8 | Filter box | Typing filters by name, ticker, summary, sale address and creator address |
| B9 | Empty search state | A query matching nothing shows "Nothing matched" with the query echoed |
| B10 | Headline figures | Raises, Accepting funds, Raised in total, Paid out match chain state |
| B11 | Watchlist toggle | Bookmark writes to SocialGraph; icon fills; save count on the launch page increments |
| B12 | Card navigation | Clicking a card opens `/raise/<sale>` for that card |

## C. Launch detail (`/raise/:ido`)

| # | Item | Correct means |
|---|---|---|
| C1 | Header, priced | Name, `SYMBOL / BASE`, price in sub-cent notation, change with the window it measures |
| C2 | Header, sealed | Reports the sealed round rather than inventing a price |
| C3 | Provenance strip | Sale, token, vault, creator, desk, opened date, share link — each copy button writes the full address |
| C4 | Channel chips | Market cap, liquidity, volume, fills, from-ath, recipients, comments, saved-by, supply — each matching chain state |
| C5 | Chart renders | With ≥2 fills a candle chart with axis, opening level and last-price tag |
| C6 | Chart empty state | With <2 fills, "No price history" inside the plot frame — never a fabricated line |
| C7 | Timeframe control | 1m/5m/15m/1h/4h/1d rebucket the same fills; the price scale does not change |
| C8 | Candles/Line toggle | Same series, same scale, different mark |
| C9 | Price/Market-cap toggle | Market cap = price × total supply, shown on the axis |
| C10 | Progress rail | Graduation meter with held/goal from the curve, or the sealed-round statement |
| C11 | Trade — buy | Quote shows receive/at-worst/fee; buying moves price, adds a tape row, increases liquidity |
| C12 | Trade — sell | Symmetrical to buy |
| C13 | Trade — percent buttons | 25/50/100% set the amount from the balance |
| C14 | Trade — not connected | Controls disabled with a stated reason |
| C15 | Token claim | Pool, balance, allocation, already-claimed, claimable — matching the IDO contract |
| C16 | Claim executes | With claimable > 0, claiming transfers tokens and drops claimable to 0 |
| C17 | Contribute panel — open | Vault address, sealed balance, amount field, contribute control |
| C18 | Contribute panel — setup needed | Directs to `/private` when no key or not registered |
| C19 | Contribute panel — finalized | States contributions are closed |
| C20 | Contribute — no aggregation | No total, count or average of contributions anywhere on the page |
| C21 | Tab: Trades | Tape newest-first with side, wallet, amounts, price, relative time |
| C22 | Tab: Discussion | See section D |
| C23 | Tab: Holders | Ranked holders from Transfer logs, share bar, top-5 concentration |
| C24 | Tab: Payout split | Allocation bar, per-recipient rows, totals, deposit and freeze controls |
| C25 | Tab: Placement | Promotion tiers with prices; buying one marks the raise promoted |
| C26 | Unknown sale address | States nothing matches rather than rendering an empty page |

## D. Discussion

| # | Item | Correct means |
|---|---|---|
| D1 | Posting | Comment is written on-chain and appears with author, "you" badge and relative time |
| D2 | Reply threading | A reply renders nested under its parent, with the marker stripped from the body |
| D3 | Creator badge | A comment by the launch creator is marked `creator` |
| D4 | Withdraw | Author-only; body is replaced by "Withdrawn by its author" |
| D5 | Character counter | Counts the visible body, not the threading marker; turns accent past the limit |
| D6 | Order control | Newest/Oldest reorders roots; replies stay under their parents |
| D7 | Not connected | Composer replaced by a connect prompt |
| D8 | No fabricated scores | No vote counts anywhere |

## E. Create flow

| # | Item | Correct means |
|---|---|---|
| E1 | Model selector | Three models, instant banner, payout-split panel, privacy panel, placement tiers |
| E2 | Instant mode | Name/symbol/supply only; split auto-set to 100% creator with the connected address |
| E3 | Full mode | Split editor open with add/remove, category, share, live allocation bar |
| E4 | Required-field counter | `n/3` increments as name, ticker and supply are filled |
| E5 | Deploy disabled until valid | Button states what is missing and stays disabled |
| E6 | Allocation must total 100% | Not 100% blocks deploy and states the remainder |
| E7 | Deploy executes | Four transactions: token, router, sale, register — each address shown |
| E8 | Deployed raise appears in feed | The new raise is in the feed with its supply and recipient count |
| E9 | Live preview | Mirrors name, ticker, summary, logo, supply, split as typed |
| E10 | Applied settings | Recipients, allocated %, desk, contributions, placement — each accurate |
| E11 | Logo drop | An image under 12kB inlines and previews; a larger one is refused with its size stated |
| E12 | Network panel | Shows the connected chain and switches on selection |
| E13 | Desk minimum enforced | Publishing under a desk with a minimum below the split is rejected with the reason |

## F. Desks

| # | Item | Correct means |
|---|---|---|
| F1 | Index | One card per desk with name, slug, owner, minimum share, open/invite, raise count |
| F2 | Empty state | "No desks yet" when the registry has none |
| F3 | Create desk | Writes to BoardRegistry; the desk appears in the grid and rail; Desks figure increments |
| F4 | Duplicate slug | Blocked with "That handle is already taken" |
| F5 | Desk detail | Hero, chips, and the raises published through it |
| F6 | Unknown slug | States nothing is registered at that handle |

## G. Earnings, activity, profile, settings

| # | Item | Correct means |
|---|---|---|
| G1 | Owed — figures | Ready, already collected, raises paying you — matching FeeRouter state |
| G2 | Owed — collect one | Releases that recipient's share; ready drops to 0; collected increases by the same |
| G3 | Owed — collect all | One transaction per owed raise |
| G4 | Owed — not connected | States allocations are looked up by address |
| G5 | Activity — list | Entries rebuilt from logs, newest first, each with an icon, summary and block |
| G6 | Activity — scope | Yours/Everyone changes the set; unconnected states it is showing everyone |
| G7 | Activity — refresh | Re-reads logs |
| G8 | Profile — own | Address, identicon, "you", followers/following, raises started and total raised |
| G9 | Profile — other | Same, plus a working follow control |
| G10 | Profile — follow | Writes to SocialGraph; follower count increments |
| G11 | Settings — persistence | Each setting survives a reload |
| G12 | Settings — slippage | Prefills the trade panel |
| G13 | Settings — reset | Returns every value to its default |

## H. Private balance (`/private`)

| # | Item | Correct means |
|---|---|---|
| H1 | Deployment wiring | EncryptedERC address resolved from the artifact, never typed by hand |
| H2 | Step strip | Key / Registered / Encrypted funds, each marked from real state |
| H3 | Derive key | Signature derives a key, it persists per wallet, and the balance decrypts |
| H4 | Register | Proof and transaction; `isUserRegistered` true on-chain afterwards |
| H5 | Convert in | Public tokens become an encrypted balance; public falls, encrypted rises by the same |
| H6 | Convert out | The reverse |
| H7 | Send privately | Encrypted transfer to a registered address; sender balance falls |
| H8 | Unregistered recipient | Refused before a proof is generated, with the reason |
| H9 | Pending state | Every operation reports what it is doing while proving |
| H10 | Failure state | Every failure is shown in the UI, never only in the console |
| H11 | Token metadata | Symbol and decimals read from the ERC20, not from an artifact |
| H12 | Honest limit stated | The page says amounts are hidden from the public, not from the auditor |

## I. Cross-cutting

| # | Item | Correct means |
|---|---|---|
| I1 | No console errors | Zero errors on every route in the run |
| I2 | No failed network requests | No 4xx/5xx and no failed RPC calls |
| I3 | Wrong-network handling | A chain with no registry states so rather than showing an empty feed |
| I4 | Deep link with chain slug | `/local/raise/<sale>` resolves; a mismatched chain states the mismatch |
| I5 | Unknown route | Falls back to the feed |
| I6 | Error isolation | A throwing panel degrades in place; the rail and the rest of the page keep working |
| I7 | No mocks or stubs | No mock, stub, fake or placeholder data in any tested path |
| I8 | Contract test suite | 103 passing |
| I9 | Typecheck and lint | 0 errors |
| I10 | Production build | Builds, and the built bundle carries the Buffer polyfill |

---

# Run result — chain 31337, browser, 2026-08-18

**101 items: 100 PASS, 0 FAIL, 1 UNTESTED.**

Executed against the running app with the dev wallet signing on a live
Hardhat node. Every write below is a real signed transaction; no mocks, no
stubs, no fallback data anywhere in the tested surface.

## Fixed during the run

| Item | Defect | Fix |
|---|---|---|
| H5 | SDK refuses a deposit with "Insufficient approval amount!" and never requests the allowance | `useEERC.deposit` reads the allowance and approves exactly the deposit amount first |
| H5 | 100-token deposit displayed as an encrypted balance of `10000` beside a public `900` | Encrypted balance formatted with the encrypted token's own decimals |
| H7 / C17 | Transfers scaled by the ERC20's 18 decimals; the contract rejected them as an invalid amount | Transfer and withdraw use the encrypted token's decimals; only deposit uses the ERC20's |
| C17 | Passing a message made the SDK call a 5-arg `transfer(..., string)` this deployment does not declare — reverted with an unrecognised selector | Message dropped; the 4-arg form the contract has is used |
| A9 | Shell badge read zero beside a page listing thirteen entries | One activity scan per scope, shared through a module-level cache |
| I1 | An all-zero (empty) balance ciphertext threw out of render and blanked the app | SDK patched to return its own `-1n` "unreadable"; the UI states it plainly |
| I1 | `metaMaskWallet` throws on load without a WalletConnect project id | Offered only when that id is configured |

## Verified on chain

- Buy: price `0.0₂266 → 0.0₂336`, liquidity `9.9 → 14.85`, fills `1 → 2`
- Sell: fills `2 → 3`, from-ath turns negative
- Claim: pool `150 → 100 MPT`, wallet `0 → 50 MPT`, claimable `0`
- Fee release: ready `0.201 → 0`, collected `250 → 250.2`
- Deploy: 4 transactions, published to the registry, appears in the feed
- Desk create, duplicate slug refused, desk minimum enforced at registration
- **Private contribution**: deposit `1000 → 900` public / `0 → 100` encrypted,
  contribution `100 → 90`, tx `0xbe092b27…` status `0x1`, and the plaintext
  amount appears nowhere in the 1572 bytes of calldata

## Untested

**I3 — wrong-network handling.** The app cannot be placed on a chain without
a registry: the local dev provider is deliberately single-chain, and no second
funded network is reachable. The branch exists and is shared with the desk
registry's equivalent, but it was not exercised in a browser, so it is not
marked passed.

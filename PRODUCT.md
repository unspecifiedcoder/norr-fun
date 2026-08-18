# Product

<!-- impeccable:product-schema 1 -->

> Written by inference from the codebase, README and shipped UI copy, at the
> user's explicit instruction not to be asked for product or design direction.
> Facts not evidenced in the repo are marked (assumed).

## Platform

web

## Stack

Existing. Vite 7 + React 18 + TypeScript, Tailwind CSS 4, wagmi/viem +
RainbowKit for wallet and chain access, react-router for routing. Contracts are
Solidity 0.8.27 under Hardhat, targeting Avalanche C-Chain (Fuji testnet and a
local 31337 node). Circom/snarkjs supply the encrypted-balance proofs.

## Users

**Founders raising capital.** Deploy a raise from the browser, define who earns
from it, publish a tally, fund the claim. They arrive with a token idea and a
list of people owed a share, and leave with deployed contracts.

**Backers contributing privately.** Put money into a raise without publishing
the size of their position. The whole reason they are here rather than on a
public launchpad is that their contribution amount is nobody else's business.

**Desk operators** — KOLs, communities, incubators, agencies. Run a branded
launch surface, set a minimum share routed to themselves, and earn recurring
revenue from raises published through it instead of one-off promotion fees.

**Fee recipients.** Anyone named in a split: team, partners, treasury. They come
back only to see what they are owed and withdraw it.

## Product Purpose

Run a token raise where contribution amounts stay sealed but settlement is
publicly verifiable.

Contributors move value as encrypted ERC-20 balances, so on-chain observers see
that a transfer happened but not its size. After the window closes the operator
decrypts what arrived, tallies it, and publishes a Merkle root. From that point
every allocation and every claim is public and checkable by anyone.

Success is a raise that completes without any contributor's position becoming
public, and a claim phase where nobody has to trust the operator's arithmetic.

## Positioning

**Private contribution, public settlement.** Public launchpads expose every
position the moment it is taken. Fully private systems ask you to trust an
operator's word about the outcome. norr.fun splits the difference along the
axis that matters: amounts are sealed while the sale runs, and the result is
committed on-chain where anyone can verify their own allocation against the
published root.

The honest limit, and it is load-bearing: the operator holds the decryption key
during the tally. Contributors are private from each other and from the public,
not from the operator.

Programmable fee routing is the second mechanism. A raise commits its split to a
contract before it opens; recipients withdraw their own share and the operator
cannot redirect it afterwards.

## Operating Context

Used at a desk, wallet connected, usually on a laptop, often with a block
explorer open in another tab. Every meaningful action costs a signature and the
user knows it — the interface is judged partly on whether it makes clear what
they are about to sign.

Sessions are short and purposeful. Founders visit around a launch; backers
around a contribution; fee recipients only to check and withdraw. Nobody browses
this product for entertainment.

Network context is always live and always mutable — a user can be on the wrong
chain, and the interface has to say so rather than silently showing nothing.

## Capabilities and Constraints

Shipped, on-chain:

- `LaunchRegistry` — permissionless launch index; caller recorded as creator.
- `IDO` — Merkle-root claim with a start/end window.
- `FeeRouter` — basis-point splits, pull-based withdrawal, lockable.
- `BondingCurve` / `LiquidityPair` / `PairFactory` — curve trading, graduation.
- `BoardRegistry` — desks, slugs, minimum partner share enforced at registration.
- `LaunchComments`, `SocialGraph` — on-chain discussion, follows, watchlists.
- `Promotion` — paid placement.
- `EncryptedERC`, `Registrar`, verifiers — the sealed-balance layer.

Constraints that shape the UI:

- Everything is read from chain. There is no server, no database, no indexer.
  Any figure shown must be derivable from a contract call.
- Reads are slow and arrive in stages. Loading states are not decoration.
- Amounts are `bigint` at token precision; formatting is lossy and must not
  imply precision the chain does not have.
- Contract writes can fail or be rejected at the wallet. Every action needs a
  pending and a failed state.
- Contribution amounts must never be rendered, inferred, or aggregated into a
  visible figure while a sale is open. Leaking them defeats the product.

## Brand Commitments

- **Name:** norr.fun, always lowercase.
- **Wordmark:** heavy italic `NORR.FUN` with a cyan/magenta chromatic split over
  a white core; system heavy-condensed stack, no webfont. Already shipped.
- **Voice:** terse, factual, second person, no hype. Observed in shipped copy —
  "Nothing recorded yet.", "Lowercase, used in the URL. Permanent.", "Be the
  first. Deploying takes four signatures and about a minute." Sentences are
  short and state consequences plainly. No exclamation marks, no crypto slang,
  no promises about returns.
- **Naming:** product language is deliberately plain — "raises" not "launches",
  "desks" not "boards", "owed to you" not "claim fees".

## Anti-references

Directions this product must never drift into:

- purple/violet or cyan-on-black gradient fills as decoration;
- glassmorphism, frosted panels, generic drop shadows;
- Inter, Roboto, Geist, Plus Jakarta Sans, Space Grotesk, Fraunces;
- italic serif hero lines, numbered section labels ("01 — Features");
- cards nested inside cards; pulsing status dots;
- hero copy that promises outcomes a financial product cannot promise.

## Evidence on Hand

103 passing contract tests; a verified local end-to-end run (deploy → private
transfer → tally → claim → fee withdrawal); deployed artifacts under
`eerc-frontend/src/deployments/`. No production deployment, no users, no
traction claims. (assumed: still pre-launch — nothing in the repo indicates
mainnet use.)

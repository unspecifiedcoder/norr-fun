# 🌒 norr.fun - A Private IDO & Token Launch Platform using eERC

norr.fun is a platform for conducting private Initial DEX Offerings (IDOs). It leverages the power of the Encrypted ERC (eERC) system to allow investors to contribute funds privately. Contributor amounts are hidden on-chain during the sale, and a public token claim is enabled after the sale concludes.

## How norr.fun Works

The process is divided into three main phases:

1.  **Funding Phase (Private) 🕵️**: Investors convert a public ERC20 token (e.g., `TEST`) into its private eERC-20 equivalent. They then contribute these private tokens to the IDO's vault address. On-chain observers can see that a transfer occurred, but not the amount.
2.  **Tally Phase (Off-Chain) 🧮**: After the funding period ends, the project owner uses a secure key to decrypt the incoming private transfers. They tally the contributions, calculate the corresponding project token allocations, and build a Merkle tree of the final results.
3.  **Claim Phase (Public)  दावा**: The owner publishes the Merkle root on the `IDO` smart contract. This locks in the sale results. Investors can then use their Merkle proof to publicly claim their share of the new project token (`MPT`).

## Prerequisites

* Node.js and npm installed
* Private keys for testing (for a deployer/vault and at least two investors)
* Local Hardhat node or a configured testnet (like Fuji)

## Environment Setup

Create a `.env` file in the root directory:

```bash
# Local Hardhat Node RPC or Testnet RPC
RPC_URL=[http://127.0.0.1:8545/](http://127.0.0.1:8545/)

# Private keys for testing (without 0x prefix)
PRIVATE_KEY=your_deployer_and_vault_private_key
PRIVATE_KEY2=your_investor_one_private_key
PRIVATE_KEY3=your_investor_two_private_key

# The public address of the vault (must match the deployer for local testing)
VAULT_EOA=0xYourVaultAddress
```

## Installation

```bash
npm install
```

---

## 📋 Quick Start Guide

This guide walks through the entire process on a local Hardhat node.

### Part I: Core eERC-20 System Setup

First, deploy the underlying privacy infrastructure.

**1. Start Local Node**
Run this in a separate, dedicated terminal.
```bash
npx hardhat node
```

**2. Compile ZK Circuits**
This is a one-time setup step to compile the circuits.
```bash
npx hardhat zkit:compile
```

**3. Deploy Basic Components**
Deploys verifiers, libraries, and the underlying `TEST` token used for contributions.
```bash
npx hardhat run scripts/converter/01_deploy-basics.ts --network localhost
```

**4. Deploy Main Contracts**
Deploys the `Registrar` and `EncryptedERC` contracts.
```bash
npx hardhat run scripts/converter/02_deploy-converter.ts --network localhost
```

**5. Register Users**
Each participant (the vault and all investors) must register. Update your `.env` file with the correct `PRIVATE_KEY` for each user before running.
```bash
# Register Vault (using PRIVATE_KEY)
npx hardhat run scripts/converter/03_register-user.ts --network localhost

# Register Investor 1 (using PRIVATE_KEY2, update .env)
npx hardhat run scripts/converter/03_register-user.ts --network localhost
```

**6. Fund and Deposit**
Investors get public `TEST` tokens and deposit them to receive private tokens.
```bash
# Fund Investor 1 (ensure .env is set to their key)
npx hardhat run scripts/converter/05_get_faucet.ts --network localhost

# Investor 1 deposits their public tokens
npx hardhat run scripts/converter/06_deposit.ts --network localhost
```
*Repeat this step for all investors.*

---

## ⚡ Payout splits & the web UI

Raised proceeds are routed on-chain by `contracts/FeeRouter.sol` instead of
landing in a single vault EOA. A launch declares who earns what in basis
points (creator, distribution partner, rewards, marketing, buyback, liquidity,
treasury, custom); the allocations must total exactly 100%, recipients pull
their own share, and `lock()` freezes the table permanently so contributors
can verify the economics cannot be rewritten after the fact.

Both the payout split and the token claim are reachable from the web UI.

### Run the whole thing locally

No keys and no testnet funds required — the local node ships with funded,
publicly-known accounts.

```bash
npx hardhat node
```

```bash
npx hardhat run scripts/ido/05_deploy_fee_router.ts --network localhost
```

Deploys the contribution asset, `ProjectToken`, `FeeRouter` and `IDO`, then
writes the addresses to `eerc-frontend/src/deployments/launch-31337.json`,
which the frontend reads. Splits default to 60/25/15 and are overridable with
`SPLIT_CREATOR_BPS` / `SPLIT_PARTNER_BPS` / `SPLIT_TREASURY_BPS`.

```bash
npx hardhat run scripts/ido/08_setup_claims.ts --network localhost
```

Builds the Merkle tree from `scripts/ido/allocations.json`, publishes the
root, finalizes, funds the claim pool, and writes the proofs the UI uses.

```bash
npm --prefix eerc-frontend run dev
```

Then open `http://localhost:5173/?devwallet=1`. The `devwallet` flag installs
a development-only EIP-1193 provider that forwards to the local node and lets
it sign, so no browser extension is needed. Add `&account=N` to connect as a
different node account — `account=1` is the creator, who holds both a fee
allocation and a token claim. The flag is inert in production builds.

The UI uses client-side routing (`/raise/:sale`, `/u/:address`), so a static
host must rewrite unknown paths to `index.html` or deep links 404 on refresh.
`eerc-frontend/public/_redirects` covers Netlify and Cloudflare Pages; other
hosts need their own equivalent rule.

After changing a contract, regenerate the UI's ABIs:

```bash
npx hardhat compile && node scripts/gen-frontend-abis.js
```

---

### Part II: Running Your norr.fun IDO

With the core system live, you can now launch your IDO.

**1. Deploy IDO Contracts**
This deploys your `ProjectToken.sol` and `IDO.sol`.
```bash
npx hardhat run scripts/ido/01_deploy_ido.ts --network localhost
```
**➡️ Action:** Save the deployed `IDO` contract address from the output.

**2. Investors Contribute Privately**
Each investor runs the transfer script to send their private tokens to the vault.
```bash
# Example for Investor 1. Set their PRIVATE_KEY in .env.
# RECIPIENT_PK is the vault's public key from its .keys.json file.
RECIPIENT_PK=<VAULT_PUBLIC_KEY> AMOUNT=10 npx hardhat run scripts/converter/07_transfer.ts --network localhost
```

**3. Tally & Build Merkle Tree**
This is the off-chain step performed by the project owner.

1.  **Decrypt** the incoming transactions using the Go decryption tool.
2.  **Create** an allocation file: `scripts/ido/allocations.json`.
3.  **Run** the build script:
    ```bash
    npx hardhat run scripts/ido/02_build_merkle.ts
    ```
**➡️ Action:** Save the `MERKLE_ROOT` from the output.

**4. Finalize the IDO**
Lock the sale results on-chain.
```bash
IDO_ADDRESS=<YOUR_IDO_ADDRESS> \
MERKLE_ROOT=<YOUR_MERKLE_ROOT> \
npx hardhat run scripts/ido/03_finalize_ido.ts --network localhost
```

**5. Fund the IDO Contract**
Deposit the total amount of `MPT` to be claimed.
```bash
IDO_ADDRESS=<YOUR_IDO_ADDRESS> \
AMOUNT="1500.0" \
npx hardhat run scripts/ido/04_fund_ido.ts --network localhost
```

**6. Investors Claim Tokens**
This script claims tokens for all investors and verifies their final balances.
```bash
IDO_ADDRESS=<YOUR_IDO_ADDRESS> \
npx hardhat run scripts/ido/06_multi_claim_and_verify.ts --network localhost
```

**Congratulations! Your private norr.fun IDO is complete.**

---
## 📡 Deployments

Current live deployment of **norr.fun IDO** for `MPT` token:

- **Project Token (MPT)**: [`0xa4589D893d4Dc98d680337832b6a9593bF2fA9cd`](https://snowtrace.io/address/0xa4589D893d4Dc98d680337832b6a9593bF2fA9cd)  
- **IDO Contract**: [`0x24ea34EAffB7E17d02fe05fbF12351bCC670573b`](https://snowtrace.io/address/0x24ea34EAffB7E17d02fe05fbF12351bCC670573b)  
- **Vault EOA** (receiving encrypted TEST → allocations): `0xF6475Ba5D26Bd817afAc3ded9b8018bEaf7Acf9A`

---

## 🔧 Troubleshooting

* **"User not registered"**: Ensure you have run `scripts/converter/03_register-user.ts` for the wallet address in question.
* **"Error: ENOENT: no such file or directory, open 'scripts/ido/allocations.json'"**: You must manually create the `allocations.json` file before running the Merkle tree builder script use `scripts/converter/10_decryptor.ts` to take create the file from the transactions recieved privately .
* **"ProviderError: ... reverted with ... NothingToClaim()"**: This error is expected if you try to run the claim script for the same user more than once. A user can only claim their allocation a single time.
* **"Invalid Merkle Proof"**: This means the proof provided does not match the Merkle root stored on-chain. Ensure you are using the correct `MERKLE_ROOT` when finalizing and that your `allocations.json` file is correct.

## 🧪 Test Checklist

- Register vault + contributors  
- Contributors → deposit + private transfer to vault  
- Auditor decrypts vault → builds allocation map  
- Build Merkle tree → push root → finalize  
- Deposit project tokens into IDO  
- Users claim successfully  

---

## 📂 Structure

- `contracts/IDO.sol` — Merkle-based claim contract  
- `contracts/ProjectToken.sol` — simple ERC20 (MPT)  
- `scripts/converter/*` — eERC setup + transfers  
- `scripts/ido/*` — deploy, finalize, fund, claim  

---

## ⚠️ Notes & Caveats

- The current frontend (`eerc-frontend/`) integrates with the `@avalabs/eerc-sdk`.  
  However, we faced several compatibility issues with this SDK in a browser environment:
  - Missing Node.js polyfills (`Buffer`, `process`, `util`) required for the SDK.
  - Vite bundling errors due to `esbuild` not fully supporting Node core modules.
  - React and dependency version mismatches (React 19.x vs peer deps expecting 18.x).
  - Occasional silent failures when calling `useEncryptedBalance()` (no logs, no errors).

- As a result, **the frontend may not fully function with the SDK out of the box**.  
  We had to add polyfills (`buffer`, `process`, `util`) and monkey-patch `vite.config.ts` to get it partially running.

- If you plan to use the frontend:
  1. Make sure you are on **Node.js v20.19+** (required by Vite 7.x).  
  2. Install missing polyfills:  
     ```bash
     npm install buffer process util
     ```
  3. Adjust your `vite.config.ts` to alias Node core modules:
     ```ts
     resolve: {
       alias: {
         util: "util/",
         process: "process/browser",
         buffer: "buffer",
       },
     },
     ```
  4. Be prepared to debug and patch SDK/browser compatibility issues.

- In practice, we recommend focusing on the **Hardhat scripts** for reliable testing and using the frontend primarily as a **demo UI**, unless further SDK/browser compatibility work is done.

🔥 Hardcore mode: run full e2e on localhost, then push to Fuji / mainnet when ready. No excuses.

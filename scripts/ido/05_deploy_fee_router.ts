import { ethers } from "hardhat";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Deploys a complete norr.fun launch and writes the addresses where the
 * frontend can read them.
 *
 * A launch is four contracts:
 *   - SimpleERC20  the contribution asset (what investors pay in)
 *   - ProjectToken the asset being sold (MPT)
 *   - FeeRouter    programmable split of the raised contribution asset
 *   - IDO          Merkle-based claim of the project token
 *
 * Splits default to 60/25/15 creator/partner/treasury and are overridable
 * with SPLIT_CREATOR_BPS / SPLIT_PARTNER_BPS / SPLIT_TREASURY_BPS. They must
 * total 10000 or FeeRouter's constructor reverts.
 *
 * Usage:
 *   npx hardhat run scripts/ido/05_deploy_fee_router.ts --network localhost
 */

enum Category {
  Creator,
  Partner,
  Rewards,
  Marketing,
  Buyback,
  Liquidity,
  Treasury,
  Custom,
}

const bpsFromEnv = (name: string, fallback: bigint): bigint => {
  const raw = process.env[name];
  return raw && raw.trim().length > 0 ? BigInt(raw) : fallback;
};

async function main() {
  const signers = await ethers.getSigners();
  const [deployer] = signers;

  // Distinct recipients so the split is observable end-to-end. Falls back to
  // the deployer on networks that expose only one account.
  const creator = signers[1] ?? deployer;
  const partner = signers[2] ?? deployer;
  const treasury = signers[3] ?? deployer;

  const network = await ethers.provider.getNetwork();
  console.log(`Deploying norr.fun launch to chainId ${network.chainId}`);
  console.log(`Deployer: ${deployer.address}\n`);

  // --- contribution asset ---
  const contributionAsset = await (
    await ethers.getContractFactory("SimpleERC20")
  ).deploy("AvaxTest", "AVAXTEST", 18);
  await contributionAsset.waitForDeployment();
  const contributionAddress = await contributionAsset.getAddress();
  console.log(`SimpleERC20 (contribution asset): ${contributionAddress}`);

  await (
    await contributionAsset.mint(deployer.address, ethers.parseEther("100000"))
  ).wait();
  console.log("  minted 100000 AVAXTEST to deployer");

  // --- project token ---
  const projectSupply = ethers.parseUnits("1000000", 18);
  const projectToken = await (
    await ethers.getContractFactory("ProjectToken")
  ).deploy(projectSupply);
  await projectToken.waitForDeployment();
  const projectTokenAddress = await projectToken.getAddress();
  console.log(`ProjectToken (MPT): ${projectTokenAddress}`);

  // --- fee router ---
  const splits = [
    {
      recipient: creator.address,
      bps: bpsFromEnv("SPLIT_CREATOR_BPS", 6000n),
      category: Category.Creator,
      label: "Creator revenue",
    },
    {
      recipient: partner.address,
      bps: bpsFromEnv("SPLIT_PARTNER_BPS", 2500n),
      category: Category.Partner,
      label: "Distribution partner",
    },
    {
      recipient: treasury.address,
      bps: bpsFromEnv("SPLIT_TREASURY_BPS", 1500n),
      category: Category.Treasury,
      label: "Treasury",
    },
  ];

  const totalBps = splits.reduce((sum, s) => sum + s.bps, 0n);
  if (totalBps !== 10000n) {
    throw new Error(`Splits must total 10000 bps, got ${totalBps}`);
  }

  const feeRouter = await (
    await ethers.getContractFactory("FeeRouter")
  ).deploy(contributionAddress, deployer.address, splits);
  await feeRouter.waitForDeployment();
  const feeRouterAddress = await feeRouter.getAddress();
  console.log(`FeeRouter: ${feeRouterAddress}`);
  for (const s of splits) {
    console.log(`  ${s.label}: ${Number(s.bps) / 100}% -> ${s.recipient}`);
  }

  // --- IDO ---
  // Open immediately, no end time, so the claim path is exercisable as soon
  // as a root is published.
  const start = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
  const ido = await (
    await ethers.getContractFactory("IDO")
  ).deploy(projectTokenAddress, feeRouterAddress, start, 0n);
  await ido.waitForDeployment();
  const idoAddress = await ido.getAddress();
  console.log(`IDO: ${idoAddress}`);

  // --- persist for the frontend ---
  const deployment = {
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contributionAsset: contributionAddress,
    projectToken: projectTokenAddress,
    feeRouter: feeRouterAddress,
    ido: idoAddress,
    splits: splits.map((s) => ({
      recipient: s.recipient,
      bps: Number(s.bps),
      category: Category[s.category],
      label: s.label,
    })),
  };

  const outDir = join(__dirname, "../../eerc-frontend/src/deployments");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `launch-${network.chainId}.json`);
  writeFileSync(outPath, `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`\nWrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

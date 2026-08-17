import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

/**
 * Opens the public trading phase for the seed launch: deploys a BondingCurve,
 * stocks it with project tokens, and records it for the frontend.
 *
 * This runs *after* the sale settles. The sealed contribution round is
 * unaffected -- contributors' amounts stay private in the eERC layer; this is
 * the public market for the token that was already distributed.
 *
 * Usage:
 *   npx hardhat run scripts/ido/10_open_market.ts --network localhost
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();

  const dir = path.join(__dirname, "../../eerc-frontend/src/deployments");
  const launch = JSON.parse(fs.readFileSync(path.join(dir, `launch-${chainId}.json`), "utf8"));

  const token = await ethers.getContractAt("ProjectToken", launch.projectToken);
  const base = await ethers.getContractAt("SimpleERC20", launch.contributionAsset);

  const curveSupply = ethers.parseUnits("800000", 18);
  const virtualBase = ethers.parseUnits("30", 18);
  const target = ethers.parseUnits("100", 18);
  const feeBps = 100; // 1%, routed through the launch's existing split

  const curve = await (
    await ethers.getContractFactory("BondingCurve")
  ).deploy(
    launch.projectToken,
    launch.contributionAsset,
    launch.feeRouter,
    virtualBase,
    curveSupply,
    target,
    feeBps,
    deployer.address,
  );
  await curve.waitForDeployment();
  const address = await curve.getAddress();

  await (await token.transfer(address, curveSupply)).wait();

  console.log(`BondingCurve: ${address}`);
  console.log(`  stocked with ${ethers.formatEther(curveSupply)} ${await token.symbol()}`);
  console.log(`  opening price ${ethers.formatEther(await curve.priceX18())} ${await base.symbol()}/token`);
  console.log(`  graduates at ${ethers.formatEther(target)} ${await base.symbol()}`);
  console.log(`  ${feeBps / 100}% of every trade routes through ${launch.feeRouter}`);

  const outPath = path.join(dir, `market-${chainId}.json`);
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        chainId: Number(chainId),
        // Keyed by sale contract: a launch has at most one market.
        markets: { [launch.ido]: address },
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

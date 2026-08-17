import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

/**
 * Deploys LaunchRegistry and records its address for the frontend, then
 * back-registers any launch already described by a launch-<chainId>.json
 * artifact so the feed is not empty on a fresh chain.
 *
 * Usage:
 *   npx hardhat run scripts/ido/09_deploy_registry.ts --network localhost
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();

  const registry = await (await ethers.getContractFactory("LaunchRegistry")).deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`LaunchRegistry: ${address} (chain ${chainId})`);

  const deploymentsDir = path.join(__dirname, "../../eerc-frontend/src/deployments");
  const launchPath = path.join(deploymentsDir, `launch-${chainId}.json`);

  if (fs.existsSync(launchPath)) {
    const launch = JSON.parse(fs.readFileSync(launchPath, "utf8"));
    const token = await ethers.getContractAt("ProjectToken", launch.projectToken);

    await (
      await registry.register(
        launch.projectToken,
        launch.ido,
        launch.feeRouter,
        launch.contributionAsset,
        await token.name(),
        await token.symbol(),
        "Seed launch deployed by scripts/ido/05_deploy_fee_router.ts",
      )
    ).wait();
    console.log(`Back-registered existing launch ${launch.ido}`);
  }

  const outPath = path.join(deploymentsDir, `registry-${chainId}.json`);
  fs.writeFileSync(
    outPath,
    `${JSON.stringify({ chainId: Number(chainId), address, deployer: deployer.address }, null, 2)}\n`,
  );
  console.log(`Wrote ${outPath}`);
  console.log(`Registry now holds ${await registry.count()} launch(es)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

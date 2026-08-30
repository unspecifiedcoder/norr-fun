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

  const boards = await (await ethers.getContractFactory("BoardRegistry")).deploy();
  await boards.waitForDeployment();
  const boardsAddress = await boards.getAddress();
  console.log(`BoardRegistry:  ${boardsAddress} (chain ${chainId})`);

  const comments = await (await ethers.getContractFactory("LaunchComments")).deploy();
  await comments.waitForDeployment();
  const commentsAddress = await comments.getAddress();
  console.log(`LaunchComments: ${commentsAddress}`);

  const social = await (await ethers.getContractFactory("SocialGraph")).deploy();
  await social.waitForDeployment();
  const socialAddress = await social.getAddress();
  console.log(`SocialGraph:    ${socialAddress}`);

  const promotion = await (
    await ethers.getContractFactory("Promotion")
  ).deploy(deployer.address);
  await promotion.waitForDeployment();
  const promotionAddress = await promotion.getAddress();
  await (await promotion.addTier("Boosted", ethers.parseEther("0.05"), 86_400)).wait();
  await (await promotion.addTier("Headline", ethers.parseEther("0.2"), 604_800)).wait();
  console.log(`Promotion:      ${promotionAddress} (2 paid tiers)`);

  const routerFactory = await (
    await ethers.getContractFactory("FeeRouterFactory")
  ).deploy();
  await routerFactory.waitForDeployment();
  const routerFactoryAddress = await routerFactory.getAddress();
  console.log(`FeeRouterFactory: ${routerFactoryAddress}`);

  const registry = await (
    await ethers.getContractFactory("LaunchRegistry")
  ).deploy(boardsAddress, routerFactoryAddress);
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`LaunchRegistry: ${address}`);

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
        0, // seed launch is not published under a board
        {
          name: await token.name(),
          symbol: await token.symbol(),
          description: "Seed launch deployed by scripts/ido/05_deploy_fee_router.ts",
          logoURI: "",
        },
      )
    ).wait();
    console.log(`Back-registered existing launch ${launch.ido}`);
  }

  const outPath = path.join(deploymentsDir, `registry-${chainId}.json`);
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        chainId: Number(chainId),
        address,
        boards: boardsAddress,
        comments: commentsAddress,
        social: socialAddress,
        promotion: promotionAddress,
        deployer: deployer.address,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote ${outPath}`);
  console.log(`Registry now holds ${await registry.count()} launch(es)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

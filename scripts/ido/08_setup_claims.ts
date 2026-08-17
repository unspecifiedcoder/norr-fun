import fs from "fs";
import path from "path";
import { ethers } from "hardhat";
import { keccak256, solidityPacked, getAddress } from "ethers";
import { MerkleTree } from "merkletreejs";

/**
 * Publishes the sale result for the launch deployed by 05_deploy_fee_router.ts:
 * builds the Merkle tree from allocations.json, sets the root, finalizes, funds
 * the IDO with the project token, and writes the proofs where the frontend can
 * read them.
 *
 * Leaf format matches IDO._leaf exactly:
 *   keccak256(abi.encodePacked(address, uint256))
 * with sorted pairs, matching the contract's order-independent _verify.
 *
 * Usage:
 *   npx hardhat run scripts/ido/08_setup_claims.ts --network localhost
 */

const leafHash = (address: string, allocationWei: bigint) =>
  keccak256(solidityPacked(["address", "uint256"], [address, allocationWei]));

async function main() {
  const launchPath = path.join(
    __dirname,
    "../../eerc-frontend/src/deployments/launch-31337.json",
  );
  const launch = JSON.parse(fs.readFileSync(launchPath, "utf8"));

  const [deployer] = await ethers.getSigners();
  const ido = await ethers.getContractAt("IDO", launch.ido);
  const projectToken = await ethers.getContractAt("ProjectToken", launch.projectToken);

  const allocations = JSON.parse(
    fs.readFileSync(path.join(__dirname, "allocations.json"), "utf8"),
  ) as { address: string; allocation: string }[];

  const entries = allocations.map((row) => {
    const address = getAddress(row.address);
    const allocationWei = ethers.parseEther(row.allocation.toString());
    return { address, allocationWei, leaf: leafHash(address, allocationWei) };
  });

  const tree = new MerkleTree(
    entries.map((e) => e.leaf),
    keccak256,
    { sortPairs: true },
  );
  const root = tree.getHexRoot();
  console.log(`Merkle root: ${root}`);

  // --- publish the result on-chain ---
  if ((await ido.merkleRoot()) !== root) {
    await (await ido.setMerkleRoot(root)).wait();
    console.log("Root published");
  }
  if (!(await ido.finalized())) {
    await (await ido.finalize()).wait();
    console.log("IDO finalized");
  }

  // --- fund the claim pool ---
  const totalOwed = entries.reduce((sum, e) => sum + e.allocationWei, 0n);
  const funded = await projectToken.balanceOf(launch.ido);
  if (funded < totalOwed) {
    const shortfall = totalOwed - funded;
    await (await projectToken.approve(launch.ido, shortfall)).wait();
    await (await ido.depositProjectTokens(shortfall)).wait();
    console.log(`Funded IDO with ${ethers.formatEther(shortfall)} MPT`);
  }

  // --- persist proofs for the frontend ---
  const proofs: Record<string, { allocationWei: string; proof: string[] }> = {};
  entries.forEach((e, i) => {
    proofs[e.address] = {
      allocationWei: e.allocationWei.toString(),
      proof: tree.getHexProof(entries[i].leaf),
    };
  });

  const outPath = path.join(
    __dirname,
    "../../eerc-frontend/src/deployments/proofs-31337.json",
  );
  fs.writeFileSync(
    outPath,
    `${JSON.stringify({ root, totalOwed: totalOwed.toString(), proofs }, null, 2)}\n`,
  );
  console.log(`Wrote ${outPath}`);

  console.log(`\nDeployer: ${deployer.address}`);
  console.log(`IDO ${launch.ido} holds ${ethers.formatEther(await projectToken.balanceOf(launch.ido))} MPT`);
  console.log(`Claimants: ${entries.length}, total owed ${ethers.formatEther(totalOwed)} MPT`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

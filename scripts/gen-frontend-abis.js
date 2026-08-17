/**
 * Emits the frontend's contract ABIs from Hardhat's compiled artifacts.
 *
 * The frontend talks to chain via wagmi/viem, which wants plain `as const` ABI
 * arrays rather than the ethers-based typechain factories. Generating them keeps
 * the UI's ABIs from drifting out of sync with the contracts.
 *
 * Usage: npx hardhat compile && node scripts/gen-frontend-abis.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "eerc-frontend/src/contracts/abis.ts");

const SOURCES = {
  feeRouterAbi: "artifacts/contracts/FeeRouter.sol/FeeRouter.json",
  idoAbi: "artifacts/contracts/IDO.sol/IDO.json",
  erc20Abi: "artifacts/contracts/tokens/SimpleERC20.sol/SimpleERC20.json",
};

const abiOf = (relative) => {
  const artifact = path.join(ROOT, relative);
  if (!fs.existsSync(artifact)) {
    throw new Error(`Missing artifact ${relative} -- run "npx hardhat compile" first`);
  }
  return JSON.parse(fs.readFileSync(artifact, "utf8")).abi;
};

const banner = `// Generated from compiled artifacts by scripts/gen-frontend-abis.js.
// Do not edit by hand -- rerun the script after changing a contract.
`;

const body = Object.entries(SOURCES)
  .map(([name, rel]) => `export const ${name} = ${JSON.stringify(abiOf(rel), null, 2)} as const;`)
  .join("\n\n");

fs.writeFileSync(OUT, `${banner}\n${body}\n`);
console.log(`Wrote ${path.relative(ROOT, OUT)}`);

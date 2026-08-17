import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@solarity/chai-zkit";
import "@solarity/hardhat-zkit";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import "solidity-coverage";

import dotenv from "dotenv";
dotenv.config();

const RPC_URL = process.env.RPC_URL || "https://api.avax.network/ext/bc/C/rpc";

/**
 * Collect signing keys from the environment, tolerating absent/blank entries.
 *
 * Hardhat validates `networks.*.accounts` at config-load time, so a blank
 * PRIVATE_KEY used to abort every task -- including `compile` and `test`, which
 * never touch Fuji. Filtering here keeps local work possible with no keys set.
 * Accepts PRIVATE_KEY_2 and the PRIVATE_KEY2 spelling used by the run scripts.
 */
const fujiAccounts = [
  process.env.PRIVATE_KEY,
  process.env.PRIVATE_KEY_2 || process.env.PRIVATE_KEY2,
  process.env.PRIVATE_KEY_3 || process.env.PRIVATE_KEY3,
]
  .filter((key): key is string => !!key && key.trim().length > 0)
  .map((key) => (key.startsWith("0x") ? key : `0x${key}`));

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: RPC_URL,
        blockNumber: 59121339,
        enabled: !!process.env.FORKING,
      },
    },
    fuji: {
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      chainId: 43113,
      accounts: fujiAccounts,
    },
  },
  gasReporter: {
    enabled: !!process.env.REPORT_GAS,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    excludeContracts: ["contracts/mocks/"],
    outputFile: "gas-report.txt",
    L1: "avalanche",
    showMethodSig: true,
  },
  zkit: {
    compilerVersion: "2.1.9",
    circuitsDir: "circom",
    compilationSettings: {
      artifactsDir: "zkit/artifacts",
      onlyFiles: [],
      skipFiles: [],
      c: false,
      json: false,
      optimization: "O2",
    },
    setupSettings: {
      contributionSettings: {
        provingSystem: "groth16",
        contributions: 0,
      },
      onlyFiles: [],
      skipFiles: [],
      ptauDir: undefined,
      ptauDownload: true,
    },
    verifiersSettings: {
      verifiersDir: "contracts/verifiers",
      verifiersType: "sol",
    },
    typesDir: "generated-types/zkit",
    quiet: false,
  },
};

export default config;

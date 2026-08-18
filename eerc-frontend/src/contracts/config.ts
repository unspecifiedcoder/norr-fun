import { IDO__factory, ProjectToken__factory } from "../typechain-types";
import localLaunch from "../deployments/launch-31337.json";
import localRegistry from "../deployments/registry-31337.json";
import localEerc from "../deployments/eerc-31337.json";

export type LaunchSplit = {
  recipient: string;
  bps: number;
  category: string;
  label: string;
};

export type LaunchDeployment = {
  chainId: number;
  deployedAt: string;
  deployer: string;
  contributionAsset: string;
  projectToken: string;
  feeRouter: string;
  ido: string;
  splits: LaunchSplit[];
};

/**
 * Deployed launches keyed by chain id, written by
 * scripts/ido/05_deploy_fee_router.ts.
 *
 * Addresses used to be hardcoded here and went stale the moment anything was
 * redeployed; reading the deployment artifacts keeps the UI pointed at whatever
 * actually exists on the connected chain.
 */
export const LAUNCHES: Record<number, LaunchDeployment> = {
  [localLaunch.chainId]: localLaunch as LaunchDeployment,
};

export const getLaunch = (chainId?: number): LaunchDeployment | undefined =>
  chainId === undefined ? undefined : LAUNCHES[chainId];

export const SUPPORTED_LAUNCH_CHAIN_IDS = Object.keys(LAUNCHES).map(Number);

export type RegistryDeployment = {
  chainId: number;
  /** LaunchRegistry */
  address: string;
  /** BoardRegistry */
  boards: string;
  /** LaunchComments */
  comments: string;
  /** SocialGraph */
  social: string;
  /** Promotion */
  promotion: string;
  deployer: string;
};

/** LaunchRegistry per chain, written by scripts/ido/09_deploy_registry.ts. */
export const REGISTRIES: Record<number, RegistryDeployment> = {
  [localRegistry.chainId]: localRegistry as RegistryDeployment,
};

export const getRegistry = (chainId?: number): RegistryDeployment | undefined =>
  chainId === undefined ? undefined : REGISTRIES[chainId];

export type EercDeployment = {
  chainId: number;
  /** EncryptedERC — the sealed-balance token. */
  encryptedERC: string;
  /** Registrar — holds each participant's public key. */
  registrar: string;
  /** The public ERC20 that converts into the encrypted one. */
  erc20: string;
  isConverter: boolean;
  decimals: number;
  symbol: string;
};

/**
 * The sealed-balance layer per chain.
 *
 * Read from a deployment artifact for the same reason every other address is:
 * the privacy contracts were previously reachable only by pasting an address
 * into a text field, which meant the one flow the product exists for could not
 * be started by anyone who did not already know where it lived.
 */
export const EERC: Record<number, EercDeployment> = {
  [localEerc.chainId]: localEerc as EercDeployment,
};

export const getEerc = (chainId?: number): EercDeployment | undefined =>
  chainId === undefined ? undefined : EERC[chainId];

// --- legacy ethers/typechain helpers, kept for the existing script-based flow ---

export function getIDOContract(address: string, signerOrProvider: any) {
  return IDO__factory.connect(address, signerOrProvider);
}

export function getProjectTokenContract(address: string, signerOrProvider: any) {
  return ProjectToken__factory.connect(address, signerOrProvider);
}

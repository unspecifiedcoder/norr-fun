import { avalancheFuji, hardhat } from "wagmi/chains";

/**
 * URL slug to chain id, and back.
 *
 * Slugs are what appear in a shared link and are stable; ids are the wire
 * value. Kept out of ChainGuard so that file exports only a component --
 * mixing constants into a component module breaks fast refresh for every
 * screen that imports it.
 */
export const CHAIN_SLUGS: Record<string, number> = {
  fuji: avalancheFuji.id,
  local: hardhat.id,
};

export const slugForChain = (id: number): string =>
  Object.entries(CHAIN_SLUGS).find(([, v]) => v === id)?.[0] ?? String(id);

import { useChainId, useReadContract } from "wagmi";
import { launchRegistryAbi } from "../contracts/abis";
import { getRegistry } from "../contracts/config";
import type { RegistryLaunch } from "./useRegistryFeed";

/**
 * Raises published under one board.
 *
 * Uses the registry's per-board index rather than filtering the global feed
 * client-side, so a busy protocol does not force every client to download
 * every raise to render one desk.
 */
export function useBoardFeed(boardId?: bigint) {
  const chainId = useChainId();
  const registry = getRegistry(chainId);

  const { data } = useReadContract({
    address: registry?.address as `0x${string}` | undefined,
    abi: launchRegistryAbi,
    functionName: "pageByBoard",
    args: [boardId ?? 0n, 0n, 50n],
    query: { enabled: !!registry && boardId !== undefined && boardId > 0n },
  });

  const [items, total] = (data as [RegistryLaunch[], bigint] | undefined) ?? [[], 0n];

  return { rows: items ?? [], total: Number(total) };
}

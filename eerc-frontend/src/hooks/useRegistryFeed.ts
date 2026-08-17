import { useMemo } from "react";
import { useChainId, useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { erc20Abi, feeRouterAbi, idoAbi, launchRegistryAbi } from "../contracts/abis";
import { getRegistry } from "../contracts/config";

export type RegistryLaunch = {
  projectToken: string;
  ido: string;
  feeRouter: string;
  contributionAsset: string;
  creator: string;
  createdAt: bigint;
  name: string;
  symbol: string;
  description: string;
};

export type FeedRow = {
  launch: RegistryLaunch;
  raised: bigint;
  distributed: bigint;
  finalized: boolean;
  locked: boolean;
  splitCount: number;
  assetSymbol: string;
  decimals: number;
  format: (v: bigint) => string;
};

export type FeedSort = "newest" | "raised" | "active";

export const SORTS: { key: FeedSort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "raised", label: "Most raised" },
  { key: "active", label: "Still open" },
];

/**
 * The launch feed, read from LaunchRegistry and enriched with live contract
 * state. Sorting happens client-side over the fetched page: the registry
 * returns newest-first, and re-ranking a page of tens is not worth an
 * on-chain index.
 */
export function useRegistryFeed(sort: FeedSort = "newest", pageSize = 25) {
  const chainId = useChainId();
  const registry = getRegistry(chainId);

  const { data: pageData, refetch } = useReadContract({
    address: registry?.address as `0x${string}` | undefined,
    abi: launchRegistryAbi,
    functionName: "page",
    args: [0n, BigInt(pageSize)],
    query: { enabled: !!registry },
  });

  const launches = useMemo(
    () => ((pageData as [RegistryLaunch[], bigint] | undefined)?.[0] ?? []),
    [pageData],
  );
  const total = (pageData as [RegistryLaunch[], bigint] | undefined)?.[1] ?? 0n;

  const { data: live } = useReadContracts({
    contracts: launches.flatMap((l) => [
      { address: l.feeRouter as `0x${string}`, abi: feeRouterAbi, functionName: "totalReceived" as const },
      { address: l.feeRouter as `0x${string}`, abi: feeRouterAbi, functionName: "totalReleased" as const },
      { address: l.feeRouter as `0x${string}`, abi: feeRouterAbi, functionName: "locked" as const },
      { address: l.feeRouter as `0x${string}`, abi: feeRouterAbi, functionName: "splitCount" as const },
      { address: l.ido as `0x${string}`, abi: idoAbi, functionName: "finalized" as const },
      { address: l.contributionAsset as `0x${string}`, abi: erc20Abi, functionName: "symbol" as const },
      { address: l.contributionAsset as `0x${string}`, abi: erc20Abi, functionName: "decimals" as const },
    ]),
    query: { enabled: launches.length > 0 },
  });

  const rows: FeedRow[] = useMemo(() => {
    const built = launches.map((launch, i) => {
      const b = i * 7;
      const read = <T,>(o: number) => live?.[b + o]?.result as T | undefined;
      const decimals = read<number>(6) ?? 18;
      return {
        launch,
        raised: read<bigint>(0) ?? 0n,
        distributed: read<bigint>(1) ?? 0n,
        locked: read<boolean>(2) ?? false,
        splitCount: Number(read<bigint>(3) ?? 0n),
        finalized: read<boolean>(4) ?? false,
        assetSymbol: read<string>(5) ?? "",
        decimals,
        format: (v: bigint) => formatUnits(v, decimals),
      };
    });

    if (sort === "raised") {
      return [...built].sort((a, b) => (b.raised > a.raised ? 1 : b.raised < a.raised ? -1 : 0));
    }
    if (sort === "active") {
      // Open sales first, each group still newest-first from the registry.
      return [...built].sort((a, b) => Number(a.finalized) - Number(b.finalized));
    }
    return built;
  }, [launches, live, sort]);

  return { rows, total: Number(total), hasRegistry: !!registry, chainId, refetch };
}

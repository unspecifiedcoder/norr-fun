import { useMemo } from "react";
import { useChainId, useReadContract, useReadContracts } from "wagmi";
import { feeRouterAbi, launchRegistryAbi } from "../contracts/abis";
import { getRegistry, type LaunchSplit } from "../contracts/config";
import type { RegistryLaunch } from "./useRegistryFeed";

/**
 * Resolves a single launch from its sale address, as arrives in the URL.
 *
 * Reads the registry rather than a bundled artifact so a link to any launch
 * resolves, including ones created after this build shipped. The split table
 * is read back off the FeeRouter itself, since the registry stores only
 * identity metadata.
 */
export function useLaunchByIdo(ido?: string) {
  const chainId = useChainId();
  const registry = getRegistry(chainId);

  // The registry has no address index, and adding one costs gas on every
  // register for a lookup that is rare. A page scan is cheap in comparison.
  const { data: pageData, isLoading: loadingPage } = useReadContract({
    address: registry?.address as `0x${string}` | undefined,
    abi: launchRegistryAbi,
    functionName: "page",
    args: [0n, 200n],
    query: { enabled: !!registry },
  });

  const launch = useMemo(() => {
    if (!ido) return undefined;
    const list = (pageData as [RegistryLaunch[], bigint] | undefined)?.[0] ?? [];
    return list.find((l) => l.ido.toLowerCase() === ido.toLowerCase());
  }, [pageData, ido]);

  const { data: splitData, isLoading: loadingSplits } = useReadContracts({
    contracts: launch
      ? [
          {
            address: launch.feeRouter as `0x${string}`,
            abi: feeRouterAbi,
            functionName: "splits" as const,
          },
        ]
      : [],
    query: { enabled: !!launch },
  });

  const CATEGORY_NAMES = [
    "Creator", "Partner", "Rewards", "Marketing",
    "Buyback", "Liquidity", "Treasury", "Custom",
  ];

  const splits: LaunchSplit[] = useMemo(() => {
    const raw = splitData?.[0]?.result as
      | readonly { recipient: string; bps: bigint; category: number; label: string }[]
      | undefined;
    return (raw ?? []).map((s) => ({
      recipient: s.recipient,
      bps: Number(s.bps),
      category: CATEGORY_NAMES[Number(s.category)] ?? "Custom",
      label: s.label,
    }));
  }, [splitData]);

  return {
    launch,
    splits,
    chainId,
    hasRegistry: !!registry,
    loading: loadingPage || loadingSplits,
    notFound: !!registry && !loadingPage && !!ido && !launch,
  };
}

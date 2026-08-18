import { useMemo } from "react";
import { useChainId, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { boardRegistryAbi } from "../contracts/abis";
import { getRegistry } from "../contracts/config";
import { useRegistryFeed } from "./useRegistryFeed";

/**
 * Protocol-wide totals for the masthead.
 *
 * Derived from the same reads the feed already makes, so showing them costs no
 * extra round-trips. Every figure is summed from chain state -- there is no
 * separate analytics source that could drift from what the contracts say.
 */
export function useProtocolStats() {
  const chainId = useChainId();
  const registry = getRegistry(chainId);
  const feed = useRegistryFeed("newest", 100);

  const { data: deskCount } = useReadContract({
    address: registry?.boards as `0x${string}` | undefined,
    abi: boardRegistryAbi,
    functionName: "count",
    query: { enabled: !!registry },
  });

  return useMemo(() => {
    const raised = feed.rows.reduce((sum, r) => sum + r.raised, 0n);
    const distributed = feed.rows.reduce((sum, r) => sum + r.distributed, 0n);
    const open = feed.rows.filter((r) => !r.finalized).length;
    const symbol = feed.rows[0]?.assetSymbol ?? "";
    const decimals = feed.rows[0]?.decimals ?? 18;

    const compact = (v: bigint) => {
      const n = Number(formatUnits(v, decimals));
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
      return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
    };

    return {
      raises: feed.rows.length,
      open,
      desks: Number((deskCount as bigint | undefined) ?? 0n),
      raised,
      distributed,
      symbol,
      compact,
      hasRegistry: feed.hasRegistry,
      chainId,
    };
  }, [feed.rows, feed.hasRegistry, deskCount, chainId]);
}

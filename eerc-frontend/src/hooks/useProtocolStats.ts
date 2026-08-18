import { useMemo } from "react";
import { useChainId } from "wagmi";
import { formatUnits } from "viem";
import { useRegistryFeed } from "./useRegistryFeed";
import { useBoards } from "./useBoards";

/**
 * Protocol-wide totals for the masthead.
 *
 * Derived from the same reads the feed already makes, so showing them costs no
 * extra round-trips. Every figure is summed from chain state -- there is no
 * separate analytics source that could drift from what the contracts say.
 */
export function useProtocolStats() {
  const chainId = useChainId();
  const feed = useRegistryFeed("newest", 100);

  // Counted from the same read the rail's desk index uses, rather than a
  // separate count() call. Two sources meant the rail could list a desk the
  // figure beside it had not counted yet.
  const boards = useBoards();

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
      desks: boards.boards.length,
      raised,
      distributed,
      symbol,
      compact,
      hasRegistry: feed.hasRegistry,
      chainId,
    };
  }, [feed.rows, feed.hasRegistry, boards.boards.length, chainId]);
}

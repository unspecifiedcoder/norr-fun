import { useMemo } from "react";
import { useAccount, useChainId, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { erc20Abi, feeRouterAbi, socialGraphAbi } from "../contracts/abis";
import { getRegistry } from "../contracts/config";
import { useRegistryFeed } from "./useRegistryFeed";

/**
 * Everything this wallet holds, is owed, or is watching — in one read.
 *
 * The app could already answer each of these questions one raise at a time.
 * Nobody thinks that way: a returning user wants to know where they stand
 * across the protocol, and assembling that by visiting every launch is the
 * kind of work an interface is supposed to do for you.
 *
 * One multicall over the feed rather than a hook per raise: four reads per
 * launch, issued together, so the page settles in a single round-trip rather
 * than a cascade.
 */
export function usePortfolio() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const feed = useRegistryFeed("newest", 100);
  const social = getRegistry(chainId)?.social as `0x${string}` | undefined;

  const me = (address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

  const { data } = useReadContracts({
    contracts: feed.rows.flatMap((r) => [
      {
        address: r.launch.projectToken as `0x${string}`,
        abi: erc20Abi,
        functionName: "balanceOf" as const,
        args: [me],
      },
      {
        address: r.launch.feeRouter as `0x${string}`,
        abi: feeRouterAbi,
        functionName: "releasable" as const,
        args: [me],
      },
      {
        address: r.launch.feeRouter as `0x${string}`,
        abi: feeRouterAbi,
        functionName: "released" as const,
        args: [me],
      },
      ...(social
        ? [
            {
              address: social,
              abi: socialGraphAbi,
              functionName: "saved" as const,
              args: [me, r.launch.ido as `0x${string}`],
            },
          ]
        : []),
    ]),
    query: { enabled: feed.rows.length > 0 && !!address },
  });

  const stride = social ? 4 : 3;

  return useMemo(() => {
    const positions = feed.rows.map((r, i) => {
      const base = i * stride;
      const read = <T,>(o: number) => data?.[base + o]?.result as T | undefined;
      const held = read<bigint>(0) ?? 0n;
      const owed = read<bigint>(1) ?? 0n;
      const taken = read<bigint>(2) ?? 0n;
      return {
        row: r,
        /** Project tokens this wallet holds. */
        held,
        /** Fees released to this wallet but not yet withdrawn. */
        owed,
        /** Fees already withdrawn. */
        taken,
        watched: social ? (read<boolean>(3) ?? false) : false,
        holds: held > 0n,
        earns: owed > 0n || taken > 0n,
      };
    });

    const asNumber = (v: bigint) => Number(formatUnits(v, 18));

    return {
      isConnected,
      address,
      loading: feed.isLoading,
      hasRegistry: feed.hasRegistry,
      chainId,
      positions,
      /** Raises where the wallet holds tokens. */
      holdings: positions.filter((p) => p.holds),
      /** Raises that pay this wallet a share. */
      earning: positions.filter((p) => p.earns),
      /** Raises this wallet has saved on chain. */
      watchlist: positions.filter((p) => p.watched),
      totals: {
        owed: positions.reduce((s, p) => s + p.owed, 0n),
        taken: positions.reduce((s, p) => s + p.taken, 0n),
      },
      asNumber,
    };
  }, [feed.rows, feed.isLoading, feed.hasRegistry, data, stride, social, address, isConnected, chainId]);
}

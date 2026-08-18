import { useCallback, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { formatUnits } from "viem";
import { erc20Abi, feeRouterAbi } from "../contracts/abis";
import { useRegistryFeed } from "./useRegistryFeed";
import { useToast } from "../components/toast-context";

export type EarningRow = {
  ido: string;
  name: string;
  symbol: string;
  feeRouter: string;
  releasable: bigint;
  released: bigint;
  assetSymbol: string;
  decimals: number;
  format: (v: bigint) => string;
};

/**
 * Everything the connected wallet is owed, across every raise on the protocol.
 *
 * `FeeRouter.release` is per-raise, so without this a recipient has to know
 * which raises name them and visit each one. Aggregating turns "am I owed
 * anything?" into a single screen.
 *
 * Entitlements are read per-router rather than inferred from the split table:
 * a wallet can appear in several allocations of the same raise, and only the
 * contract knows what is actually still claimable.
 */
export function useEarnings() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useToast();
  const feed = useRegistryFeed("newest", 100);

  const holder = (address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;

  const { data, refetch } = useReadContracts({
    contracts: feed.rows.flatMap((r) => [
      {
        address: r.launch.feeRouter as `0x${string}`,
        abi: feeRouterAbi,
        functionName: "releasable" as const,
        args: [holder] as const,
      },
      {
        address: r.launch.feeRouter as `0x${string}`,
        abi: feeRouterAbi,
        functionName: "released" as const,
        args: [holder] as const,
      },
      {
        address: r.launch.contributionAsset as `0x${string}`,
        abi: erc20Abi,
        functionName: "symbol" as const,
      },
      {
        address: r.launch.contributionAsset as `0x${string}`,
        abi: erc20Abi,
        functionName: "decimals" as const,
      },
    ]),
    query: { enabled: isConnected && feed.rows.length > 0 },
  });

  const rows: EarningRow[] = useMemo(() => {
    return feed.rows
      .map((r, i) => {
        const b = i * 4;
        const read = <T,>(o: number) => data?.[b + o]?.result as T | undefined;
        const decimals = read<number>(3) ?? 18;
        return {
          ido: r.launch.ido,
          name: r.launch.name,
          symbol: r.launch.symbol,
          feeRouter: r.launch.feeRouter,
          releasable: read<bigint>(0) ?? 0n,
          released: read<bigint>(1) ?? 0n,
          assetSymbol: read<string>(2) ?? "",
          decimals,
          format: (v: bigint) => formatUnits(v, decimals),
        };
      })
      // A wallet named in no allocation of a raise has nothing to show for it.
      .filter((r) => r.releasable > 0n || r.released > 0n);
  }, [feed.rows, data]);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const claimable = rows.reduce((sum, r) => sum + r.releasable, 0n);
  const claimed = rows.reduce((sum, r) => sum + r.released, 0n);
  const withSomethingOwed = rows.filter((r) => r.releasable > 0n);

  const collectOne = useCallback(
    async (feeRouter: string) => {
      if (!publicClient || !address) return;
      setBusy(true);
      setStatus("");
      try {
        const id = toast.push({ kind: "pending", title: "Collecting your share" });
        const hash = await writeContractAsync({
          address: feeRouter as `0x${string}`,
          abi: feeRouterAbi,
          functionName: "release",
          args: [address],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        toast.settle(id, { kind: "done", title: "Collected", hash });
        await refetch();
      } catch (err) {
        const e = err as { shortMessage?: string; message?: string };
        setStatus(e.shortMessage ?? e.message ?? String(err));
      } finally {
        setBusy(false);
      }
    },
    [publicClient, address, writeContractAsync, refetch],
  );

  /**
   * Collect from every raise that owes something.
   *
   * Sequential rather than parallel: each is its own signature, and firing
   * them at once would stack wallet prompts in an order the user cannot follow.
   * A failure stops the run so the reported count stays truthful.
   */
  const collectAll = useCallback(async () => {
    if (!publicClient || !address || withSomethingOwed.length === 0) return;
    setBusy(true);
    setStatus("");
    let done = 0;
    try {
      for (const row of withSomethingOwed) {
        setStatus(`Collecting ${done + 1} of ${withSomethingOwed.length}…`);
        const hash = await writeContractAsync({
          address: row.feeRouter as `0x${string}`,
          abi: feeRouterAbi,
          functionName: "release",
          args: [address],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        done += 1;
      }
      setStatus(`Collected from ${done} raise${done === 1 ? "" : "s"}.`);
      await refetch();
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string };
      setStatus(
        `Stopped after ${done} of ${withSomethingOwed.length}: ${e.shortMessage ?? e.message ?? String(err)}`,
      );
      await refetch();
    } finally {
      setBusy(false);
    }
  }, [publicClient, address, withSomethingOwed, writeContractAsync, refetch]);

  return {
    rows,
    claimable,
    claimed,
    owedCount: withSomethingOwed.length,
    isConnected,
    chainId,
    hasRegistry: feed.hasRegistry,
    collectOne,
    collectAll,
    busy,
    status,
  };
}

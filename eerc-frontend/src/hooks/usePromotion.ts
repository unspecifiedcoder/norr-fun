import { useCallback, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { formatEther } from "viem";
import { promotionAbi } from "../contracts/abis";
import { getRegistry } from "../contracts/config";

export type Tier = { id: number; name: string; price: bigint; duration: bigint; active: boolean };

/**
 * Paid feed placement for one launch.
 *
 * Placement only: buying a slot never changes a launch's economics, and the
 * feed labels promoted entries so a reader can tell paid placement from
 * ranking. Slots expire, so early launches cannot hold the top forever.
 */
export function usePromotion(subject?: string) {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const contract = getRegistry(chainId)?.promotion as `0x${string}` | undefined;

  // Built imperatively and cast: mixing function names in a conditional array
  // collapses wagmi's inferred element type to `never`.
  const calls: Record<string, unknown>[] = [];
  if (contract) {
    calls.push({ address: contract, abi: promotionAbi, functionName: "tiers" });
    if (subject) {
      calls.push({
        address: contract,
        abi: promotionAbi,
        functionName: "promotedUntil",
        args: [subject],
      });
    }
  }

  const { data: rawData, refetch } = useReadContracts({
    contracts: calls as never,
    query: { enabled: !!contract },
  });
  const data = rawData as ({ result?: unknown } | undefined)[] | undefined;

  const tiers: Tier[] = useMemo(() => {
    const raw = data?.[0]?.result as
      | readonly { name: string; price: bigint; duration: bigint; active: boolean }[]
      | undefined;
    return (raw ?? []).map((t, id) => ({ ...t, id }));
  }, [data]);

  const until = (data?.[1]?.result as bigint | undefined) ?? 0n;
  const isPromoted = Number(until) * 1000 > Date.now();

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const buy = useCallback(
    async (tier: Tier) => {
      if (!contract || !publicClient || !subject) return;
      setBusy(true);
      setStatus("");
      try {
        setStatus(`Buying ${tier.name}…`);
        const hash = await writeContractAsync({
          address: contract,
          abi: promotionAbi,
          functionName: "promote",
          args: [subject as `0x${string}`, BigInt(tier.id)],
          value: tier.price,
        });
        await publicClient.waitForTransactionReceipt({ hash });
        setStatus(`${tier.name} is live.`);
        await refetch();
      } catch (err) {
        const e = err as { shortMessage?: string; message?: string };
        setStatus(e.shortMessage ?? e.message ?? String(err));
      } finally {
        setBusy(false);
      }
    },
    [contract, publicClient, subject, writeContractAsync, refetch],
  );

  return {
    available: !!contract,
    tiers: tiers.filter((t) => t.active),
    isPromoted,
    until,
    buy,
    busy,
    status,
    isConnected,
    formatPrice: (v: bigint) => formatEther(v),
  };
}

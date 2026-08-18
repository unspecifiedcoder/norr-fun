import { useCallback, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { formatUnits, getAddress } from "viem";
import { erc20Abi, idoAbi } from "../contracts/abis";
import { getLaunch } from "../contracts/config";
import proofData from "../deployments/proofs-31337.json";
import { useToast } from "../components/toast-context";

type ProofEntry = { allocationWei: string; proof: string[] };

const PROOFS: Record<number, { root: string; proofs: Record<string, ProofEntry> }> = {
  31337: proofData as { root: string; proofs: Record<string, ProofEntry> },
};

/**
 * The connected wallet's position in a finalized sale, plus the claim action.
 *
 * Allocations and proofs come from the Merkle tree published by
 * scripts/ido/08_setup_claims.ts; everything about claim state is read from
 * chain so a stale proof file cannot make the UI claim something already taken.
 */
export type IdoTarget = { ido: string; projectToken: string };

/**
 * @param target Which sale to read. Omitted, it falls back to the chain's seed
 *   deployment; the launch detail route passes the sale the user opened.
 */
export function useIdo(target?: IdoTarget) {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useToast();

  const fallback = getLaunch(chainId);
  const launch = target ?? fallback;
  const ido = launch?.ido as `0x${string}` | undefined;
  const projectToken = launch?.projectToken as `0x${string}` | undefined;

  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  // Proofs are keyed by checksummed address.
  const entry = (() => {
    if (!address) return undefined;
    const table = PROOFS[chainId]?.proofs;
    if (!table) return undefined;
    try {
      return table[getAddress(address)];
    } catch {
      return undefined;
    }
  })();

  const allocation = entry ? BigInt(entry.allocationWei) : 0n;

  const { data, refetch } = useReadContracts({
    contracts: ido && projectToken
      ? [
          { address: ido, abi: idoAbi, functionName: "finalized" },
          { address: ido, abi: idoAbi, functionName: "merkleRoot" },
          {
            address: ido,
            abi: idoAbi,
            functionName: "claimed",
            args: [(address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`],
          },
          { address: projectToken, abi: erc20Abi, functionName: "balanceOf", args: [ido] },
          { address: projectToken, abi: erc20Abi, functionName: "symbol" },
          {
            address: projectToken,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [(address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`],
          },
        ]
      : [],
    query: { enabled: !!ido && !!projectToken },
  });

  const alreadyClaimed = (data?.[2]?.result as bigint | undefined) ?? 0n;
  const claimable = allocation > alreadyClaimed ? allocation - alreadyClaimed : 0n;

  const claim = useCallback(async () => {
    if (!ido || !publicClient || !address || !entry) return;
    setBusy(true);
    setStatus("");
    // Declared outside the try so a failure can settle the same toast.
    let claimId = 0;
    try {
      setStatus("Submitting claim...");
      claimId = toast.push({
        kind: "pending",
        title: "Claiming allocation",
        detail: "Proving your entry against the published root.",
      });
      const hash = await writeContractAsync({
        address: ido,
        abi: idoAbi,
        functionName: "claim",
        args: [
          getAddress(address),
          BigInt(entry.allocationWei),
          entry.proof as `0x${string}`[],
        ],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      toast.settle(claimId, {
        kind: "done",
        title: `Claimed ${formatUnits(claimable, 18)} tokens`,
        hash,
      });
      setStatus(`Claimed ${formatUnits(claimable, 18)} tokens.`);
      await refetch();
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string };
      const reason = e.shortMessage ?? e.message ?? String(err);
      toast.settle(claimId, { kind: "failed", title: "Claim failed", detail: reason });
      setStatus(`Claim failed: ${reason}`);
    } finally {
      setBusy(false);
    }
  }, [ido, publicClient, address, entry, writeContractAsync, claimable, refetch]);

  return {
    available: !!launch,
    chainId,
    isConnected,
    address,
    finalized: (data?.[0]?.result as boolean | undefined) ?? false,
    merkleRoot: (data?.[1]?.result as string | undefined) ?? "",
    poolBalance: (data?.[3]?.result as bigint | undefined) ?? 0n,
    symbol: (data?.[4]?.result as string | undefined) ?? "",
    walletBalance: (data?.[5]?.result as bigint | undefined) ?? 0n,
    hasAllocation: !!entry,
    allocation,
    alreadyClaimed,
    claimable,
    claim,
    status,
    busy,
    format: (v: bigint) => formatUnits(v, 18),
  };
}

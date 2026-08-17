import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { erc20Abi, feeRouterAbi } from "../contracts/abis";
import { getLaunch, type LaunchSplit } from "../contracts/config";

export const BPS_DENOMINATOR = 10_000n;

export type SplitRow = LaunchSplit & {
  /** Asset currently claimable by this recipient, in base units. */
  releasable: bigint;
  /** Asset already paid out to this recipient, in base units. */
  released: bigint;
};

/**
 * Live view of a launch's FeeRouter plus the actions that mutate it.
 *
 * Every figure here is read from chain -- nothing is derived from the
 * deployment file except the addresses and the human-readable labels.
 */
export function useFeeRouter() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const launch = getLaunch(chainId);
  const feeRouter = launch?.feeRouter as `0x${string}` | undefined;
  const asset = launch?.contributionAsset as `0x${string}` | undefined;

  const [depositAmount, setDepositAmount] = useState("");
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  // Router-level state plus the asset's own metadata.
  const { data: core, refetch: refetchCore } = useReadContracts({
    contracts: feeRouter && asset
      ? [
          { address: feeRouter, abi: feeRouterAbi, functionName: "totalReceived" },
          { address: feeRouter, abi: feeRouterAbi, functionName: "totalReleased" },
          { address: feeRouter, abi: feeRouterAbi, functionName: "pending" },
          { address: feeRouter, abi: feeRouterAbi, functionName: "locked" },
          { address: feeRouter, abi: feeRouterAbi, functionName: "owner" },
          { address: asset, abi: erc20Abi, functionName: "decimals" },
          { address: asset, abi: erc20Abi, functionName: "symbol" },
        ]
      : [],
    query: { enabled: !!feeRouter && !!asset },
  });

  const decimals = (core?.[5]?.result as number | undefined) ?? 18;
  const symbol = (core?.[6]?.result as string | undefined) ?? "";

  // Per-recipient accrual. Read as one multicall so the rows stay consistent
  // with each other and with the totals above.
  const recipients = launch?.splits.map((s) => s.recipient as `0x${string}`) ?? [];
  const { data: perRecipient, refetch: refetchRecipients } = useReadContracts({
    contracts: feeRouter
      ? recipients.flatMap((recipient) => [
          {
            address: feeRouter,
            abi: feeRouterAbi,
            functionName: "releasable" as const,
            args: [recipient] as const,
          },
          {
            address: feeRouter,
            abi: feeRouterAbi,
            functionName: "released" as const,
            args: [recipient] as const,
          },
        ])
      : [],
    query: { enabled: !!feeRouter && recipients.length > 0 },
  });

  const rows: SplitRow[] = useMemo(() => {
    if (!launch) return [];
    return launch.splits.map((split, i) => ({
      ...split,
      releasable: (perRecipient?.[i * 2]?.result as bigint | undefined) ?? 0n,
      released: (perRecipient?.[i * 2 + 1]?.result as bigint | undefined) ?? 0n,
    }));
  }, [launch, perRecipient]);

  const refresh = useCallback(async () => {
    await Promise.all([refetchCore(), refetchRecipients()]);
  }, [refetchCore, refetchRecipients]);

  /**
   * Approve then deposit, routing `depositAmount` of the contribution asset.
   * Waits for each receipt so the UI never reports success on a pending tx.
   */
  const deposit = useCallback(async () => {
    if (!feeRouter || !asset || !publicClient || !depositAmount) return;
    setBusy(true);
    setStatus("");
    try {
      const value = parseUnits(depositAmount, decimals);
      if (value <= 0n) throw new Error("Amount must be greater than zero");

      setStatus(`Approving ${depositAmount} ${symbol}...`);
      const approveHash = await writeContractAsync({
        address: asset,
        abi: erc20Abi,
        functionName: "approve",
        args: [feeRouter, value],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      setStatus(`Depositing ${depositAmount} ${symbol}...`);
      const depositHash = await writeContractAsync({
        address: feeRouter,
        abi: feeRouterAbi,
        functionName: "deposit",
        args: [value],
      });
      await publicClient.waitForTransactionReceipt({ hash: depositHash });

      setStatus(`Routed ${depositAmount} ${symbol} across ${rows.length} recipients.`);
      setDepositAmount("");
      await refresh();
    } catch (err) {
      setStatus(`Deposit failed: ${errorText(err)}`);
    } finally {
      setBusy(false);
    }
  }, [
    feeRouter, asset, publicClient, depositAmount, decimals, symbol,
    writeContractAsync, rows.length, refresh,
  ]);

  /** Pull everything currently owed to `recipient`. Permissionless by design. */
  const release = useCallback(
    async (recipient: string) => {
      if (!feeRouter || !publicClient) return;
      setBusy(true);
      setStatus("");
      try {
        setStatus(`Releasing to ${short(recipient)}...`);
        const hash = await writeContractAsync({
          address: feeRouter,
          abi: feeRouterAbi,
          functionName: "release",
          args: [recipient as `0x${string}`],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        setStatus(`Released to ${short(recipient)}.`);
        await refresh();
      } catch (err) {
        setStatus(`Release failed: ${errorText(err)}`);
      } finally {
        setBusy(false);
      }
    },
    [feeRouter, publicClient, writeContractAsync, refresh],
  );

  /** Freeze the split table permanently. Owner only. */
  const lock = useCallback(async () => {
    if (!feeRouter || !publicClient) return;
    setBusy(true);
    setStatus("");
    try {
      setStatus("Locking splits...");
      const hash = await writeContractAsync({
        address: feeRouter,
        abi: feeRouterAbi,
        functionName: "lock",
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("Splits locked permanently.");
      await refresh();
    } catch (err) {
      setStatus(`Lock failed: ${errorText(err)}`);
    } finally {
      setBusy(false);
    }
  }, [feeRouter, publicClient, writeContractAsync, refresh]);

  const owner = core?.[4]?.result as string | undefined;

  return {
    launch,
    available: !!launch,
    chainId,
    isConnected,
    address,
    symbol,
    decimals,
    rows,
    totalReceived: (core?.[0]?.result as bigint | undefined) ?? 0n,
    totalReleased: (core?.[1]?.result as bigint | undefined) ?? 0n,
    pending: (core?.[2]?.result as bigint | undefined) ?? 0n,
    locked: (core?.[3]?.result as boolean | undefined) ?? false,
    owner,
    isOwner: !!owner && !!address && owner.toLowerCase() === address.toLowerCase(),
    depositAmount,
    setDepositAmount,
    deposit,
    release,
    lock,
    refresh,
    status,
    busy: busy || isWriting,
    format: (value: bigint) => formatUnits(value, decimals),
  };
}

const short = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

/** Prefer viem's short revert reason over the full multi-line dump. */
const errorText = (err: unknown): string => {
  if (typeof err === "object" && err !== null) {
    const e = err as { shortMessage?: string; message?: string };
    return e.shortMessage ?? e.message ?? String(err);
  }
  return String(err);
};

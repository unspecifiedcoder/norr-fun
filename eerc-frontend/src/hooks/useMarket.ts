import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { formatUnits, parseUnits, parseAbiItem } from "viem";
import { bondingCurveAbi, erc20Abi } from "../contracts/abis";
import markets from "../deployments/market-31337.json";
import { usePreferences } from "./usePreferences";
import { useToast } from "../components/toast-context";

const MARKETS: Record<number, Record<string, string>> = {
  [markets.chainId]: markets.markets as Record<string, string>,
};

export const getMarket = (chainId: number, sale?: string): string | undefined => {
  if (!sale) return undefined;
  const table = MARKETS[chainId];
  if (!table) return undefined;
  const key = Object.keys(table).find((k) => k.toLowerCase() === sale.toLowerCase());
  return key ? table[key] : undefined;
};

export type TradePoint = {
  blockNumber: bigint;
  /**
   * Unix seconds, read from the block the fill landed in.
   *
   * Without it the chart can only plot fills in sequence, which makes a burst
   * of trades and a quiet week look identical. Timeframes, the 24h change and
   * the candle buckets all need real time.
   */
  timestamp: number;
  priceX18: bigint;
  side: "buy" | "sell";
  actor: string;
  baseAmount: bigint;
  tokenAmount: bigint;
};

const BOUGHT = parseAbiItem(
  "event Bought(address indexed buyer, uint256 baseIn, uint256 tokensOut, uint256 fee, uint256 priceX18)",
);
/** Blocks to resolve timestamps for, newest-first. */
const MAX_TIMESTAMP_READS = 300;

const SOLD = parseAbiItem(
  "event Sold(address indexed seller, uint256 tokensIn, uint256 baseOut, uint256 fee, uint256 priceX18)",
);

/**
 * Everything the market surfaces read.
 *
 * The launch page mounts this once and hands the value to the chart, the
 * trade panel and the fills table. Each of those calling the hook itself
 * would replay the curve's whole log history three times over for one page.
 */
export type MarketState = ReturnType<typeof useMarket>;

/**
 * The public trading phase for a launch.
 *
 * This is deliberately separate from the sale: the sealed round settles first
 * and its contribution amounts stay private, then the distributed token trades
 * openly here. Price history is reconstructed from the curve's own trade
 * events, so the chart plots real fills rather than a sampled oracle.
 */
export function useMarket(sale?: string) {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useToast();

  const curve = getMarket(chainId, sale) as `0x${string}` | undefined;

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const { prefs } = usePreferences();
  const [slippagePct, setSlippagePct] = useState(prefs.slippagePct);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [trades, setTrades] = useState<TradePoint[]>([]);

  const { data, refetch } = useReadContracts({
    contracts: curve
      ? [
          { address: curve, abi: bondingCurveAbi, functionName: "priceX18" },
          { address: curve, abi: bondingCurveAbi, functionName: "tokenReserve" },
          { address: curve, abi: bondingCurveAbi, functionName: "baseReserve" },
          { address: curve, abi: bondingCurveAbi, functionName: "graduated" },
          { address: curve, abi: bondingCurveAbi, functionName: "graduationTarget" },
          { address: curve, abi: bondingCurveAbi, functionName: "graduationProgressBps" },
          { address: curve, abi: bondingCurveAbi, functionName: "token" },
          { address: curve, abi: bondingCurveAbi, functionName: "base" },
        ]
      : [],
    query: { enabled: !!curve },
  });

  const tokenAddress = data?.[6]?.result as `0x${string}` | undefined;
  const baseAddress = data?.[7]?.result as `0x${string}` | undefined;

  const { data: meta, refetch: refetchMeta } = useReadContracts({
    contracts: tokenAddress && baseAddress
      ? [
          { address: tokenAddress, abi: erc20Abi, functionName: "symbol" },
          { address: baseAddress, abi: erc20Abi, functionName: "symbol" },
          {
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [(address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`],
          },
          {
            address: baseAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [(address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`],
          },
        ]
      : [],
    query: { enabled: !!tokenAddress && !!baseAddress },
  });

  // --- price history from the curve's own fills ---
  const loadTrades = useCallback(async () => {
    if (!publicClient || !curve) return;
    const [buys, sells] = await Promise.all([
      publicClient.getLogs({ address: curve, event: BOUGHT, fromBlock: 0n }),
      publicClient.getLogs({ address: curve, event: SOLD, fromBlock: 0n }),
    ]);

    // Timestamps are attached below, once the blocks they need are read.
    const points: Omit<TradePoint, "timestamp">[] = [
      ...buys.map((l) => {
        const a = (l as unknown as { args: { buyer: string; baseIn: bigint; tokensOut: bigint; priceX18: bigint } }).args;
        return {
          blockNumber: l.blockNumber ?? 0n,
          priceX18: a.priceX18,
          side: "buy" as const,
          actor: a.buyer,
          baseAmount: a.baseIn,
          tokenAmount: a.tokensOut,
        };
      }),
      ...sells.map((l) => {
        const a = (l as unknown as { args: { seller: string; tokensIn: bigint; baseOut: bigint; priceX18: bigint } }).args;
        return {
          blockNumber: l.blockNumber ?? 0n,
          priceX18: a.priceX18,
          side: "sell" as const,
          actor: a.seller,
          baseAmount: a.baseOut,
          tokenAmount: a.tokensIn,
        };
      }),
    ].sort((x, y) => (x.blockNumber > y.blockNumber ? 1 : x.blockNumber < y.blockNumber ? -1 : 0));

    // One read per *block*, not per fill: a busy block holds many trades and
    // they all share its timestamp. Capped so a long-lived curve cannot fan
    // out into hundreds of round-trips on page load.
    const blocks = [...new Set(points.map((p) => p.blockNumber))].slice(-MAX_TIMESTAMP_READS);
    const stamps = new Map<bigint, number>();
    await Promise.all(
      blocks.map(async (b) => {
        try {
          const block = await publicClient.getBlock({ blockNumber: b });
          stamps.set(b, Number(block.timestamp));
        } catch {
          // A pruned or unavailable block falls back below rather than
          // dropping the fill: a trade with an approximate time is still a
          // trade, and losing it would understate volume.
        }
      }),
    );

    setTrades(
      points.map((p) => ({
        ...p,
        timestamp: stamps.get(p.blockNumber) ?? Number(p.blockNumber),
      })),
    );
  }, [publicClient, curve]);

  useEffect(() => {
    void loadTrades();
  }, [loadTrades]);

  // --- quote for the current input ---
  const [quote, setQuote] = useState<{ out: bigint; fee: bigint } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!publicClient || !curve || !amount || Number(amount) <= 0) {
        setQuote(null);
        return;
      }
      try {
        const value = parseUnits(amount, 18);
        const result = (await publicClient.readContract({
          address: curve,
          abi: bondingCurveAbi,
          functionName: side === "buy" ? "quoteBuy" : "quoteSell",
          args: [value],
        })) as [bigint, bigint];
        if (!cancelled) setQuote({ out: result[0], fee: result[1] });
      } catch {
        if (!cancelled) setQuote(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [publicClient, curve, amount, side]);

  /** Quoted output minus the tolerance, as the on-chain floor. */
  const minOut = useMemo(() => {
    if (!quote) return 0n;
    const tol = Number.parseFloat(slippagePct);
    const bps = BigInt(Math.round((Number.isFinite(tol) ? tol : 1) * 100));
    return (quote.out * (10_000n - bps)) / 10_000n;
  }, [quote, slippagePct]);

  // Named locally so the transaction toasts can say which token is moving.
  const tokenSymbol = (meta?.[0]?.result as string | undefined) ?? "";
  const baseSymbol = (meta?.[1]?.result as string | undefined) ?? "";

  const trade = useCallback(async () => {
    if (!curve || !publicClient || !address || !quote || !amount) return;
    setBusy(true);
    setStatus("");
    try {
      const value = parseUnits(amount, 18);
      const spendToken = side === "buy" ? baseAddress : tokenAddress;

      if (spendToken) {
        setStatus("Approving…");
        const approveId = toast.push({
          kind: "pending",
          title: `Approving ${side === "buy" ? baseSymbol : tokenSymbol}`,
          detail: "One signature to let the curve take the amount.",
        });
        const approveHash = await writeContractAsync({
          address: spendToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [curve, value],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        toast.settle(approveId, { kind: "done", title: "Approved", hash: approveHash });
      }

      setStatus(side === "buy" ? "Buying…" : "Selling…");
      const tradeId = toast.push({
        kind: "pending",
        title: side === "buy" ? `Buying ${tokenSymbol}` : `Selling ${tokenSymbol}`,
        detail: `${amount} ${side === "buy" ? baseSymbol : tokenSymbol}`,
      });
      const hash = await writeContractAsync({
        address: curve,
        abi: bondingCurveAbi,
        functionName: side,
        args: [value, minOut],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      toast.settle(tradeId, {
        kind: "done",
        title: side === "buy" ? "Bought" : "Sold",
        hash,
      });

      setStatus(side === "buy" ? "Bought." : "Sold.");
      setAmount("");
      await Promise.all([refetch(), refetchMeta(), loadTrades()]);
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string };
      const reason = e.shortMessage ?? e.message ?? String(err);
      setStatus(reason);
      toast.push({ kind: "failed", title: "Trade failed", detail: reason });
    } finally {
      setBusy(false);
    }
  }, [
    curve, publicClient, address, quote, amount, side, baseAddress, tokenAddress,
    minOut, writeContractAsync, refetch, refetchMeta, loadTrades, toast,
    baseSymbol, tokenSymbol,
  ]);

  const graduate = useCallback(async () => {
    if (!curve || !publicClient) return;
    setBusy(true);
    setStatus("");
    try {
      setStatus("Graduating…");
      const hash = await writeContractAsync({
        address: curve,
        abi: bondingCurveAbi,
        functionName: "graduate",
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("Graduated. Trading here is closed.");
      await refetch();
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string };
      setStatus(e.shortMessage ?? e.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }, [curve, publicClient, writeContractAsync, refetch]);

  const progressBps = Number((data?.[5]?.result as bigint | undefined) ?? 0n);

  /**
   * Figures a reader compares a launch on: turnover, the high-water mark, and
   * the move over the last day.
   *
   * All three are summed from the curve's own fills rather than an index, so
   * they cannot drift from what the chain says. A launch younger than a day
   * reports its change since the first fill and says so, instead of printing
   * a 24h figure it does not have.
   */
  const stats = useMemo(() => {
    const priced = trades.map((t) => Number(t.priceX18) / 1e18);
    const volumeBase = trades.reduce((sum, t) => sum + t.baseAmount, 0n);
    const last = priced[priced.length - 1] ?? 0;
    const first = priced[0] ?? 0;
    const ath = priced.length ? Math.max(...priced) : 0;

    const dayAgo = Math.floor(Date.now() / 1000) - 86_400;
    const older = trades.filter((t) => t.timestamp <= dayAgo);
    const hasFullDay = older.length > 0;
    const base = hasFullDay
      ? Number(older[older.length - 1].priceX18) / 1e18
      : first;

    return {
      volumeBase,
      fills: trades.length,
      ath,
      /** How far off the high the price sits now, as a negative percentage. */
      fromAth: ath > 0 ? ((last - ath) / ath) * 100 : 0,
      change: base > 0 ? ((last - base) / base) * 100 : 0,
      /** What the change actually measures, so the label cannot overclaim. */
      changeWindow: hasFullDay ? ("24h" as const) : ("open" as const),
      last,
      first,
    };
  }, [trades]);

  return {
    stats,
    exists: !!curve,
    curve,
    priceX18: (data?.[0]?.result as bigint | undefined) ?? 0n,
    tokenReserve: (data?.[1]?.result as bigint | undefined) ?? 0n,
    baseReserve: (data?.[2]?.result as bigint | undefined) ?? 0n,
    graduated: (data?.[3]?.result as boolean | undefined) ?? false,
    graduationTarget: (data?.[4]?.result as bigint | undefined) ?? 0n,
    progressPct: progressBps / 100,
    canGraduate: progressBps >= 10_000,
    tokenSymbol,
    baseSymbol,
    tokenBalance: (meta?.[2]?.result as bigint | undefined) ?? 0n,
    baseBalance: (meta?.[3]?.result as bigint | undefined) ?? 0n,
    trades,
    side, setSide,
    amount, setAmount,
    slippagePct, setSlippagePct,
    quote, minOut,
    trade, graduate,
    busy, status,
    isConnected,
    format: (v: bigint) => formatUnits(v, 18),
  };
}

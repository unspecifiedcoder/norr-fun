import { useCallback, useEffect, useMemo, useState } from "react";
import { useChainId, usePublicClient, useReadContracts } from "wagmi";
import { formatUnits, parseAbiItem } from "viem";
import { bondingCurveAbi } from "../contracts/abis";
import { getMarket } from "./useMarket";

const BOUGHT = parseAbiItem(
  "event Bought(address indexed buyer, uint256 baseIn, uint256 tokensOut, uint256 fee, uint256 priceX18)",
);
const SOLD = parseAbiItem(
  "event Sold(address indexed seller, uint256 tokensIn, uint256 baseOut, uint256 fee, uint256 priceX18)",
);

/**
 * The read-only half of a launch's market, for a feed card.
 *
 * useMarket carries quotes, approvals, slippage and write paths — everything a
 * trade panel needs and a card does not. Mounting it once per card would open
 * a quote subscription per row for a control that is never rendered.
 *
 * A launch with no curve deployed returns `exists: false` before issuing any
 * request, so a feed of sealed rounds costs nothing extra.
 */
export function useCurveSummary(sale?: string) {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const curve = getMarket(chainId, sale) as `0x${string}` | undefined;

  const { data } = useReadContracts({
    contracts: curve
      ? [
          { address: curve, abi: bondingCurveAbi, functionName: "priceX18" },
          { address: curve, abi: bondingCurveAbi, functionName: "baseReserve" },
          { address: curve, abi: bondingCurveAbi, functionName: "graduated" },
          { address: curve, abi: bondingCurveAbi, functionName: "graduationTarget" },
          { address: curve, abi: bondingCurveAbi, functionName: "graduationProgressBps" },
        ]
      : [],
    query: { enabled: !!curve },
  });

  const [fills, setFills] = useState<{ p: number; base: bigint }[]>([]);

  const load = useCallback(async () => {
    if (!publicClient || !curve) return;
    const [buys, sells] = await Promise.all([
      publicClient.getLogs({ address: curve, event: BOUGHT, fromBlock: 0n }),
      publicClient.getLogs({ address: curve, event: SOLD, fromBlock: 0n }),
    ]);
    const rows = [...buys, ...sells]
      .sort((a, b) => Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n)))
      .map((l) => {
        const a = (l as unknown as {
          args: { priceX18: bigint; baseIn?: bigint; baseOut?: bigint };
        }).args;
        return { p: Number(a.priceX18) / 1e18, base: a.baseIn ?? a.baseOut ?? 0n };
      });
    setFills(rows);
  }, [publicClient, curve]);

  useEffect(() => {
    void load();
  }, [load]);

  return useMemo(() => {
    const prices = fills.map((f) => f.p);
    const last = prices[prices.length - 1] ?? 0;
    const first = prices[0] ?? 0;
    const ath = prices.length ? Math.max(...prices) : 0;
    const progressBps = Number((data?.[4]?.result as bigint | undefined) ?? 0n);

    return {
      exists: !!curve,
      curve,
      prices,
      fills: fills.length,
      volume: fills.reduce((sum, f) => sum + f.base, 0n),
      price: last,
      /** Since the first fill — a card has no room to qualify a window. */
      change: first > 0 ? ((last - first) / first) * 100 : 0,
      ath,
      fromAth: ath > 0 ? ((last - ath) / ath) * 100 : 0,
      reserve: (data?.[1]?.result as bigint | undefined) ?? 0n,
      graduated: (data?.[2]?.result as boolean | undefined) ?? false,
      target: (data?.[3]?.result as bigint | undefined) ?? 0n,
      progressPct: progressBps / 100,
      format: (v: bigint) => Number(formatUnits(v, 18)),
    };
  }, [fills, data, curve]);
}

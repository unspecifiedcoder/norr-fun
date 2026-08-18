import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePublicClient, useChainId } from "wagmi";
import { parseAbiItem, formatUnits } from "viem";
import { Panel } from "./ui/Panel";
import { Avatar } from "./ui/Avatar";
import { Donut, type Slice } from "./ui/Donut";
import { short, compact } from "./ui/format";

const TRANSFER = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);
const ZERO = "0x0000000000000000000000000000000000000000";

type Holder = { address: string; balance: bigint; share: number };

/**
 * Holders of the public token, reconstructed by replaying Transfer logs.
 *
 * This is the *distributed* token, not the sealed round. Contribution amounts
 * stay private in the eERC layer; once tokens are claimed and trading opens
 * they are an ordinary public ERC20 whose holder set is already visible to
 * anyone reading the chain, so surfacing it here reveals nothing that was
 * private. The panel says so, because a "holders" tab on a privacy product
 * otherwise reads as a contradiction.
 *
 * Replaying logs avoids an indexer, which is fine at this scale and stated
 * rather than hidden.
 */
export const Holders = ({
  token,
  exclude = [],
}: {
  token: string;
  /** Contract addresses to omit — a curve's inventory is not a holder. */
  exclude?: string[];
}) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!publicClient || !token) return;
    setLoading(true);
    setError("");
    try {
      const logs = await publicClient.getLogs({
        address: token as `0x${string}`,
        event: TRANSFER,
        fromBlock: 0n,
      });

      const balances = new Map<string, bigint>();
      for (const l of logs) {
        const a = (l as unknown as { args: { from: string; to: string; value: bigint } }).args;
        if (a.from !== ZERO) balances.set(a.from, (balances.get(a.from) ?? 0n) - a.value);
        if (a.to !== ZERO) balances.set(a.to, (balances.get(a.to) ?? 0n) + a.value);
      }

      const skip = new Set([...exclude, ZERO].map((s) => s.toLowerCase()));
      const rows = [...balances.entries()]
        .filter(([addr, bal]) => bal > 0n && !skip.has(addr.toLowerCase()))
        .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));

      const circulating = rows.reduce((sum, [, b]) => sum + b, 0n);
      setHolders(
        rows.map(([address, balance]) => ({
          address,
          balance,
          share: circulating > 0n ? Number((balance * 10_000n) / circulating) / 100 : 0,
        })),
      );
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string };
      setError(e.shortMessage ?? e.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [publicClient, token, exclude, chainId]);

  useEffect(() => {
    void load();
  }, [load]);

  const top = holders.slice(0, 5).reduce((sum, h) => sum + h.share, 0);

  /**
   * Concentration, as a shape.
   *
   * The top five get their own arc and the rest are folded into a remainder:
   * beyond that the slices are too thin to read and the legend turns into a
   * second copy of the table below it.
   */
  const RING = [
    "var(--cat-creator)", "var(--cat-partner)", "var(--cat-marketing)",
    "var(--cat-liquidity)", "var(--cat-treasury)",
  ];
  const slices: Slice[] = holders.slice(0, 5).map((h, i) => ({
    label: short(h.address),
    value: h.share,
    color: RING[i],
  }));
  const rest = holders.slice(5).reduce((sum, h) => sum + h.share, 0);
  if (rest > 0) slices.push({ label: `${holders.length - 5} others`, value: rest, color: "var(--cat-custom)" });

  return (
    <Panel
      title={`Holders${holders.length ? ` · ${holders.length}` : ""}`}
      aside={
        holders.length > 0 && (
          <span className="text-[length:var(--t-fine)] text-[var(--ink-3)] tabular">
            top 5 hold {top.toFixed(1)}%
          </span>
        )
      }
      flush
    >
      <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] px-3.5 py-2.5 border-b border-[var(--rule)]">
        Reconstructed from token transfers. This is the distributed token — what
        each wallet contributed during the sealed round stays private.
      </p>

      {error && (
        <p className="text-[length:var(--t-fine)] text-[var(--falu)] px-3.5 py-2.5">{error}</p>
      )}

      {holders.length > 1 && (
        <div className="px-3.5 py-4 border-b border-[var(--rule)]">
          <Donut
            slices={slices}
            centre={`${holders.length}`}
            caption={`Holder concentration across ${holders.length} wallets`}
          />
        </div>
      )}

      {holders.length === 0 ? (
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)] p-4">
          {loading ? "Replaying transfers…" : "No holders yet."}
        </p>
      ) : (
        <ul>
          {holders.slice(0, 25).map((h, i) => (
            <li
              key={h.address}
              className="flex items-center gap-3 px-3.5 py-2 border-b border-[var(--rule)] last:border-0 hover:bg-[var(--sheet-raised)] transition-colors"
            >
              <span className="text-[length:var(--t-fine)] text-[var(--ink-4)] w-6 tabular shrink-0">
                {i + 1}
              </span>
              <Avatar seed={h.address} fallback={h.address.slice(2, 4)} size={22} />
              <Link
                to={`/u/${h.address}`}
                className="text-[length:var(--t-fine)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
              >
                {short(h.address)}
              </Link>

              {/* The share bar makes concentration legible without arithmetic:
                  one wallet holding half the float is a shape, not a figure. */}
              <span className="flex-1 min-w-[3rem] hidden sm:block">
                <span className="meter block">
                  <span
                    className="meter__fill block"
                    style={{ width: `${Math.min(100, h.share)}%` }}
                  />
                </span>
              </span>

              <span className="text-[length:var(--t-fine)] text-[var(--ink)] tabular shrink-0">
                {compact(Number(formatUnits(h.balance, 18)))}
              </span>
              <span className="text-[length:var(--t-fine)] text-[var(--ink-3)] tabular w-14 text-right shrink-0">
                {h.share.toFixed(2)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

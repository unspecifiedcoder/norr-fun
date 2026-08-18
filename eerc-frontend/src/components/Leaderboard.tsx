import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FaTrophy } from "react-icons/fa";
import { Panel } from "./ui/Panel";
import { Avatar } from "./ui/Avatar";
import { useRegistryFeed } from "../hooks/useRegistryFeed";
import { compact, short } from "./ui/format";

/**
 * Who has actually shipped here.
 *
 * Summed from the registry rather than kept as a score: a creator's standing
 * is the raises they published and what those raised, both of which the chain
 * already records. Nothing is awarded, and there is no points system to game
 * — the ordering is just a fact restated.
 *
 * Ranked by amount raised rather than count, because ten empty launches
 * should not outrank one that worked.
 */
export const Leaderboard = () => {
  const feed = useRegistryFeed("newest", 100);

  const creators = useMemo(() => {
    const byAddress = new Map<
      string,
      { address: string; count: number; raised: bigint; symbol: string; open: number }
    >();

    for (const r of feed.rows) {
      const key = r.launch.creator.toLowerCase();
      const entry = byAddress.get(key) ?? {
        address: r.launch.creator,
        count: 0,
        raised: 0n,
        symbol: r.assetSymbol,
        open: 0,
      };
      entry.count += 1;
      entry.raised += r.raised;
      if (!r.finalized) entry.open += 1;
      byAddress.set(key, entry);
    }

    return [...byAddress.values()].sort((a, b) =>
      b.raised > a.raised ? 1 : b.raised < a.raised ? -1 : b.count - a.count,
    );
  }, [feed.rows]);

  if (creators.length === 0) return null;

  return (
    <Panel
      title="Creators"
      flush
      aside={
        <span className="text-[length:var(--t-fine)] text-[var(--ink-3)] uppercase tracking-[0.12em] hidden sm:block">
          by amount raised
        </span>
      }
    >
      <ul>
        {creators.slice(0, 10).map((c, i) => (
          <li key={c.address}>
            <Link
              to={`/u/${c.address}`}
              className="flex items-center gap-3 px-3.5 py-2.5 border-b border-[var(--rule)] last:border-0 hover:bg-[var(--sheet-raised)] transition-colors"
            >
              <span
                className="w-5 text-[length:var(--t-fine)] tabular shrink-0"
                style={{ color: i === 0 ? "var(--falu)" : "var(--ink-4)" }}
              >
                {i === 0 ? <FaTrophy className="text-[10px]" /> : i + 1}
              </span>
              <Avatar seed={c.address} fallback={c.address.slice(2, 4)} size={24} />
              <span className="text-[length:var(--t-fine)] text-[var(--ink-2)] flex-1 truncate">
                {short(c.address)}
              </span>
              <span className="text-[length:var(--t-fine)] text-[var(--ink-4)] tabular shrink-0">
                {c.count} {c.count === 1 ? "raise" : "raises"}
                {c.open > 0 && ` · ${c.open} open`}
              </span>
              <span className="text-[length:var(--t-fine)] text-[var(--ink)] tabular font-bold shrink-0 w-24 text-right">
                {c.raised > 0n ? `${compact(Number(c.raised) / 1e18)} ${c.symbol}` : "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
};

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaSearch, FaBookmark, FaRegBookmark } from "react-icons/fa";
import { useSocial } from "../hooks/useSocial";
import { ActionButton } from "./ActionButton";
import { useRegistryFeed, SORTS, type FeedSort, type FeedRow } from "../hooks/useRegistryFeed";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * The launch feed. Reads LaunchRegistry, so anything deployed through the
 * wizard appears here without a rebuild.
 *
 * Cards report raised / settled / phase rather than price and volume: these
 * are sealed contribution rounds with an off-chain tally, so there is no
 * continuous market to chart and no public per-trade record to summarise.
 */
export const Feed = ({ onCreate }: { onCreate: () => void }) => {
  const [sort, setSort] = useState<FeedSort>("newest");
  const [query, setQuery] = useState("");
  const feed = useRegistryFeed(sort);

  // Matches name, ticker, summary and both addresses, so a pasted address
  // finds its raise as readily as a typed name.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return feed.rows;
    return feed.rows.filter((r) =>
      [
        r.launch.name,
        r.launch.symbol,
        r.launch.description,
        r.launch.ido,
        r.launch.creator,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [feed.rows, query]);

  if (!feed.hasRegistry) {
    return (
      <Empty
        title="Nothing to show on this network"
        body={`No registry is deployed on chain ${feed.chainId}. Switch networks, or deploy one with scripts/ido/09_deploy_registry.ts.`}
      />
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div className="flex gap-1">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                sort === s.key
                  ? "border-gray-500 bg-white/10 text-white"
                  : "border-gray-700 text-gray-500 hover:text-gray-200 hover:border-gray-600"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a raise or paste an address"
              aria-label="Search raises"
              className="bg-gray-800 border border-gray-600 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 w-64 max-w-full"
            />
          </label>
          <p className="text-xs text-gray-500">
            {feed.total} {feed.total === 1 ? "raise" : "raises"} on chain {feed.chainId}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        query.trim() ? (
          <Empty title="Nothing matched" body={`No raise matches "${query.trim()}".`} />
        ) : (
          <Empty
            title="No raises yet"
            body="Be the first. Deploying takes four signatures and about a minute."
            action={<ActionButton onClick={onCreate}><FaPlus /> Start a raise</ActionButton>}
          />
        )
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Row key={row.launch.ido} row={row} />
          ))}
        </div>
      )}
    </>
  );
};

const Row = ({ row }: { row: FeedRow }) => {
  const { launch } = row;
  const social = useSocial({ subject: launch.ido });
  const settledPct =
    row.raised > 0n ? Number((row.distributed * 10000n) / row.raised) / 100 : 0;

  return (
    <Link
      to={`/raise/${launch.ido}`}
      className="block bg-black/40 border border-gray-700 rounded-xl p-5 hover:border-gray-500 hover:bg-black/60 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-cyan-500/25 to-fuchsia-500/25 border border-gray-600 grid place-items-center shrink-0 text-[11px] font-bold">
          {launch.symbol.slice(0, 4)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-100">{launch.name}</span>
            <span className="text-xs text-gray-500">{launch.symbol}</span>
            {row.finalized ? (
              <Tag tone="emerald">tally published</Tag>
            ) : (
              <Tag tone="amber">accepting funds</Tag>
            )}
            {row.locked && <Tag tone="violet">splits frozen</Tag>}
            {social.isConnected && social.available && (
              <button
                onClick={(ev) => {
                  // The whole card is a link; saving must not navigate.
                  ev.preventDefault();
                  ev.stopPropagation();
                  social.toggleSave();
                }}
                disabled={social.busy}
                aria-label={social.isSaved ? "Remove from watchlist" : "Save to watchlist"}
                className="ml-auto text-gray-600 hover:text-amber-400 transition-colors disabled:opacity-40"
              >
                {social.isSaved ? (
                  <FaBookmark className="text-amber-400 text-xs" />
                ) : (
                  <FaRegBookmark className="text-xs" />
                )}
              </button>
            )}
          </div>

          {launch.description && (
            <p className="text-xs text-gray-400 mt-1.5">{launch.description}</p>
          )}

          <p className="text-[11px] text-gray-600 mt-1.5">
            started by {short(launch.creator)} · vault {short(launch.feeRouter)}
          </p>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <Stat
              label="raised"
              value={`${Number(row.format(row.raised)).toLocaleString()} ${row.assetSymbol}`}
            />
            <Stat
              label="paid out"
              value={`${settledPct.toFixed(0)}%`}
              sub={`${Number(row.format(row.distributed)).toLocaleString()} ${row.assetSymbol}`}
            />
            <Stat label="splits" value={`${row.splitCount} recipients`} />
          </div>
        </div>
      </div>
    </Link>
  );
};

const Tag = ({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "emerald" | "amber" | "violet";
}) => {
  const tones = {
    emerald: "border-emerald-800 text-emerald-400",
    amber: "border-amber-800 text-amber-400",
    violet: "border-violet-800 text-violet-400",
  } as const;
  return (
    <span
      className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 border rounded ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div>
    <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
    <p className="text-sm font-bold text-gray-100 break-all">{value}</p>
    {sub && <p className="text-[10px] text-gray-600 break-all">{sub}</p>}
  </div>
);

const Empty = ({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) => (
  <div className="border border-dashed border-gray-700 rounded-xl p-10 text-center">
    <p className="text-gray-200 font-bold">{title}</p>
    <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">{body}</p>
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

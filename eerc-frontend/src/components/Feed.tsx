import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaPlus, FaSearch, FaBookmark, FaRegBookmark } from "react-icons/fa";
import { useSocial } from "../hooks/useSocial";
import { ActionButton } from "./ActionButton";
import { useRegistryFeed, SORTS, type FeedSort, type FeedRow } from "../hooks/useRegistryFeed";
import { useProtocolStats } from "../hooks/useProtocolStats";
import { FeedSkeleton, StatSkeleton } from "./Skeleton";

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
  const stats = useProtocolStats();

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
      <header className="mb-6">
        <h1 className="text-[length:var(--t-lead)] font-bold tracking-tight">Raises</h1>
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-1 max-w-2xl">
          Sealed contribution rounds. What each backer puts in stays encrypted;
          the split, the tally and every claim are public.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {feed.isLoading ? (
            Array.from({ length: 4 }, (_, i) => <StatSkeleton key={i} />)
          ) : (
            <>
          <Headline label="Raises" value={String(stats.raises)} />
          <Headline label="Accepting funds" value={String(stats.open)} accent="text-[var(--ochre)]" />
          <Headline
            label="Raised in total"
            value={stats.raised > 0n ? `${stats.compact(stats.raised)} ${stats.symbol}` : "—"}
            accent="text-[var(--lichen)]"
          />
          <Headline
            label="Paid out"
            value={stats.distributed > 0n ? `${stats.compact(stats.distributed)} ${stats.symbol}` : "—"}
          />
            </>
          )}
        </div>
      </header>

      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div className="flex gap-1">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`px-3 py-1.5 text-[length:var(--t-fine)]  border transition-colors ${
                sort === s.key
                  ? "border-[var(--rule)] bg-[var(--snow-sunk)] text-[var(--ink)]"
                  : "border-[var(--rule)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-[var(--rule)]"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[length:var(--t-fine)] text-[var(--ink-3)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a raise or paste an address"
              aria-label="Search raises"
              className="bg-[var(--snow-sunk)] border border-[var(--rule)]  pl-8 pr-3 py-1.5 text-[length:var(--t-fine)] text-[var(--ink)] placeholder-gray-500 outline-none  w-64 max-w-full"
            />
          </label>
          <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
            {feed.total} {feed.total === 1 ? "raise" : "raises"} on chain {feed.chainId}
          </p>
        </div>
      </div>

      {feed.isLoading ? (
        <FeedSkeleton />
      ) : rows.length === 0 ? (
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
      className="block bg-[var(--sheet)] border border-[var(--rule)]  p-5 hover:border-[var(--rule)] hover:bg-[var(--sheet)] transition-colors focus:outline-none"
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11  bg-[var(--fjord-wash)] border border-[var(--rule)] grid place-items-center shrink-0 text-[length:var(--t-fine)] font-bold">
          {launch.symbol.slice(0, 4)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[var(--ink)]">{launch.name}</span>
            <span className="text-[length:var(--t-fine)] text-[var(--ink-3)]">{launch.symbol}</span>
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
                className="ml-auto text-[var(--ink-3)] hover:text-[var(--ochre)] transition-colors disabled:opacity-40"
              >
                {social.isSaved ? (
                  <FaBookmark className="text-[var(--ochre)] text-[length:var(--t-fine)]" />
                ) : (
                  <FaRegBookmark className="text-[length:var(--t-fine)]" />
                )}
              </button>
            )}
          </div>

          {launch.description && (
            <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-1.5">{launch.description}</p>
          )}

          <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-1.5">
            started by {short(launch.creator)} · vault {short(launch.feeRouter)}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
            <Stat
              label="raised"
              value={Number(row.format(row.raised)).toLocaleString()}
              sub={row.assetSymbol}
            />
            <Stat
              label="paid out"
              value={`${settledPct.toFixed(0)}%`}
              sub={`${Number(row.format(row.distributed)).toLocaleString()} ${row.assetSymbol}`}
            />
            <Stat label="recipients" value={String(row.splitCount)} />
            <Stat
              label="phase"
              value={row.finalized ? "Claiming" : "Open"}
              sub={row.locked ? "splits frozen" : undefined}
            />
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
    emerald: "border-[var(--lichen)] text-[var(--lichen)]",
    amber: "border-[var(--ochre)] text-[var(--ochre)]",
    violet: "border-[var(--fjord)] text-[var(--fjord)]",
  } as const;
  return (
    <span
      className={`text-[length:var(--t-fine)] uppercase tracking-wider px-1.5 py-0.5 border rounded ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div>
    <p className="text-[length:var(--t-fine)] uppercase tracking-wider text-[var(--ink-3)]">{label}</p>
    <p className="text-[length:var(--t-base)] font-bold text-[var(--ink)] truncate" title={value}>{value}</p>
    {sub && <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] truncate">{sub}</p>}
  </div>
);

const Headline = ({
  label,
  value,
  accent = "text-[var(--ink)]",
}: {
  label: string;
  value: string;
  accent?: string;
}) => (
  <div className="bg-[var(--sheet)] border border-[var(--rule)]  p-3.5">
    <p className="text-[length:var(--t-fine)] uppercase tracking-wider text-[var(--ink-3)]">{label}</p>
    <p className={`text-[length:var(--t-base)] font-bold mt-1 tabular truncate ${accent}`} title={value}>{value}</p>
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
  <div className="border border-dashed border-[var(--rule)]  p-10 text-center">
    <p className="text-[var(--ink)] font-bold">{title}</p>
    <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-2 max-w-md mx-auto">{body}</p>
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

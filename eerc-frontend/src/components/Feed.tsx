import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  FaPlus, FaSearch, FaBookmark, FaRegBookmark, FaBolt, FaClock,
  FaFire, FaLayerGroup, FaExchangeAlt, FaChartLine, FaLock, FaFlagCheckered, FaStream,
  FaTimes,
  FaBullhorn,
} from "react-icons/fa";
import { useSocial } from "../hooks/useSocial";
import { useRegistryFeed, type FeedRow } from "../hooks/useRegistryFeed";
import { useProtocolStats } from "../hooks/useProtocolStats";
import { useCurveSummary } from "../hooks/useCurveSummary";
import { usePromoted } from "../hooks/usePromoted";
import { useBoards } from "../hooks/useBoards";
import { ActionButton } from "./ActionButton";
import { FeedSkeleton, StatSkeleton } from "./Skeleton";
import { Avatar } from "./ui/Avatar";
import { Sparkline } from "./ui/Chart";
import { Pills, Meter } from "./ui/Controls";
import { Figure, Empty as SheetEmpty } from "./ui/Panel";
import { short, compact, price as fmtPrice, pct, since } from "./ui/format";

/**
 * The launch feed.
 *
 * A grid of cards rather than a list of rows: a reader scanning launches is
 * comparing them against each other, and a card puts each one's shape — its
 * trace, its progress toward a target, its turnover — in the same place on
 * every tile so the comparison is visual instead of read line by line.
 *
 * What a card reports depends on what the launch actually has. A sealed round
 * that has not opened a market shows its raise and its settlement; one with a
 * live curve shows price, trace and turnover. Neither borrows the other's
 * figures, because a raise has no price and a curve has no tally.
 */

type Lens = "newest" | "raised" | "active" | "watch";

const LENSES = [
  { value: "newest" as const, label: "Newest", icon: <FaClock />, hint: "Most recently published" },
  { value: "active" as const, label: "Open", icon: <FaFire />, hint: "Still accepting contributions" },
  { value: "raised" as const, label: "Top raised", icon: <FaChartLine />, hint: "Largest raise first" },
  { value: "watch" as const, label: "All", icon: <FaLayerGroup />, hint: "Everything on this chain" },
];

const SAVED_KEY = "norr.feed.views.v1";

type SavedView = { name: string; query: string };

export const Feed = ({ onCreate }: { onCreate: () => void }) => {
  const [params, setParams] = useSearchParams();

  /**
   * Saved views.
   *
   * The feed's whole state already lives in the URL, which makes a saved view
   * nothing more than a stored query string — no separate model, no risk of a
   * view meaning something different from the link that produced it. Kept in
   * this browser because it is a working habit, not a fact about the protocol
   * that anyone else needs to verify.
   */
  const [views, setViews] = useState<SavedView[]>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(SAVED_KEY) ?? "[]") as SavedView[];
    } catch {
      return [];
    }
  });

  /**
   * Only the feed's own state is a view.
   *
   * The URL also carries things that have nothing to do with what is being
   * looked at -- the dev wallet flags, for instance -- and baking those into
   * a saved view both made the default view look filtered and carried a
   * development flag into a saved link.
   */
  const viewQuery = (() => {
    const own = new URLSearchParams();
    const sort = params.get("sort");
    const q = params.get("q");
    if (sort) own.set("sort", sort);
    if (q) own.set("q", q);
    return own.toString();
  })();

  const persist = (next: SavedView[]) => {
    setViews(next);
    try {
      window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    } catch {
      /* a blocked store just means views do not survive the session */
    }
  };
  const lens = (params.get("sort") as Lens) ?? "newest";
  const query = params.get("q") ?? "";

  const feed = useRegistryFeed(lens === "watch" ? "newest" : lens);
  const stats = useProtocolStats();
  const { boards } = useBoards();
  const promoted = usePromoted(useMemo(() => feed.rows.map((r) => r.launch.ido), [feed.rows]));

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  // Matches name, ticker, summary and both addresses, so a pasted address
  // finds its raise as readily as a typed name.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = !q
      ? feed.rows
      : feed.rows.filter((r) =>
          [r.launch.name, r.launch.symbol, r.launch.description, r.launch.ido, r.launch.creator]
            .join(" ")
            .toLowerCase()
            .includes(q),
        );

    // Paid slots ride above the chosen sort rather than replacing it: within
    // each group the reader's ordering still holds, and every promoted card
    // is labelled, so placement is visible rather than merely effective.
    return [...matched].sort(
      (a, b) =>
        Number(promoted.isPromoted(b.launch.ido)) - Number(promoted.isPromoted(a.launch.ido)),
    );
  }, [feed.rows, query, promoted]);

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
      <header className="flex items-start justify-between gap-6 flex-wrap mb-5">
        <div>
          <h1 className="lead">Raises</h1>
          <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-1.5 max-w-2xl">
            Sealed contribution rounds. What each backer puts in stays encrypted;
            the split, the tally and every claim are public.
          </p>
        </div>
        <ActionButton onClick={onCreate}>
          <FaPlus /> Start a raise
        </ActionButton>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-6">
        {feed.isLoading ? (
          Array.from({ length: 4 }, (_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <Figure label="Raises" value={String(stats.raises)} />
            <Figure label="Accepting funds" value={String(stats.open)} tone="accent" emissive />
            <Figure
              label="Raised in total"
              value={stats.raised > 0n ? `${stats.compact(stats.raised)} ${stats.symbol}` : "—"}
            />
            <Figure
              label="Paid out"
              value={stats.distributed > 0n ? `${stats.compact(stats.distributed)} ${stats.symbol}` : "—"}
              sub={
                stats.raised > 0n
                  ? `${((Number(stats.distributed) / Number(stats.raised)) * 100).toFixed(0)}% of what was raised`
                  : undefined
              }
            />
          </>
        )}
      </div>

      {views.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <span className="label">Saved</span>
          {views.map((v) => (
            <span key={v.name} className="flex items-center">
              <button
                onClick={() => {
                  // Applied over whatever else the URL carries, so restoring a
                  // view never drops the dev-wallet flags mid-session.
                  const next = new URLSearchParams(params);
                  next.delete("sort");
                  next.delete("q");
                  new URLSearchParams(v.query).forEach((value, key) => next.set(key, value));
                  setParams(next, { replace: true });
                }}
                className="pill"
                aria-pressed={v.query === viewQuery}
              >
                {v.name}
              </button>
              <button
                onClick={() => persist(views.filter((x) => x.name !== v.name))}
                aria-label={`Remove saved view ${v.name}`}
                className="text-[var(--ink-4)] hover:text-[var(--falu)] transition-colors ml-1"
              >
                <FaTimes className="text-[9px]" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <Pills options={LENSES} value={lens} onChange={(v) => setParam("sort", v)} label="Sort raises" />

        <div className="flex items-center gap-3 flex-wrap">
          <label className="relative">
            <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[length:var(--t-fine)] text-[var(--ink-4)]" />
            <input
              value={query}
              onChange={(e) => setParam("q", e.target.value)}
              placeholder="Filter this list"
              aria-label="Filter raises"
              className="bg-[var(--snow-sunk)] border border-[var(--rule)] rounded-[var(--r-control)] pl-7 pr-3 py-1.5 text-[length:var(--t-fine)] text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--ink-4)] transition-colors w-56 max-w-full"
            />
          </label>
          {/* Only offered once the view is actually filtered: saving the
              default view would just be a button that does nothing. */}
          {viewQuery && !views.some((v) => v.query === viewQuery) && (
            <button
              onClick={() => {
                const name = (query.trim() || lens).slice(0, 18);
                persist([...views.filter((v) => v.name !== name), { name, query: viewQuery }]);
              }}
              className="text-[length:var(--t-fine)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors flex items-center gap-1.5"
            >
              <FaBookmark className="text-[9px]" /> Save view
            </button>
          )}
          <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] tabular">
            {rows.length}/{feed.total} on chain {feed.chainId}
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
            action={
              <ActionButton onClick={onCreate}>
                <FaPlus /> Start a raise
              </ActionButton>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
          {rows.map((row) => (
            <LaunchCard
              key={row.launch.ido}
              row={row}
              desk={boards.find((b) => b.id === row.launch.boardId)?.slug}
              promoted={promoted.isPromoted(row.launch.ido)}
              promotedUntil={promoted.until(row.launch.ido)}
            />
          ))}
        </div>
      )}
    </>
  );
};

/* ------------------------------------------------------------------ card */

const LaunchCard = ({
  row,
  desk,
  promoted = false,
  promotedUntil,
}: {
  row: FeedRow;
  desk?: string;
  promoted?: boolean;
  promotedUntil?: number;
}) => {
  const { launch } = row;
  const social = useSocial({ subject: launch.ido });
  const curve = useCurveSummary(launch.ido);

  const settledPct = row.raised > 0n ? Number((row.distributed * 10000n) / row.raised) / 100 : 0;
  const raised = Number(row.format(row.raised));

  return (
    <article
      className="card-link hud relative"
      style={promoted ? { borderColor: "var(--falu-deep)" } : undefined}
    >
      {/* Paid placement is stated on the card that bought it. A promoted feed
          that does not say so is a feed selling its ranking quietly. */}
      {promoted && (
        <p
          className="flex items-center gap-1.5 px-3.5 py-1 border-b border-[var(--rule)] text-[length:var(--t-fine)] uppercase tracking-[0.14em] text-[var(--falu)]"
          title={
            promotedUntil
              ? `Paid slot, runs until ${new Date(promotedUntil * 1000).toLocaleString()}`
              : undefined
          }
        >
          <FaBullhorn className="text-[9px]" aria-hidden="true" /> promoted
        </p>
      )}
      <Link
        to={`/raise/${launch.ido}`}
        className="block p-3.5 focus:outline-none"
        aria-label={`${launch.name} (${launch.symbol})`}
      >
        {/* --- identity --- */}
        <div className="flex items-start gap-3">
          <Avatar
            src={launch.logoURI || undefined}
            seed={launch.ido}
            fallback={launch.symbol}
            size={40}
            badge="A"
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-bold text-[var(--ink)] truncate">{launch.name}</h3>
              <span className="text-[length:var(--t-fine)] text-[var(--ink-3)] shrink-0">
                {launch.symbol}
              </span>
            </div>

            {/* Type, creator, desk — the reference's one-line provenance strip. */}
            <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-0.5 flex items-center gap-1.5 flex-wrap">
              <FaLock className="text-[9px]" aria-hidden="true" />
              <span className="uppercase tracking-[0.1em]">sealed</span>
              <span className="text-[var(--ink-4)]">by</span>
              <span className="text-[var(--ink-2)]">{short(launch.creator)}</span>
              {desk && (
                <>
                  <span className="text-[var(--ink-4)]">on</span>
                  <span className="text-[var(--ink-2)]">/{desk}</span>
                </>
              )}
            </p>
          </div>

          <Badge row={row} curve={curve} />
        </div>

        {launch.description && (
          <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-2.5 clamp-2 min-h-[2.4em]">
            {launch.description}
          </p>
        )}

        {/* --- the body differs by what the launch actually has --- */}
        {/* One fill draws no line and reports a 0.00% change against itself.
            Below two, the raise's own progress is the honest thing to show. */}
        {curve.exists && curve.fills > 1 ? (
          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-[length:var(--t-base)] font-bold tabular emissive text-[var(--ink)]">
                {fmtPrice(curve.price)}
              </span>
              <span
                className="text-[length:var(--t-fine)] font-bold tabular"
                style={{ color: curve.change >= 0 ? "var(--gain)" : "var(--loss)" }}
              >
                {pct(curve.change)}
              </span>
            </div>
            <Sparkline points={curve.prices} height={54} />
          </div>
        ) : (
          <div className="mt-3">
            <Meter
              value={Number(row.distributed)}
              max={Number(row.raised) || 1}
              left={
                <span className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
                  raised{" "}
                  <span className="text-[var(--ink)] font-bold tabular">
                    {compact(raised)} {row.assetSymbol}
                  </span>
                </span>
              }
              right={
                <span className="text-[length:var(--t-fine)] text-[var(--ink-3)] tabular">
                  {settledPct.toFixed(0)}% paid out
                </span>
              }
            />
            <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-2">
              opened {since(Number(launch.createdAt))} · {row.splitCount}{" "}
              {row.splitCount === 1 ? "recipient" : "recipients"}
            </p>
          </div>
        )}

        {/* --- footer figures --- */}
        <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-[var(--rule)] text-[length:var(--t-fine)] text-[var(--ink-3)]">
          {curve.exists && curve.fills > 1 ? (
            <>
              <span className="flex items-center gap-1.5 tabular">
                <FaExchangeAlt className="text-[10px]" aria-hidden="true" />
                {compact(curve.fills)} fills
              </span>
              <span className="flex items-center gap-1.5 tabular">
                <FaChartLine className="text-[10px]" aria-hidden="true" />
                {compact(curve.format(curve.volume))} vol
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 tabular">
                <FaBolt className="text-[10px]" aria-hidden="true" />
                {row.finalized ? "tally published" : "accepting"}
              </span>
              <span className="flex items-center gap-1.5 tabular">
                {row.locked ? "splits frozen" : "splits open"}
              </span>
            </>
          )}
        </div>
      </Link>

      {/* Sits outside the link: saving must not navigate. */}
      {social.isConnected && social.available && (
        <button
          onClick={social.toggleSave}
          disabled={social.busy}
          aria-label={social.isSaved ? "Remove from watchlist" : "Save to watchlist"}
          className="absolute bottom-3 right-3 text-[var(--ink-4)] hover:text-[var(--falu)] transition-colors disabled:opacity-40"
        >
          {social.isSaved ? (
            <FaBookmark className="text-[var(--falu)] text-[length:var(--t-fine)]" />
          ) : (
            <FaRegBookmark className="text-[length:var(--t-fine)]" />
          )}
        </button>
      )}
    </article>
  );
};

/**
 * The one badge a card carries.
 *
 * Ranked by what most changes a reader's decision: a graduated curve is
 * finished, a high-water mark is the number a trader looks for, and a raise
 * that is still accepting is the one they can still join.
 */
const Badge = ({
  row,
  curve,
}: {
  row: FeedRow;
  curve: ReturnType<typeof useCurveSummary>;
}) => {
  if (curve.exists && curve.graduated) {
    return (
      <span className="mark mark--settled shrink-0">
        <FaFlagCheckered className="text-[9px]" /> graduated
      </span>
    );
  }
  if (curve.exists && curve.ath > 0) {
    return (
      <span className="mark mark--live shrink-0 tabular" title="Distance from the high-water mark">
        ath {curve.fromAth === 0 ? "now" : `${curve.fromAth.toFixed(1)}%`}
      </span>
    );
  }
  return row.finalized ? (
    <span className="mark mark--sealed shrink-0">claiming</span>
  ) : (
    <span className="mark mark--held shrink-0">open</span>
  );
};

const Empty = ({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) => <SheetEmpty title={title} body={body} action={action} icon={<FaStream />} />;

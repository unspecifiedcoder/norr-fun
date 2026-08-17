import { useState } from "react";
import { FaPlus } from "react-icons/fa";
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
  const feed = useRegistryFeed(sort);

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
        <p className="text-xs text-gray-500">
          {feed.total} {feed.total === 1 ? "raise" : "raises"} on chain {feed.chainId}
        </p>
      </div>

      {feed.rows.length === 0 ? (
        <Empty
          title="No raises yet"
          body="Be the first. Deploying takes four signatures and about a minute."
          action={<ActionButton onClick={onCreate}><FaPlus /> Start a raise</ActionButton>}
        />
      ) : (
        <div className="space-y-3">
          {feed.rows.map((row) => (
            <Row key={row.launch.ido} row={row} />
          ))}
        </div>
      )}
    </>
  );
};

const Row = ({ row }: { row: FeedRow }) => {
  const { launch } = row;
  const settledPct =
    row.raised > 0n ? Number((row.distributed * 10000n) / row.raised) / 100 : 0;

  return (
    <article className="bg-black/40 border border-gray-700 rounded-xl p-5 hover:border-gray-500 transition-colors">
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
    </article>
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

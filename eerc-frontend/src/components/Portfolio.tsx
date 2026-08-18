import { Link } from "react-router-dom";
import { FaCoins, FaBookmark, FaHandHoldingUsd, FaWallet } from "react-icons/fa";
import { Panel, Figure } from "./ui/Panel";
import { Avatar } from "./ui/Avatar";
import { Tabs } from "./ui/Controls";
import { usePortfolio } from "../hooks/usePortfolio";
import { compact, short, since } from "./ui/format";
import { useState } from "react";

type View = "holdings" | "earning" | "watchlist";

/**
 * Where this wallet stands, across every raise.
 *
 * Three questions a returning user actually has — what do I hold, what am I
 * owed, what am I watching — answered on one screen instead of by visiting
 * each launch in turn. Every figure is a live contract read; nothing is
 * cached or inferred.
 */
export const Portfolio = () => {
  const p = usePortfolio();
  const [view, setView] = useState<View>("holdings");

  if (!p.hasRegistry) {
    return <Notice title="Nothing to show" body={`No registry on chain ${p.chainId}.`} />;
  }
  if (!p.isConnected) {
    return (
      <Notice
        title="Connect a wallet"
        body="A portfolio is looked up by address, so there is nothing to show until one is connected."
      />
    );
  }

  const sets: Record<View, typeof p.holdings> = {
    holdings: p.holdings,
    earning: p.earning,
    watchlist: p.watchlist,
  };
  const rows = sets[view];

  return (
    <div className="max-w-5xl">
      <header className="mb-5">
        <h1 className="lead">Portfolio</h1>
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-1.5 max-w-2xl">
          Everything {short(p.address)} holds, is owed, or is watching — read
          live from every raise on this chain.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
        <Figure label="Raises held" value={String(p.holdings.length)} />
        <Figure label="Paying you" value={String(p.earning.length)} />
        <Figure
          label="Ready to collect"
          value={compact(p.asNumber(p.totals.owed))}
          tone="accent"
          emissive
        />
        <Figure label="Collected so far" value={compact(p.asNumber(p.totals.taken))} />
      </div>

      <Tabs
        tabs={[
          { value: "holdings" as const, label: "Holdings", icon: <FaWallet className="text-[10px]" />, count: p.holdings.length },
          { value: "earning" as const, label: "Earning", icon: <FaHandHoldingUsd className="text-[10px]" />, count: p.earning.length },
          { value: "watchlist" as const, label: "Watchlist", icon: <FaBookmark className="text-[10px]" />, count: p.watchlist.length },
        ]}
        value={view}
        onChange={setView}
        label="Portfolio view"
      />

      <div className="mt-4">
        <Panel flush>
          {rows.length === 0 ? (
            <p className="text-[length:var(--t-base)] text-[var(--ink-3)] p-6">
              {view === "holdings"
                ? "No project tokens held on this chain yet. Claim an allocation or buy on a curve."
                : view === "earning"
                  ? "No raise on this chain routes a share to this wallet."
                  : "Nothing saved yet. The bookmark on any raise adds it here, on chain."}
            </p>
          ) : (
            <ul>
              {rows.map((pos) => (
                <li key={pos.row.launch.ido}>
                  <Link
                    to={`/raise/${pos.row.launch.ido}`}
                    className="flex items-center gap-3 px-3.5 py-3 border-b border-[var(--rule)] last:border-0 hover:bg-[var(--sheet-raised)] transition-colors"
                  >
                    <Avatar
                      src={pos.row.launch.logoURI || undefined}
                      seed={pos.row.launch.ido}
                      fallback={pos.row.launch.symbol}
                      size={32}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[length:var(--t-base)] text-[var(--ink)] font-bold truncate">
                        {pos.row.launch.name}{" "}
                        <span className="text-[length:var(--t-fine)] text-[var(--ink-3)] font-normal">
                          {pos.row.launch.symbol}
                        </span>
                      </span>
                      <span className="block text-[length:var(--t-fine)] text-[var(--ink-3)]">
                        opened {since(Number(pos.row.launch.createdAt))}
                        {pos.watched && " · watching"}
                      </span>
                    </span>

                    <span className="text-right shrink-0">
                      {view === "earning" ? (
                        <>
                          <span className="label block">ready</span>
                          <span
                            className="block text-[length:var(--t-fine)] font-bold tabular"
                            style={{ color: pos.owed > 0n ? "var(--gain)" : "var(--ink-4)" }}
                          >
                            {compact(p.asNumber(pos.owed))} {pos.row.assetSymbol}
                          </span>
                          {pos.taken > 0n && (
                            <span className="block text-[length:var(--t-fine)] text-[var(--ink-4)] tabular">
                              {compact(p.asNumber(pos.taken))} taken
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="label block">held</span>
                          <span className="block text-[length:var(--t-fine)] font-bold tabular text-[var(--ink)]">
                            {compact(p.asNumber(pos.held))} {pos.row.launch.symbol}
                          </span>
                        </>
                      )}
                    </span>

                    <FaCoins className="text-[10px] text-[var(--ink-4)] shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
};

const Notice = ({ title, body }: { title: string; body: string }) => (
  <div className="border border-dashed border-[var(--rule)] rounded-[var(--r-panel)] p-12 text-center">
    <p className="text-[var(--ink)] font-bold">{title}</p>
    <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-2 max-w-md mx-auto">{body}</p>
  </div>
);

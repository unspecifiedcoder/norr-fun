import { Link } from "react-router-dom";
import { FaCoins, FaHandHoldingUsd } from "react-icons/fa";
import { Panel, Figure } from "./ui/Panel";
import { Avatar } from "./ui/Avatar";
import { ActionButton } from "./ActionButton";
import { useEarnings } from "../hooks/useEarnings";
import { compact, short } from "./ui/format";

/**
 * Everything this wallet is owed, protocol-wide.
 *
 * Fee release is per-raise on the contract, which would otherwise mean a
 * recipient has to already know which raises name them. This gathers them,
 * and states plainly that nothing moves until it is collected — pull-based
 * payment is the safe design, but only if the reader knows they must pull.
 */
export const Earnings = () => {
  const e = useEarnings();

  if (!e.hasRegistry) {
    return (
      <Empty
        title="Nothing to check here"
        body={`No registry is deployed on chain ${e.chainId}.`}
      />
    );
  }
  if (!e.isConnected) {
    return (
      <Empty
        title="Connect a wallet"
        body="Allocations are looked up by address, so there is nothing to show until one is connected."
      />
    );
  }

  const first = e.rows[0];

  return (
    <div className="max-w-5xl">
      <header className="mb-5">
        <h1 className="lead">Owed to you</h1>
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-1.5 max-w-2xl">
          Every raise that routes a share to this wallet, in one place. Payouts
          are pull-based — nothing moves until you collect it.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
        <Figure
          label="Ready to collect"
          value={first ? `${compact(Number(first.format(e.claimable)))} ${first.assetSymbol}` : "—"}
          tone="accent"
          emissive
        />
        <Figure
          label="Already collected"
          value={first ? `${compact(Number(first.format(e.claimed)))} ${first.assetSymbol}` : "—"}
        />
        <Figure label="Raises paying you" value={String(e.rows.length)} />
      </div>

      {e.owedCount > 0 && (
        <Panel className="mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <ActionButton onClick={e.collectAll} disabled={e.busy}>
              <FaHandHoldingUsd />
              {e.busy ? "Collecting…" : `Collect from all ${e.owedCount}`}
            </ActionButton>
            <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
              One signature per raise, run in order.
            </p>
          </div>
          {e.status && (
            <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-3 break-words">
              {e.status}
            </p>
          )}
        </Panel>
      )}

      <Panel title={`Breakdown${e.rows.length ? ` · ${e.rows.length}` : ""}`} flush>
        {e.rows.length === 0 ? (
          <p className="text-[length:var(--t-base)] text-[var(--ink-3)] p-4">
            No raise on this network routes anything to this wallet yet.
          </p>
        ) : (
          <ul>
            {e.rows.map((r) => (
              <li
                key={r.ido}
                className="flex items-center gap-3 px-3.5 py-3 border-b border-[var(--rule)] last:border-0 flex-wrap hover:bg-[var(--sheet-raised)] transition-colors"
              >
                <Link
                  to={`/raise/${r.ido}`}
                  className="flex items-center gap-3 min-w-0 flex-1"
                >
                  <Avatar seed={r.ido} fallback={r.symbol} size={32} />
                  <span className="min-w-0">
                    <span className="block text-[length:var(--t-base)] text-[var(--ink)] font-bold truncate">
                      {r.name}
                    </span>
                    <span className="block text-[length:var(--t-fine)] text-[var(--ink-3)]">
                      vault {short(r.feeRouter)}
                      {r.released > 0n &&
                        ` · ${compact(Number(r.format(r.released)))} ${r.assetSymbol} collected`}
                    </span>
                  </span>
                </Link>

                <span className="text-right shrink-0">
                  <span className="label block">ready</span>
                  <span
                    className="block text-[length:var(--t-base)] font-bold tabular"
                    style={{ color: r.releasable > 0n ? "var(--gain)" : "var(--ink-4)" }}
                  >
                    {compact(Number(r.format(r.releasable)))} {r.assetSymbol}
                  </span>
                </span>

                <ActionButton
                  onClick={() => e.collectOne(r.feeRouter)}
                  disabled={e.busy || r.releasable === 0n}
                  tone="quiet"
                >
                  <FaCoins /> Collect
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

const Empty = ({ title, body }: { title: string; body: string }) => (
  <div className="border border-dashed border-[var(--rule)] rounded-[var(--r-panel)] p-12 text-center">
    <p className="text-[var(--ink)] font-bold">{title}</p>
    <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-2 max-w-md mx-auto">{body}</p>
  </div>
);

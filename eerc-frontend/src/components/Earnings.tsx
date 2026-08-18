import { Link } from "react-router-dom";
import { FaCoins, FaHandHoldingUsd } from "react-icons/fa";
import { Card } from "./Card";
import { ActionButton } from "./ActionButton";
import { useEarnings } from "../hooks/useEarnings";

/**
 * Everything this wallet is owed, protocol-wide.
 *
 * Fee release is per-raise on the contract, which means a recipient would
 * otherwise have to already know which raises name them. This gathers them.
 */
export const Earnings = () => { const e = useEarnings(); if (!e.hasRegistry) { return (
      <Empty title="Nothing to check here" body={`No registry is deployed on chain ${e.chainId}.`}
      />
    );
  } if (!e.isConnected) { return (
      <Empty title="Connect a wallet" body="Your allocations are looked up by address, so there is nothing to show until one is connected."
      />
    );
  } const first = e.rows[0]; return (
    <>
      <Card title="Owed to you">
        <p className="text-[var(--ink-2)] text-[length:var(--t-base)] mb-5">
          Every raise that routes a share to this wallet, in one place. Payouts are pull-based, so nothing moves until you collect it.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Figure label="Ready to collect" value={first ? `${Number(first.format(e.claimable)).toLocaleString()} ${first.assetSymbol}` : "—"} accent="text-[var(--lichen)]"
          />
          <Figure label="Already collected" value={first ? `${Number(first.format(e.claimed)).toLocaleString()} ${first.assetSymbol}` : "—"}
          />
          <Figure label="Raises paying you" value={String(e.rows.length)} />
        </div>

        {e.owedCount > 0 && (
          <div className="mt-5 flex items-center gap-4 flex-wrap">
            <ActionButton onClick={e.collectAll} disabled={e.busy}>
              <FaHandHoldingUsd />
              {e.busy ? "Collecting…" : `Collect from all ${e.owedCount}`}
            </ActionButton>
            <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
              One signature per raise, run in order.
            </p>
          </div>
        )}

        {e.status && (
          <p className="mt-4 text-[length:var(--t-fine)] text-[var(--ink-2)] break-words">{e.status}</p>
        )}
      </Card>

      <Card title="Breakdown">
        {e.rows.length === 0 ? (
          <p className="text-[length:var(--t-base)] text-[var(--ink-3)]">
            No raise on this network routes anything to this wallet yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {e.rows.map((r) => (
              <li key={r.ido} className="flex items-center gap-3 p-3 border border-[var(--rule)] flex-wrap"
              >
                <Link to={`/raise/${r.ido}`} className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity"
                >
                  <span className="w-8 h-8 rounded bg-[var(--fjord-wash)] border border-[var(--rule)] grid place-items-center text-[length:var(--t-fine)] font-bold shrink-0">
                    {r.symbol.slice(0, 4)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[length:var(--t-base)] text-[var(--ink)] font-bold truncate">
                      {r.name}
                    </span>
                    {r.released > 0n && (
                      <span className="block text-[length:var(--t-fine)] text-[var(--ink-3)]"> collected {Number(r.format(r.released)).toLocaleString()}{" "}
                        {r.assetSymbol} so far
                      </span>
                    )}
                  </span>
                </Link>

                <span className="text-right shrink-0">
                  <span className="block text-[length:var(--t-fine)] uppercase tracking-wider text-[var(--ink-3)]"> ready
                  </span>
                  <span className="block text-[length:var(--t-base)] font-bold text-[var(--lichen)]">
                    {Number(r.format(r.releasable)).toLocaleString()} {r.assetSymbol}
                  </span>
                </span>

                <ActionButton onClick={() => e.collectOne(r.feeRouter)} disabled={e.busy || r.releasable === 0n}
                >
                  <FaCoins /> Collect
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}; const Figure = ({ label, value, accent = "text-[var(--ink)]",
}: { label: string; value: string; accent?: string;
}) => (
  <div className="bg-[var(--sheet)] border border-[var(--rule)] p-3">
    <p className="text-[length:var(--t-fine)] uppercase tracking-wider text-[var(--ink-3)]">{label}</p>
    <p className={`text-[length:var(--t-base)] font-bold break-all ${accent}`}>{value}</p>
  </div>
); const Empty = ({ title, body }: { title: string; body: string }) => (
  <div className="border border-dashed border-[var(--rule)] p-10 text-center">
    <p className="text-[var(--ink)] font-bold">{title}</p>
    <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-2 max-w-md mx-auto">{body}</p>
  </div>
);

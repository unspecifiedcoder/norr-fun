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
        body="Your allocations are looked up by address, so there is nothing to show until one is connected."
      />
    );
  }

  const first = e.rows[0];

  return (
    <>
      <Card title="Owed to you">
        <p className="text-gray-400 text-sm mb-5">
          Every raise that routes a share to this wallet, in one place. Payouts
          are pull-based, so nothing moves until you collect it.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Figure
            label="Ready to collect"
            value={first ? `${Number(first.format(e.claimable)).toLocaleString()} ${first.assetSymbol}` : "—"}
            accent="text-emerald-400"
          />
          <Figure
            label="Already collected"
            value={first ? `${Number(first.format(e.claimed)).toLocaleString()} ${first.assetSymbol}` : "—"}
          />
          <Figure label="Raises paying you" value={String(e.rows.length)} />
        </div>

        {e.owedCount > 0 && (
          <div className="mt-5 flex items-center gap-4 flex-wrap">
            <ActionButton onClick={e.collectAll} disabled={e.busy}>
              <FaHandHoldingUsd />
              {e.busy ? "Collecting…" : `Collect from all ${e.owedCount}`}
            </ActionButton>
            <p className="text-[11px] text-gray-600">
              One signature per raise, run in order.
            </p>
          </div>
        )}

        {e.status && (
          <p className="mt-4 text-xs text-gray-300 break-words">{e.status}</p>
        )}
      </Card>

      <Card title="Breakdown">
        {e.rows.length === 0 ? (
          <p className="text-sm text-gray-500">
            No raise on this network routes anything to this wallet yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {e.rows.map((r) => (
              <li
                key={r.ido}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 flex-wrap"
              >
                <Link
                  to={`/raise/${r.ido}`}
                  className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity"
                >
                  <span className="w-8 h-8 rounded bg-gradient-to-br from-cyan-500/25 to-fuchsia-500/25 border border-gray-600 grid place-items-center text-[9px] font-bold shrink-0">
                    {r.symbol.slice(0, 4)}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-100 font-bold truncate">
                      {r.name}
                    </span>
                    {r.released > 0n && (
                      <span className="block text-[10px] text-gray-600">
                        collected {Number(r.format(r.released)).toLocaleString()}{" "}
                        {r.assetSymbol} so far
                      </span>
                    )}
                  </span>
                </Link>

                <span className="text-right shrink-0">
                  <span className="block text-[10px] uppercase tracking-wider text-gray-500">
                    ready
                  </span>
                  <span className="block text-sm font-bold text-emerald-400">
                    {Number(r.format(r.releasable)).toLocaleString()} {r.assetSymbol}
                  </span>
                </span>

                <ActionButton
                  onClick={() => e.collectOne(r.feeRouter)}
                  disabled={e.busy || r.releasable === 0n}
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
};

const Figure = ({
  label,
  value,
  accent = "text-gray-100",
}: {
  label: string;
  value: string;
  accent?: string;
}) => (
  <div className="bg-black/40 border border-gray-700 rounded-lg p-3">
    <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
    <p className={`text-base font-bold break-all ${accent}`}>{value}</p>
  </div>
);

const Empty = ({ title, body }: { title: string; body: string }) => (
  <div className="border border-dashed border-gray-700 rounded-xl p-10 text-center">
    <p className="text-gray-200 font-bold">{title}</p>
    <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">{body}</p>
  </div>
);

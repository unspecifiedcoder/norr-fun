import { FaGift, FaCheckCircle } from "react-icons/fa";
import { Card } from "./Card";
import { ActionButton } from "./ActionButton";
import { useIdo, type IdoTarget } from "../hooks/useIdo";

export const IdoClaim = ({ target }: { target?: IdoTarget } = {}) => {
  const ido = useIdo(target);

  if (!ido.available) {
    return (
      <Card title="Token Claim">
        <p className="text-gray-400 text-sm">
          No launch deployed on chain{" "}
          <span className="text-indigo-400 font-bold">{ido.chainId}</span>.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Token Claim">
      <p className="text-gray-400 text-sm mb-5">
        Once the sale is tallied, allocations are published as a Merkle root and
        claimed publicly. Contribution amounts stay private; the claim does not.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Stat
          label="Sale status"
          value={ido.finalized ? "Finalized" : "Open"}
          accent={ido.finalized ? "text-emerald-400" : "text-amber-400"}
        />
        <Stat label="Claim pool" value={`${ido.format(ido.poolBalance)} ${ido.symbol}`} />
        <Stat label="Your balance" value={`${ido.format(ido.walletBalance)} ${ido.symbol}`} />
      </div>

      {!ido.isConnected ? (
        <p className="text-xs text-amber-400">Connect a wallet to check your allocation.</p>
      ) : !ido.hasAllocation ? (
        <p className="text-sm text-gray-400">
          No allocation found for this address in the published tally.
        </p>
      ) : (
        <div className="bg-black bg-opacity-30 border border-gray-700 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">Your allocation</p>
            <p className="text-lg font-bold text-gray-100">
              {ido.format(ido.allocation)}{" "}
              <span className="text-sm text-gray-400">{ido.symbol}</span>
            </p>
            {ido.alreadyClaimed > 0n && (
              <p className="text-[11px] text-gray-500">
                claimed {ido.format(ido.alreadyClaimed)}
              </p>
            )}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs text-gray-500">claimable now</p>
            <p className="text-lg font-bold text-emerald-400">
              {ido.format(ido.claimable)}
            </p>
          </div>
          {ido.claimable > 0n ? (
            <ActionButton onClick={ido.claim} disabled={ido.busy || !ido.finalized}>
              <FaGift /> Claim
            </ActionButton>
          ) : (
            <span className="text-xs text-emerald-400 flex items-center gap-2 shrink-0">
              <FaCheckCircle /> Fully claimed
            </span>
          )}
        </div>
      )}

      {ido.finalized && ido.merkleRoot && (
        <p className="mt-4 text-[11px] text-gray-600 break-all">
          root {ido.merkleRoot}
        </p>
      )}

      {ido.status && (
        <p className="mt-3 text-xs text-gray-300 break-words">{ido.status}</p>
      )}
    </Card>
  );
};

const Stat = ({
  label,
  value,
  accent = "text-gray-100",
}: {
  label: string;
  value: string;
  accent?: string;
}) => (
  <div className="bg-black bg-opacity-40 border border-gray-700 rounded-lg p-3">
    <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
    <p className={`text-sm font-bold break-all ${accent}`}>{value}</p>
  </div>
);

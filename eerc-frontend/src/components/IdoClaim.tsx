import { FaGift, FaCheckCircle } from "react-icons/fa";
import { Card } from "./Card";
import { ActionButton } from "./ActionButton";
import { useIdo, type IdoTarget } from "../hooks/useIdo"; export const IdoClaim = ({ target }: { target?: IdoTarget } = {}) => { const ido = useIdo(target); if (!ido.available) { return (
      <Card title="Token Claim">
        <p className="text-[var(--ink-2)] text-[length:var(--t-base)]">
          No launch deployed on chain{" "}
          <span className="text-[var(--fjord)] font-bold">{ido.chainId}</span>.
        </p>
      </Card>
    );
  } return (
    <Card title="Token Claim">
      <p className="text-[var(--ink-2)] text-[length:var(--t-base)] mb-5">
        Once the sale is tallied, allocations are published as a Merkle root and claimed publicly. Contribution amounts stay private; the claim does not.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Stat label="Sale status" value={ido.finalized ? "Finalized" : "Open"} accent={ido.finalized ? "text-[var(--lichen)]" : "text-[var(--ochre)]"}
        />
        <Stat label="Claim pool" value={`${ido.format(ido.poolBalance)} ${ido.symbol}`} />
        <Stat label="Your balance" value={`${ido.format(ido.walletBalance)} ${ido.symbol}`} />
      </div>

      {!ido.isConnected ? (
        <p className="text-[length:var(--t-fine)] text-[var(--ochre)]">Connect a wallet to check your allocation.</p>
      ) : !ido.hasAllocation ? (
        <p className="text-[length:var(--t-base)] text-[var(--ink-2)]">
          No allocation found for this address in the published tally.
        </p>
      ) : (
        <div className="bg-[var(--sheet)] border border-[var(--rule)] p-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">Your allocation</p>
            <p className="text-[length:var(--t-base)] font-bold text-[var(--ink)]">
              {ido.format(ido.allocation)}{" "}
              <span className="text-[length:var(--t-base)] text-[var(--ink-2)]">{ido.symbol}</span>
            </p>
            {ido.alreadyClaimed > 0n && (
              <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]"> claimed {ido.format(ido.alreadyClaimed)}
              </p>
            )}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">claimable now</p>
            <p className="text-[length:var(--t-base)] font-bold text-[var(--lichen)]">
              {ido.format(ido.claimable)}
            </p>
          </div>
          {ido.claimable > 0n ? (
            <ActionButton onClick={ido.claim} disabled={ido.busy || !ido.finalized}>
              <FaGift /> Claim
            </ActionButton>
          ) : (
            <span className="text-[length:var(--t-fine)] text-[var(--lichen)] flex items-center gap-2 shrink-0">
              <FaCheckCircle /> Fully claimed
            </span>
          )}
        </div>
      )}

      {ido.finalized && ido.merkleRoot && (
        <p className="mt-4 text-[length:var(--t-fine)] text-[var(--ink-3)] break-all"> root {ido.merkleRoot}
        </p>
      )}

      {ido.status && (
        <p className="mt-3 text-[length:var(--t-fine)] text-[var(--ink-2)] break-words">{ido.status}</p>
      )}
    </Card>
  );
}; const Stat = ({ label, value, accent = "text-[var(--ink)]",
}: { label: string; value: string; accent?: string;
}) => (
  <div className="bg-[var(--sheet)] border border-[var(--rule)] p-3">
    <p className="text-[length:var(--t-fine)] uppercase tracking-wider text-[var(--ink-3)]">{label}</p>
    <p className={`text-[length:var(--t-base)] font-bold break-all ${accent}`}>{value}</p>
  </div>
);

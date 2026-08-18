import { FaGift, FaCheckCircle, FaLock } from "react-icons/fa";
import { Panel } from "./ui/Panel";
import { ActionButton } from "./ActionButton";
import { useIdo, type IdoTarget } from "../hooks/useIdo";
import { compact } from "./ui/format";

/**
 * The claim.
 *
 * This is the seam between the two halves of a raise: what each wallet put in
 * was sealed, and what each wallet gets out is published as a Merkle root and
 * claimed in the open. The panel states that distinction rather than
 * assuming it, because it is the whole reason the product exists.
 *
 * Laid out as rows, not tiles: it lives in a 21rem rail, and a three-column
 * grid there breaks "Finalized" across two lines.
 */
export const IdoClaim = ({ target }: { target?: IdoTarget } = {}) => {
  const ido = useIdo(target);

  if (!ido.available) {
    return (
      <Panel title="Token claim">
        <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
          No launch is deployed on chain {ido.chainId}.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Token claim"
      aside={
        ido.finalized ? (
          <span className="mark mark--settled">tallied</span>
        ) : (
          <span className="mark mark--held">open</span>
        )
      }
    >
      <dl className="space-y-1.5 text-[length:var(--t-fine)]">
        <Row
          label="Claim pool"
          value={`${compact(Number(ido.format(ido.poolBalance)))} ${ido.symbol}`}
        />
        <Row
          label="Your balance"
          value={`${compact(Number(ido.format(ido.walletBalance)))} ${ido.symbol}`}
        />
        {ido.hasAllocation && (
          <>
            <Row
              label="Your allocation"
              value={`${compact(Number(ido.format(ido.allocation)))} ${ido.symbol}`}
            />
            {ido.alreadyClaimed > 0n && (
              <Row
                label="Already claimed"
                value={compact(Number(ido.format(ido.alreadyClaimed)))}
              />
            )}
            <Row
              label="Claimable now"
              value={compact(Number(ido.format(ido.claimable)))}
              tone="var(--gain)"
            />
          </>
        )}
      </dl>

      <div className="mt-3 pt-3 border-t border-[var(--rule)]">
        {!ido.isConnected ? (
          <p className="text-[length:var(--t-fine)] text-[var(--ochre)]">
            Connect a wallet to check your allocation.
          </p>
        ) : !ido.hasAllocation ? (
          <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
            No allocation for this address in the published tally.
          </p>
        ) : ido.claimable > 0n ? (
          <ActionButton onClick={ido.claim} disabled={ido.busy || !ido.finalized}>
            <FaGift /> {ido.busy ? "Claiming…" : "Claim"}
          </ActionButton>
        ) : (
          <p className="text-[length:var(--t-fine)] text-[var(--gain)] flex items-center gap-2">
            <FaCheckCircle /> Fully claimed
          </p>
        )}
      </div>

      <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-3 flex items-start gap-2">
        <FaLock className="mt-0.5 shrink-0" />
        Allocations are published as a Merkle root and claimed publicly.
        Contribution amounts stay private; the claim does not.
      </p>

      {ido.finalized && ido.merkleRoot && (
        <p
          className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-2 truncate"
          title={ido.merkleRoot}
        >
          root {ido.merkleRoot}
        </p>
      )}

      {ido.status && (
        <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-2 break-words">
          {ido.status}
        </p>
      )}
    </Panel>
  );
};

const Row = ({ label, value, tone }: { label: string; value: string; tone?: string }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-[var(--ink-3)]">{label}</dt>
    <dd className="tabular font-bold" style={{ color: tone ?? "var(--ink)" }}>
      {value}
    </dd>
  </div>
);

import { FaBullhorn, FaCheck } from "react-icons/fa";
import { Panel } from "./ui/Panel";
import { ActionButton } from "./ActionButton";
import { usePromotion } from "../hooks/usePromotion";

const days = (seconds: bigint) => {
  const d = Number(seconds) / 86_400;
  return d >= 1 ? `${d} day${d === 1 ? "" : "s"}` : `${Math.round(Number(seconds) / 3600)}h`;
};

/**
 * Paid feed placement for one launch.
 *
 * Placement only: buying a slot never changes a launch's economics, the feed
 * labels promoted entries so a reader can tell paid placement from ranking,
 * and slots expire — so an early launch cannot hold the top forever. All
 * three constraints are stated here rather than buried in documentation,
 * because a promoted feed that does not say so is just a dishonest feed.
 */
export const Promote = ({ sale }: { sale: string }) => {
  const p = usePromotion(sale);
  if (!p.available || p.tiers.length === 0) return null;

  return (
    <Panel
      title="Feed placement"
      aside={
        p.isPromoted ? (
          <span className="mark mark--live">
            <FaCheck className="text-[9px]" /> promoted
          </span>
        ) : undefined
      }
    >
      <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mb-4">
        Buy a slot near the top of the feed. It changes where this raise appears
        and nothing else — the split, the sale and the claim are untouched, and
        promoted entries are labelled as such.
      </p>

      {p.isPromoted && (
        <p className="text-[length:var(--t-fine)] text-[var(--gain)] mb-3">
          Promoted until {new Date(Number(p.until) * 1000).toLocaleString()}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {p.tiers.map((t) => (
          <div key={t.id} className="panel panel--sunk p-3 flex flex-col">
            <p className="text-[length:var(--t-base)] font-bold text-[var(--ink)]">{t.name}</p>
            <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-0.5 flex-1">
              {t.duration > 0n ? `Runs ${days(t.duration)}` : "No placement — the default"}
            </p>
            <p className="text-[length:var(--t-base)] text-[var(--ink)] tabular mt-2 pt-2 border-t border-[var(--rule)]">
              {t.price === 0n ? "Free" : `${p.formatPrice(t.price)} ETH`}
            </p>
            <div className="mt-2.5">
              <ActionButton
                onClick={() => p.buy(t)}
                disabled={p.busy || !p.isConnected || t.duration === 0n}
                tone="quiet"
              >
                <FaBullhorn /> Buy
              </ActionButton>
            </div>
          </div>
        ))}
      </div>

      {!p.isConnected && (
        <p className="text-[length:var(--t-fine)] text-[var(--ochre)] mt-3">
          Connect a wallet to buy a slot.
        </p>
      )}
      {p.status && (
        <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-3 break-words">
          {p.status}
        </p>
      )}
    </Panel>
  );
};

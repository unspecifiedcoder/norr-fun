import { FaBullhorn, FaCheck } from "react-icons/fa";
import { Card } from "./Card";
import { ActionButton } from "./ActionButton";
import { usePromotion } from "../hooks/usePromotion";

const days = (seconds: bigint) => {
  const d = Number(seconds) / 86_400;
  return d >= 1 ? `${d} day${d === 1 ? "" : "s"}` : `${Math.round(Number(seconds) / 3600)}h`;
};

/** Buy feed placement for a launch. Placement only — economics are untouched. */
export const Promote = ({ sale }: { sale: string }) => {
  const p = usePromotion(sale);
  if (!p.available || p.tiers.length === 0) return null;

  return (
    <Card title="Feed placement">
      <p className="text-gray-400 text-sm mb-5">
        Buy a slot near the top of the feed. It changes where this raise appears
        and nothing else — the split, the sale and the claim are untouched, and
        promoted entries are labelled as such. Slots run out.
      </p>

      {p.isPromoted && (
        <p className="text-xs text-emerald-400 flex items-center gap-2 mb-4">
          <FaCheck /> Promoted until{" "}
          {new Date(Number(p.until) * 1000).toLocaleString()}
        </p>
      )}

      <ul className="space-y-2">
        {p.tiers.map((t) => (
          <li
            key={t.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 flex-wrap"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-gray-100">{t.name}</span>
              <span className="block text-[11px] text-gray-500">
                {t.duration > 0n ? `Runs ${days(t.duration)}` : "No placement — the default"}
              </span>
            </span>
            <span className="text-sm text-gray-200 shrink-0">
              {t.price === 0n ? "Free" : `${p.formatPrice(t.price)} ETH`}
            </span>
            <ActionButton onClick={() => p.buy(t)} disabled={p.busy || !p.isConnected || t.duration === 0n}>
              <FaBullhorn /> Buy
            </ActionButton>
          </li>
        ))}
      </ul>

      {!p.isConnected && (
        <p className="text-xs text-amber-400 mt-3">Connect a wallet to buy a slot.</p>
      )}
      {p.status && <p className="text-xs text-gray-300 mt-3 break-words">{p.status}</p>}
    </Card>
  );
};

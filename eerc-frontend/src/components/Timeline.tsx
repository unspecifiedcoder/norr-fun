import { FaFlag, FaExchangeAlt, FaFlagCheckered, FaGavel, FaLock } from "react-icons/fa";
import { Panel } from "./ui/Panel";
import { since } from "./ui/format";
import type { MarketState } from "../hooks/useMarket";

/**
 * The life of a raise, in the order it happened.
 *
 * A launch page shows a lot of state and very little sequence, so it is hard
 * to tell at a glance whether a raise is early, settled or finished. Every
 * marker here is derived from something the chain recorded — the registry
 * entry, the first and last fills, the finalisation flag, the graduation flag
 * — and a stage with no evidence behind it is drawn as pending rather than
 * assumed.
 */
export const Timeline = ({
  createdAt,
  finalized,
  m,
}: {
  createdAt: number;
  finalized: boolean;
  m: MarketState;
}) => {
  const first = m.trades[0];
  const last = m.trades[m.trades.length - 1];

  const stages = [
    {
      key: "registered",
      icon: <FaFlag />,
      label: "Published to the registry",
      at: createdAt,
      done: true,
    },
    {
      key: "sealed",
      icon: <FaLock />,
      label: "Sealed round open",
      detail: finalized ? "closed" : "accepting contributions",
      at: createdAt,
      done: true,
    },
    {
      key: "tallied",
      icon: <FaGavel />,
      label: "Tally published",
      detail: finalized
        ? "allocations committed as a Merkle root"
        : "not yet — the operator has not published a root",
      at: undefined,
      done: finalized,
    },
    {
      key: "trading",
      icon: <FaExchangeAlt />,
      label: "Trading opened",
      detail: first
        ? `${m.trades.length} fills, last ${since(last.timestamp)}`
        : "no market yet",
      at: first?.timestamp,
      done: !!first,
    },
    {
      key: "graduated",
      icon: <FaFlagCheckered />,
      label: "Curve graduated",
      detail: m.exists
        ? m.graduated
          ? "reserves released into the split"
          : `${m.progressPct.toFixed(1)}% of the way there`
        : "no curve deployed",
      at: undefined,
      done: m.graduated,
    },
  ];

  return (
    <Panel title="Timeline">
      <ol className="relative">
        {stages.map((s, i) => (
          <li key={s.key} className="flex gap-3 pb-4 last:pb-0 relative">
            {/* The connector stops at the last marker rather than trailing off. */}
            {i < stages.length - 1 && (
              <span
                className="absolute left-[11px] top-6 bottom-0 w-px"
                style={{ background: "var(--rule)" }}
                aria-hidden="true"
              />
            )}
            <span
              className="w-[23px] h-[23px] grid place-items-center border rounded-[var(--r-control)] text-[9px] shrink-0 z-10"
              style={{
                color: s.done ? "var(--falu)" : "var(--ink-4)",
                borderColor: s.done ? "var(--falu-deep)" : "var(--rule)",
                background: s.done ? "var(--falu-wash)" : "var(--sheet)",
              }}
            >
              {s.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-[length:var(--t-fine)] font-bold"
                style={{ color: s.done ? "var(--ink)" : "var(--ink-4)" }}
              >
                {s.label}
              </span>
              {s.detail && (
                <span className="block text-[length:var(--t-fine)] text-[var(--ink-3)]">
                  {s.detail}
                </span>
              )}
            </span>
            {s.at !== undefined && (
              <span className="text-[length:var(--t-fine)] text-[var(--ink-4)] shrink-0 tabular">
                {since(s.at)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
};

import { FaExchangeAlt, FaFlagCheckered } from "react-icons/fa";
import { Card } from "./Card";
import { ActionButton } from "./ActionButton";
import { StyledInput } from "./StyledIntput";
import { useMarket, type TradePoint } from "../hooks/useMarket";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Public trading for a launch, once its sale has settled.
 *
 * Separate from the raise by design: contribution amounts stayed private in
 * the sealed round, and this phase trades the token that was distributed from
 * it. The chart plots the curve's own fills, so every point is a real trade
 * rather than a sampled price.
 */
export const Market = ({ sale }: { sale: string }) => {
  const m = useMarket(sale);
  if (!m.exists) return null;

  const priceLabel = Number(m.format(m.priceX18)).toPrecision(4);

  return (
    <>
      <Card title="Market">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Stat label="Price" value={`${priceLabel} ${m.baseSymbol}`} accent="text-[var(--lichen)]" />
          <Stat label="In the curve" value={`${Number(m.format(m.baseReserve)).toLocaleString()} ${m.baseSymbol}`} />
          <Stat label="Unsold" value={`${Number(m.format(m.tokenReserve)).toLocaleString()} ${m.tokenSymbol}`} />
          <Stat label="Fills" value={String(m.trades.length)} />
        </div>

        {/* Graduation progress */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-[length:var(--t-fine)] text-[var(--ink-3)] mb-1.5">
            <span>
              {m.graduated ? "Graduated" : `Toward graduation — ${m.progressPct.toFixed(1)}%`}
            </span>
            <span>
              {Number(m.format(m.baseReserve)).toLocaleString()} /{" "}
              {Number(m.format(m.graduationTarget)).toLocaleString()} {m.baseSymbol}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--snow-sunk)] overflow-hidden">
            <div
              className={m.graduated ? "h-full bg-[var(--lichen)]" : "h-full bg-[var(--falu)]"}
              style={{ width: `${Math.min(m.progressPct, 100)}%` }}
            />
          </div>
        </div>

        <PriceChart trades={m.trades} />

        {m.graduated ? (
          <p className="mt-5 text-[length:var(--t-base)] text-[var(--fjord)] flex items-center gap-2">
            <FaFlagCheckered /> This curve has graduated. Reserves were released
            and trading here is closed permanently.
          </p>
        ) : (
          <div className="mt-5 border-t border-[var(--rule)] pt-5">
            <div className="flex gap-1 mb-4">
              {(["buy", "sell"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => m.setSide(s)}
                  className={`px-4 py-1.5 text-[length:var(--t-fine)]  border capitalize transition-colors ${
                    m.side === s
                      ? "border-[var(--rule)] bg-[var(--snow-sunk)] text-[var(--ink)]"
                      : "border-[var(--rule)] text-[var(--ink-3)] hover:text-[var(--ink)]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_7rem] gap-3">
              <label className="block">
                <span className="block text-[length:var(--t-fine)] uppercase tracking-wider text-[var(--ink-3)] mb-1.5">
                  {m.side === "buy" ? `Spend (${m.baseSymbol})` : `Sell (${m.tokenSymbol})`}
                </span>
                <StyledInput
                  value={m.amount}
                  onChange={(e) => m.setAmount(e.target.value)}
                  placeholder="0.0"
                  type="number"
                />
              </label>
              <label className="block">
                <span className="block text-[length:var(--t-fine)] uppercase tracking-wider text-[var(--ink-3)] mb-1.5">
                  Slippage %
                </span>
                <StyledInput
                  value={m.slippagePct}
                  onChange={(e) => m.setSlippagePct(e.target.value)}
                  placeholder="1"
                  type="number"
                />
              </label>
            </div>

            <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-2">
              Balance: {Number(m.format(m.side === "buy" ? m.baseBalance : m.tokenBalance)).toLocaleString()}{" "}
              {m.side === "buy" ? m.baseSymbol : m.tokenSymbol}
            </p>

            {m.quote && (
              <div className="mt-3 bg-[var(--sheet)] border border-[var(--rule)]  p-3 text-[length:var(--t-fine)] space-y-1">
                <Line
                  label="You receive"
                  value={`${Number(m.format(m.quote.out)).toLocaleString()} ${
                    m.side === "buy" ? m.tokenSymbol : m.baseSymbol
                  }`}
                />
                <Line
                  label="At worst"
                  value={`${Number(m.format(m.minOut)).toLocaleString()} ${
                    m.side === "buy" ? m.tokenSymbol : m.baseSymbol
                  }`}
                />
                <Line
                  label="Trading fee"
                  value={`${Number(m.format(m.quote.fee)).toPrecision(3)} ${m.baseSymbol} — routed through the launch's split`}
                />
              </div>
            )}

            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <ActionButton
                onClick={m.trade}
                disabled={m.busy || !m.isConnected || !m.quote || m.quote.out === 0n}
              >
                <FaExchangeAlt /> {m.busy ? "Working…" : m.side === "buy" ? "Buy" : "Sell"}
              </ActionButton>

              {m.canGraduate && (
                <ActionButton onClick={m.graduate} disabled={m.busy}>
                  <FaFlagCheckered /> Graduate
                </ActionButton>
              )}

              {!m.isConnected && (
                <p className="text-[length:var(--t-fine)] text-[var(--ochre)]">Connect a wallet to trade.</p>
              )}
            </div>

            {m.status && (
              <p className="mt-3 text-[length:var(--t-fine)] text-[var(--ink-2)] break-words">{m.status}</p>
            )}
          </div>
        )}
      </Card>

      <Card title={`Fills${m.trades.length ? ` (${m.trades.length})` : ""}`}>
        {m.trades.length === 0 ? (
          <p className="text-[length:var(--t-base)] text-[var(--ink-3)]">No trades yet.</p>
        ) : (
          <ul className="space-y-2">
            {[...m.trades].reverse().slice(0, 25).map((t, i) => (
              <li
                key={`${t.blockNumber}-${i}`}
                className="flex items-center gap-3 p-3  border border-[var(--rule)] text-[length:var(--t-fine)] flex-wrap"
              >
                <span
                  className={`uppercase tracking-wider text-[length:var(--t-fine)] px-1.5 py-0.5 rounded border ${
                    t.side === "buy"
                      ? "border-[var(--lichen)] text-[var(--lichen)]"
                      : "border-[var(--falu)] text-[var(--falu)]"
                  }`}
                >
                  {t.side}
                </span>
                <span className="text-[var(--ink-2)] font-mono">{short(t.actor)}</span>
                <span className="text-[var(--ink)] ml-auto">
                  {Number(m.format(t.tokenAmount)).toLocaleString()} {m.tokenSymbol}
                </span>
                <span className="text-[var(--ink-3)]">
                  for {Number(m.format(t.baseAmount)).toPrecision(4)} {m.baseSymbol}
                </span>
                <span className="text-[var(--ink-3)] font-mono">#{t.blockNumber.toString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
};

/**
 * Sparkline of realised prices.
 *
 * Drawn from fills rather than sampled on a clock: with a curve, price only
 * moves when someone trades, so a time axis would be mostly flat padding.
 */
const PriceChart = ({ trades }: { trades: TradePoint[] }) => {
  if (trades.length < 2) {
    return (
      <div className="h-24  border border-dashed border-[var(--rule)] grid place-items-center">
        <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
          Price history appears once there are a couple of fills.
        </p>
      </div>
    );
  }

  const prices = trades.map((t) => Number(t.priceX18) / 1e18);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const W = 600;
  const H = 96;

  const points = prices
    .map((p, i) => {
      const x = (i / (prices.length - 1)) * W;
      const y = H - ((p - min) / span) * (H - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const rising = prices[prices.length - 1] >= prices[0];

  return (
    <div className=" border border-[var(--rule)] bg-[var(--sheet)] p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={rising ? "#34d399" : "#fb7185"}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-[length:var(--t-fine)] text-[var(--ink-3)] mt-1">
        <span>{min.toPrecision(3)}</span>
        <span>{prices.length} fills</span>
        <span>{max.toPrecision(3)}</span>
      </div>
    </div>
  );
};

const Stat = ({
  label,
  value,
  accent = "text-[var(--ink)]",
}: {
  label: string;
  value: string;
  accent?: string;
}) => (
  <div className="bg-[var(--sheet)] border border-[var(--rule)]  p-3">
    <p className="text-[length:var(--t-fine)] uppercase tracking-wider text-[var(--ink-3)]">{label}</p>
    <p className={`text-[length:var(--t-base)] font-bold break-all ${accent}`}>{value}</p>
  </div>
);

const Line = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3">
    <span className="text-[var(--ink-3)]">{label}</span>
    <span className="text-[var(--ink)] text-right">{value}</span>
  </div>
);

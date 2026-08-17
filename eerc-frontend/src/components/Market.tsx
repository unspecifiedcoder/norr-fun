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
          <Stat label="Price" value={`${priceLabel} ${m.baseSymbol}`} accent="text-emerald-400" />
          <Stat label="In the curve" value={`${Number(m.format(m.baseReserve)).toLocaleString()} ${m.baseSymbol}`} />
          <Stat label="Unsold" value={`${Number(m.format(m.tokenReserve)).toLocaleString()} ${m.tokenSymbol}`} />
          <Stat label="Fills" value={String(m.trades.length)} />
        </div>

        {/* Graduation progress */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
            <span>
              {m.graduated ? "Graduated" : `Toward graduation — ${m.progressPct.toFixed(1)}%`}
            </span>
            <span>
              {Number(m.format(m.baseReserve)).toLocaleString()} /{" "}
              {Number(m.format(m.graduationTarget)).toLocaleString()} {m.baseSymbol}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div
              className={m.graduated ? "h-full bg-violet-500" : "h-full bg-gradient-to-r from-cyan-500 to-fuchsia-500"}
              style={{ width: `${Math.min(m.progressPct, 100)}%` }}
            />
          </div>
        </div>

        <PriceChart trades={m.trades} />

        {m.graduated ? (
          <p className="mt-5 text-sm text-violet-400 flex items-center gap-2">
            <FaFlagCheckered /> This curve has graduated. Reserves were released
            and trading here is closed permanently.
          </p>
        ) : (
          <div className="mt-5 border-t border-gray-700 pt-5">
            <div className="flex gap-1 mb-4">
              {(["buy", "sell"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => m.setSide(s)}
                  className={`px-4 py-1.5 text-xs rounded-lg border capitalize transition-colors ${
                    m.side === s
                      ? "border-gray-500 bg-white/10 text-white"
                      : "border-gray-700 text-gray-500 hover:text-gray-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_7rem] gap-3">
              <label className="block">
                <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">
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
                <span className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">
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

            <p className="text-[11px] text-gray-500 mt-2">
              Balance: {Number(m.format(m.side === "buy" ? m.baseBalance : m.tokenBalance)).toLocaleString()}{" "}
              {m.side === "buy" ? m.baseSymbol : m.tokenSymbol}
            </p>

            {m.quote && (
              <div className="mt-3 bg-black/40 border border-gray-700 rounded-lg p-3 text-xs space-y-1">
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
                <p className="text-xs text-amber-400">Connect a wallet to trade.</p>
              )}
            </div>

            {m.status && (
              <p className="mt-3 text-xs text-gray-300 break-words">{m.status}</p>
            )}
          </div>
        )}
      </Card>

      <Card title={`Fills${m.trades.length ? ` (${m.trades.length})` : ""}`}>
        {m.trades.length === 0 ? (
          <p className="text-sm text-gray-500">No trades yet.</p>
        ) : (
          <ul className="space-y-2">
            {[...m.trades].reverse().slice(0, 25).map((t, i) => (
              <li
                key={`${t.blockNumber}-${i}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 text-xs flex-wrap"
              >
                <span
                  className={`uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded border ${
                    t.side === "buy"
                      ? "border-emerald-800 text-emerald-400"
                      : "border-rose-800 text-rose-400"
                  }`}
                >
                  {t.side}
                </span>
                <span className="text-gray-400 font-mono">{short(t.actor)}</span>
                <span className="text-gray-200 ml-auto">
                  {Number(m.format(t.tokenAmount)).toLocaleString()} {m.tokenSymbol}
                </span>
                <span className="text-gray-500">
                  for {Number(m.format(t.baseAmount)).toPrecision(4)} {m.baseSymbol}
                </span>
                <span className="text-gray-600 font-mono">#{t.blockNumber.toString()}</span>
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
      <div className="h-24 rounded-lg border border-dashed border-gray-700 grid place-items-center">
        <p className="text-[11px] text-gray-600">
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
    <div className="rounded-lg border border-gray-700 bg-black/40 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke={rising ? "#34d399" : "#fb7185"}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex justify-between text-[10px] text-gray-600 mt-1">
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
  accent = "text-gray-100",
}: {
  label: string;
  value: string;
  accent?: string;
}) => (
  <div className="bg-black/40 border border-gray-700 rounded-lg p-3">
    <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
    <p className={`text-sm font-bold break-all ${accent}`}>{value}</p>
  </div>
);

const Line = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3">
    <span className="text-gray-500">{label}</span>
    <span className="text-gray-200 text-right">{value}</span>
  </div>
);

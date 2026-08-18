import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FaExchangeAlt, FaFlagCheckered, FaChartBar, FaChartLine } from "react-icons/fa";
import { ActionButton } from "./ActionButton";
import { StyledInput } from "./StyledIntput";
import { Panel } from "./ui/Panel";
import { Segmented, Meter } from "./ui/Controls";
import { Chart, type Fill } from "./ui/Chart";
import { short, compact, price as fmtPrice, ago } from "./ui/format";
import type { MarketState } from "../hooks/useMarket";

/**
 * The public trading phase for a launch, split into the three regions the
 * launch page arranges independently: the chart, the ticket, and the tape.
 *
 * All three read one `useMarket` mounted by the page. Trading is deliberately
 * separate from the raise: contribution amounts stayed private in the sealed
 * round, and this phase trades the token distributed from it.
 */

const FRAMES = [
  { value: "60", label: "1m" },
  { value: "300", label: "5m" },
  { value: "900", label: "15m" },
  { value: "3600", label: "1h" },
  { value: "14400", label: "4h" },
  { value: "86400", label: "1d" },
] as const;

const MODES = [
  { value: "candles" as const, label: "Candles", icon: <FaChartBar className="text-[10px]" /> },
  { value: "line" as const, label: "Line", icon: <FaChartLine className="text-[10px]" /> },
];

/**
 * The chart region.
 *
 * Two scales are offered because they answer different questions: price is
 * what a buyer pays, market cap is what the launch is worth. They are the
 * same series times a constant, so switching must not change the shape —
 * only the numbers on the axis.
 */
export const MarketChart = ({
  m,
  supply,
}: {
  m: MarketState;
  /** Token supply, for the market-cap scale. Omitted hides that option. */
  supply?: number;
}) => {
  const [frame, setFrame] = useState<string>("3600");
  const [mode, setMode] = useState<"candles" | "line">("candles");
  const [scale, setScale] = useState<"price" | "cap">("price");

  const fills: Fill[] = useMemo(
    () =>
      m.trades.map((t) => ({
        t: t.timestamp,
        p: Number(t.priceX18) / 1e18,
        side: t.side,
      })),
    [m.trades],
  );

  const scaleOptions = [
    { value: "price" as const, label: "Price" },
    ...(supply && supply > 0 ? [{ value: "cap" as const, label: "Market cap" }] : []),
  ];

  return (
    <Panel
      flush
      title={
        <div className="flex items-center gap-2 flex-wrap">
          <Segmented
            options={FRAMES}
            value={frame}
            onChange={setFrame}
            label="Chart interval"
            accent
          />
        </div>
      }
      aside={
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {scaleOptions.length > 1 && (
            <Segmented
              options={scaleOptions}
              value={scale}
              onChange={setScale}
              label="Chart scale"
            />
          )}
          <Segmented options={MODES} value={mode} onChange={setMode} label="Chart style" />
        </div>
      }
    >
      <div className="p-2">
        <Chart
          fills={fills}
          mode={mode}
          bucketSeconds={Number(frame)}
          scale={scale === "cap" && supply ? supply : 1}
          height={340}
        />
      </div>
    </Panel>
  );
};

/**
 * The ticket.
 *
 * The quote states what you receive, the floor the tolerance puts under it,
 * and the fee — before the signature, not after. A trade panel that reveals
 * its fee in a wallet prompt is a trade panel that hoped you would not look.
 */
export const TradePanel = ({ m }: { m: MarketState }) => {
  if (m.graduated) {
    return (
      <Panel title="Trading closed">
        <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] flex items-start gap-2">
          <FaFlagCheckered className="text-[var(--gain)] mt-0.5 shrink-0" />
          This curve graduated. Its reserves were released and trading here is
          closed permanently.
        </p>
      </Panel>
    );
  }

  const spending = m.side === "buy" ? m.baseSymbol : m.tokenSymbol;
  const receiving = m.side === "buy" ? m.tokenSymbol : m.baseSymbol;
  const balance = m.side === "buy" ? m.baseBalance : m.tokenBalance;

  return (
    <Panel
      title="Trade"
      aside={
        <Segmented
          options={[
            { value: "buy" as const, label: "Buy" },
            { value: "sell" as const, label: "Sell" },
          ]}
          value={m.side}
          onChange={m.setSide}
          label="Trade side"
          accent
        />
      }
    >
      <label className="block">
        <span className="label block mb-1.5">
          {m.side === "buy" ? `Spend ${spending}` : `Sell ${spending}`}
        </span>
        <StyledInput
          value={m.amount}
          onChange={(e) => m.setAmount(e.target.value)}
          placeholder="0.0"
          type="number"
        />
      </label>

      <div className="flex items-center justify-between gap-3 mt-1.5">
        <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] tabular">
          balance {compact(Number(m.format(balance)))} {spending}
        </p>
        <div className="flex gap-1">
          {[25, 50, 100].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => m.setAmount(String((Number(m.format(balance)) * p) / 100))}
              className="text-[length:var(--t-fine)] text-[var(--ink-3)] border border-[var(--rule)] px-1.5 py-0.5 hover:text-[var(--ink)] hover:border-[var(--rule-strong)] transition-colors"
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      <label className="block mt-3">
        <span className="label block mb-1.5">Slippage tolerance %</span>
        <StyledInput
          value={m.slippagePct}
          onChange={(e) => m.setSlippagePct(e.target.value)}
          placeholder="1"
          type="number"
        />
      </label>

      {m.quote && (
        <dl className="mt-3 panel panel--sunk panel__body text-[length:var(--t-fine)] space-y-1">
          <Line
            label="You receive"
            value={`${compact(Number(m.format(m.quote.out)))} ${receiving}`}
          />
          <Line
            label="At worst"
            value={`${compact(Number(m.format(m.minOut)))} ${receiving}`}
          />
          <Line
            label="Trading fee"
            value={`${Number(m.format(m.quote.fee)).toPrecision(3)} ${m.baseSymbol}`}
            hint="Routed through this launch's payout split."
          />
        </dl>
      )}

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <ActionButton
          onClick={m.trade}
          disabled={m.busy || !m.isConnected || !m.quote || m.quote.out === 0n}
        >
          <FaExchangeAlt /> {m.busy ? "Working…" : m.side === "buy" ? "Buy" : "Sell"}
        </ActionButton>

        {m.canGraduate && (
          <ActionButton onClick={m.graduate} disabled={m.busy} tone="quiet">
            <FaFlagCheckered /> Graduate
          </ActionButton>
        )}
      </div>

      {!m.isConnected && (
        <p className="text-[length:var(--t-fine)] text-[var(--ochre)] mt-3">
          Connect a wallet to trade.
        </p>
      )}
      {m.status && (
        <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-3 break-words">
          {m.status}
        </p>
      )}
    </Panel>
  );
};

/**
 * The tape.
 *
 * Newest first, every row a real fill with its actor, its size and when it
 * landed. No aggregation: on a curve, each fill moved the price, and rolling
 * them up would hide the move.
 */
export const TradesTable = ({ m }: { m: MarketState }) => {
  if (!m.exists) {
    return (
      <p className="text-[length:var(--t-base)] text-[var(--ink-3)] p-4">
        No market is open for this launch yet.
      </p>
    );
  }
  if (m.trades.length === 0) {
    return (
      <p className="text-[length:var(--t-base)] text-[var(--ink-3)] p-4">
        No trades yet. The tape fills in as the curve is used.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[length:var(--t-fine)]">
        <thead>
          <tr className="border-b border-[var(--rule)]">
            <Th>Side</Th>
            <Th>Wallet</Th>
            <Th right>{m.tokenSymbol || "Tokens"}</Th>
            <Th right>{m.baseSymbol || "Paid"}</Th>
            <Th right>Price</Th>
            <Th right>When</Th>
          </tr>
        </thead>
        <tbody>
          {[...m.trades].reverse().slice(0, 50).map((t, i) => (
            <tr
              key={`${t.blockNumber}-${i}`}
              className="border-b border-[var(--rule)] last:border-0 hover:bg-[var(--sheet-raised)] transition-colors"
            >
              <Td>
                <span
                  className="uppercase tracking-[0.1em] font-bold"
                  style={{ color: t.side === "buy" ? "var(--gain)" : "var(--loss)" }}
                >
                  {t.side}
                </span>
              </Td>
              <Td>
                <Link
                  to={`/u/${t.actor}`}
                  className="text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
                >
                  {short(t.actor)}
                </Link>
              </Td>
              <Td right>{compact(Number(m.format(t.tokenAmount)))}</Td>
              <Td right>{compact(Number(m.format(t.baseAmount)))}</Td>
              <Td right>{fmtPrice(Number(t.priceX18) / 1e18)}</Td>
              <Td right>
                <span
                  className="text-[var(--ink-3)]"
                  title={`block ${t.blockNumber.toString()}`}
                >
                  {ago(t.timestamp)}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Graduation progress, for the launch page's side rail. */
export const GraduationRail = ({ m }: { m: MarketState }) => (
  <Meter
    value={Number(m.format(m.baseReserve))}
    max={Number(m.format(m.graduationTarget)) || 1}
    done={m.graduated}
    left={
      <span className="label">
        held{" "}
        <span className="text-[var(--ink)] tabular">
          {compact(Number(m.format(m.baseReserve)))} {m.baseSymbol}
        </span>
      </span>
    }
    right={
      <span className="label">
        goal{" "}
        <span className="text-[var(--ink)] tabular">
          {compact(Number(m.format(m.graduationTarget)))}
        </span>
      </span>
    }
  />
);

/* ------------------------------------------------------------- fragments */

const Th = ({ children, right = false }: { children: React.ReactNode; right?: boolean }) => (
  <th
    className={`label font-medium px-3 py-2 ${right ? "text-right" : "text-left"}`}
    scope="col"
  >
    {children}
  </th>
);

const Td = ({ children, right = false }: { children: React.ReactNode; right?: boolean }) => (
  <td className={`px-3 py-2 tabular ${right ? "text-right" : "text-left"} text-[var(--ink)]`}>
    {children}
  </td>
);

const Line = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-[var(--ink-3)]" title={hint}>
      {label}
    </dt>
    <dd className="text-[var(--ink)] text-right tabular">{value}</dd>
  </div>
);

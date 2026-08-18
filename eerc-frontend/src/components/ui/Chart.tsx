import { useMemo } from "react";
import { price as fmtPrice } from "./format";

export type Fill = {
  /** Unix seconds. Falls back to block number when a block has no timestamp. */
  t: number;
  p: number;
  side: "buy" | "sell";
};

/**
 * A one-line trace, for a feed card.
 *
 * Drawn from realised fills rather than sampled on a clock: with a bonding
 * curve, price only moves when someone trades, so a time axis would be mostly
 * flat padding. The fill under the line is flat and low-opacity — a gradient
 * would be the one decorative thing on the sheet.
 */
export const Sparkline = ({
  points,
  height = 56,
  className = "",
}: {
  points: number[];
  height?: number;
  className?: string;
}) => {
  const W = 300;
  const H = height;

  const path = useMemo(() => {
    if (points.length < 2) return null;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || Math.abs(max) || 1;
    const xy = points.map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - 3 - ((p - min) / span) * (H - 6);
      return [x, y] as const;
    });
    return {
      line: xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "),
      area: `0,${H} ${xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} ${W},${H}`,
      rising: points[points.length - 1] >= points[0],
    };
  }, [points, H]);

  if (!path) {
    return (
      <div
        className={`grid place-items-center ${className}`}
        style={{ height: H }}
        aria-label="No price history yet"
      >
        <span className="text-[length:var(--t-fine)] text-[var(--ink-4)]">
          awaiting fills
        </span>
      </div>
    );
  }

  const stroke = path.rising ? "var(--gain)" : "var(--loss)";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      style={{ height: H, width: "100%", display: "block" }}
      preserveAspectRatio="none"
      role="img"
      aria-label={path.rising ? "Price trending up" : "Price trending down"}
    >
      <polygon points={path.area} fill={stroke} opacity="0.10" />
      <polyline
        points={path.line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export type Candle = { t: number; o: number; h: number; l: number; c: number };

/**
 * Bucket fills into OHLC candles.
 *
 * Every candle is built from real trades — an empty interval produces no
 * candle rather than a flat one carried forward, because a carried candle
 * asserts a trade that never happened.
 */
const toCandles = (fills: Fill[], bucketSeconds: number): Candle[] => {
  if (fills.length === 0) return [];
  const buckets = new Map<number, Fill[]>();
  for (const f of fills) {
    const key = Math.floor(f.t / bucketSeconds) * bucketSeconds;
    const list = buckets.get(key);
    if (list) list.push(f);
    else buckets.set(key, [f]);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, group]) => {
      const ps = group.map((g) => g.p);
      return {
        t,
        o: ps[0],
        c: ps[ps.length - 1],
        h: Math.max(...ps),
        l: Math.min(...ps),
      };
    });
};

/**
 * The launch chart.
 *
 * Candles and a line are the same data at two densities, so they share one
 * scale and one axis: switching modes must not appear to change the price.
 * The opening level is marked because on a launch the only number a reader
 * consistently wants to compare against is where it started.
 */
export const Chart = ({
  fills,
  mode,
  bucketSeconds,
  /** Multiply price into the displayed unit — 1 for price, supply for market cap. */
  scale = 1,
  height = 320,
}: {
  fills: Fill[];
  mode: "candles" | "line";
  bucketSeconds: number;
  scale?: number;
  height?: number;
}) => {
  const candles = useMemo(
    () => toCandles(fills, bucketSeconds).map((c) => ({
      t: c.t,
      o: c.o * scale,
      h: c.h * scale,
      l: c.l * scale,
      c: c.c * scale,
    })),
    [fills, bucketSeconds, scale],
  );

  if (candles.length < 2) {
    return (
      <div className="plot grid place-items-center" style={{ height }}>
        <div className="text-center px-6">
          <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] uppercase tracking-[0.14em]">
            No price history
          </p>
          <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-1.5 max-w-xs">
            A curve only moves when someone trades. The chart draws itself from
            the first two fills.
          </p>
        </div>
      </div>
    );
  }

  const W = 1000;
  const H = height;
  const PAD_R = 96;   // right gutter for the price scale
  const PAD_B = 26;   // bottom gutter for the time scale
  const plotW = W - PAD_R;
  const plotH = H - PAD_B;

  const lo = Math.min(...candles.map((c) => c.l));
  const hi = Math.max(...candles.map((c) => c.h));
  const span = hi - lo || Math.abs(hi) || 1;
  const pad = span * 0.08;
  const min = lo - pad;
  const max = hi + pad;

  const y = (v: number) => plotH - ((v - min) / (max - min)) * (plotH - 8) - 4;
  const step = plotW / candles.length;
  const bw = Math.max(1.5, Math.min(14, step * 0.62));

  const open = candles[0].o;
  const last = candles[candles.length - 1].c;
  const rising = last >= open;
  const lastColor = rising ? "var(--gain)" : "var(--loss)";

  // Four gridline levels, printed on the right the way a terminal does it.
  const levels = [0, 0.25, 0.5, 0.75, 1].map((f) => min + (max - min) * f);

  const linePoints = candles
    .map((c, i) => `${(i * step + step / 2).toFixed(1)},${y(c.c).toFixed(1)}`)
    .join(" ");

  const stamp = (t: number) => {
    const d = new Date(t * 1000);
    return bucketSeconds >= 86400
      ? d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })
      : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height, display: "block" }}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Price chart, ${candles.length} intervals, ${rising ? "up" : "down"} since open`}
    >
      {/* graticule */}
      {levels.map((v, i) => (
        <g key={i}>
          <line
            x1="0"
            x2={plotW}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--rule)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={plotW + 8}
            y={y(v) + 4}
            fill="var(--ink-3)"
            fontSize="11"
            fontFamily="var(--face-data)"
          >
            {fmtPrice(v)}
          </text>
        </g>
      ))}

      {/* opening level, so every candle can be read as up or down from launch */}
      <line
        x1="0"
        x2={plotW}
        y1={y(open)}
        y2={y(open)}
        stroke="var(--ink-4)"
        strokeWidth="1"
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={plotW + 8}
        y={y(open) + 4}
        fill="var(--ink-3)"
        fontSize="11"
        fontFamily="var(--face-data)"
      >
        open
      </text>

      {mode === "candles" ? (
        candles.map((c, i) => {
          const cx = i * step + step / 2;
          const up = c.c >= c.o;
          const colour = up ? "var(--gain)" : "var(--loss)";
          const top = y(Math.max(c.o, c.c));
          const bot = y(Math.min(c.o, c.c));
          return (
            <g key={c.t}>
              <line
                x1={cx}
                x2={cx}
                y1={y(c.h)}
                y2={y(c.l)}
                stroke={colour}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <rect
                x={cx - bw / 2}
                y={top}
                width={bw}
                height={Math.max(1, bot - top)}
                fill={colour}
              />
            </g>
          );
        })
      ) : (
        <>
          <polygon
            points={`0,${plotH} ${linePoints} ${plotW},${plotH}`}
            fill={lastColor}
            opacity="0.09"
          />
          <polyline
            points={linePoints}
            fill="none"
            stroke={lastColor}
            strokeWidth="1.75"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}

      {/* last price, tagged against the scale */}
      <line
        x1="0"
        x2={plotW}
        y1={y(last)}
        y2={y(last)}
        stroke={lastColor}
        strokeWidth="1"
        strokeDasharray="2 2"
        vectorEffect="non-scaling-stroke"
        opacity="0.7"
      />
      <rect x={plotW + 4} y={y(last) - 9} width={PAD_R - 8} height="18" fill={lastColor} />
      <text
        x={plotW + 8}
        y={y(last) + 4}
        fill="var(--snow)"
        fontSize="11"
        fontWeight="700"
        fontFamily="var(--face-data)"
      >
        {fmtPrice(last)}
      </text>

      {/* time scale */}
      {[0, Math.floor(candles.length / 2), candles.length - 1].map((i, n) => (
        <text
          key={n}
          x={Math.min(plotW - 30, Math.max(0, i * step + step / 2 - 18))}
          y={H - 8}
          fill="var(--ink-3)"
          fontSize="11"
          fontFamily="var(--face-data)"
        >
          {stamp(candles[i].t)}
        </text>
      ))}
    </svg>
  );
};

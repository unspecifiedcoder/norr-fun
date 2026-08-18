/**
 * Formatting shared by every surface.
 *
 * Kept in one place because a figure that reads "50.579K" in the feed and
 * "50579.31" on the launch page reads as two different numbers, and a reader
 * comparing them has to do the conversion the interface refused to do.
 */

/** Collapse an address to its ends. Never used where the full value matters. */
export const short = (a?: string, head = 6, tail = 4) =>
  !a ? "—" : a.length <= head + tail + 1 ? a : `${a.slice(0, head)}…${a.slice(-tail)}`;

/**
 * Display preferences, mirrored for the pure formatters.
 *
 * `compact` and `date` are used in dozens of render paths, most of them deep
 * inside components that have no business subscribing to a preferences hook
 * just to print a number. The Shell publishes the current values here when
 * they change; the formatters read them synchronously. It is a deliberate
 * escape hatch, kept to exactly two values.
 */
let displayPrefs = { compactNumbers: true, dateFormat: "local" as "local" | "iso" };

export const setDisplayPrefs = (next: typeof displayPrefs) => {
  displayPrefs = next;
};

/** A date, written the way the reader asked for. */
export const date = (unixSeconds: number | bigint): string => {
  const d = new Date(Number(unixSeconds) * 1000);
  return displayPrefs.dateFormat === "iso"
    ? d.toISOString().slice(0, 10)
    : d.toLocaleDateString();
};

/**
 * Compact a magnitude the way a ticker does. Two significant places below
 * a thousand, because a price of "0" tells the reader nothing.
 */
export const compact = (n: number): string => {
  if (!Number.isFinite(n)) return "—";
  if (!displayPrefs.compactNumbers) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  if (abs >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs === 0) return "0";
  return n.toPrecision(3);
};

/**
 * Sub-cent prices in exponent-free form: 0.0₄505 rather than 5.05e-5.
 *
 * A launch spends most of its life below a cent, and scientific notation is
 * unreadable at a glance next to a percentage change. The subscript counts
 * the zeros, which is the convention every trading surface has converged on.
 */
export const price = (n: number): string => {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n >= 0.01) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  const zeros = Math.floor(-Math.log10(n)) - 1;
  const digits = Math.round(n * 10 ** (zeros + 4)).toString().slice(0, 3);
  return `0.0${subscript(zeros)}${digits}`;
};

const SUBS = "₀₁₂₃₄₅₆₇₈₉";
const subscript = (n: number) =>
  String(n)
    .split("")
    .map((d) => SUBS[Number(d)])
    .join("");

/** Elapsed time, coarse. Exact timestamps go in a title attribute. */
export const ago = (unixSeconds: number | bigint): string => {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - Number(unixSeconds));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d`;
  return `${Math.floor(s / 2592000)}mo`;
};

/**
 * The same elapsed time as a complete phrase.
 *
 * `ago()` returns a bare magnitude so it can sit in a table column;
 * interpolating that into "opened {ago} ago" produces "opened just now ago".
 * This is what call sites in running prose want.
 */
export const since = (unixSeconds: number | bigint): string => {
  const a = ago(unixSeconds);
  return a === "just now" ? "just now" : a + " ago";
};

/** A signed percentage, always with its sign, always two places. */
export const pct = (n: number): string =>
  `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

/**
 * A stable colour for an address, drawn from the eight allocation pigments.
 *
 * Identicons need to differ per wallet without introducing a hue the palette
 * never agreed to, so the ramp that already exists is reused rather than
 * hashing into full HSL space.
 */
const IDENT = [
  "var(--cat-creator)", "var(--cat-partner)", "var(--cat-rewards)",
  "var(--cat-marketing)", "var(--cat-buyback)", "var(--cat-liquidity)",
  "var(--cat-treasury)", "var(--cat-custom)",
];

export const identity = (seed?: string): string => {
  if (!seed) return IDENT[7];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return IDENT[h % IDENT.length];
};

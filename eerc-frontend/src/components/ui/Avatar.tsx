import { identity } from "./format";

/**
 * A generated mark for a launch with no logo.
 *
 * The ticker in a box is legible but every one looks the same, and a feed of
 * them reads as a list of placeholders. This draws a small deterministic
 * device from the address instead: four cells mirrored into a symmetric
 * eight, in two pigments already in the allocation ramp.
 *
 * Deterministic on purpose. The same address is the same mark on every
 * screen and every reload, so it can be recognised the way a logo would be —
 * a random one would be decoration that actively misleads.
 */
const Generated = ({ seed, size }: { seed: string; size: number }) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;

  const primary = identity(seed);
  const secondary = identity(seed.slice(0, -1) + "x");
  const cells: boolean[] = [];
  for (let i = 0; i < 8; i++) cells.push(((h >> i) & 1) === 1);

  const unit = size / 4;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <rect width={size} height={size} fill="var(--sheet-raised)" />
      {cells.map((on, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        return on ? (
          <g key={i} fill={row % 2 === 0 ? primary : secondary}>
            <rect x={col * unit} y={row * unit} width={unit} height={unit} />
            {/* Mirrored, so the mark reads as one device rather than noise. */}
            <rect x={size - (col + 1) * unit} y={row * unit} width={unit} height={unit} />
          </g>
        ) : null;
      })}
    </svg>
  );
};

/**
 * A launch or wallet mark.
 *
 * Falls back to the ticker on a broken image rather than a broken-image
 * glyph: a creator-supplied URL can 404 or be blocked, and the ticker is the
 * thing the reader was looking for anyway.
 */
export const Avatar = ({
  src,
  seed,
  fallback,
  size = 44,
  badge,
  className = "",
}: {
  src?: string;
  /** Address or slug — decides the fallback pigment. */
  seed?: string;
  fallback?: string;
  size?: number;
  /** Single character riding the corner. The chain a launch lives on. */
  badge?: string;
  className?: string;
}) => (
  <span
    className={`relative inline-flex shrink-0 ${className}`}
    style={{ width: size, height: size }}
  >
    <span
      className="avatar w-full h-full"
      style={{
        fontSize: Math.max(11, Math.round(size / 3.4)),
        color: src ? undefined : identity(seed),
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : seed && size >= 28 ? (
        // Below 28px the generated cells are too small to tell apart, so the
        // ticker stays the better mark at inline sizes.
        <Generated seed={seed} size={size - 2} />
      ) : (
        (fallback ?? "?").slice(0, 4)
      )}
    </span>
    {badge && <span className="avatar-badge" aria-hidden="true">{badge}</span>}
  </span>
);

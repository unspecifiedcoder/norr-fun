import { identity } from "./format";

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
      ) : (
        (fallback ?? "?").slice(0, 4)
      )}
    </span>
    {badge && <span className="avatar-badge" aria-hidden="true">{badge}</span>}
  </span>
);

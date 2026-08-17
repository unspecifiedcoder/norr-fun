/**
 * norr.fun wordmark.
 *
 * Chromatic-aberration treatment: a cyan and a magenta copy sit behind a white
 * core, offset on opposing diagonals, which reads as an RGB channel split. The
 * copies are aria-hidden so the mark announces once to a screen reader.
 *
 * The typeface is a heavy-condensed system stack rather than a webfont, so the
 * header needs no network fetch and cannot flash unstyled text on load.
 */

type LogoProps = {
  /** Any CSS length. Everything scales from this. */
  size?: string;
  className?: string;
};

const WORDMARK = "NORR.FUN";

export const Logo = ({ size = "2.25rem", className = "" }: LogoProps) => (
  <span
    className={`norr-logo ${className}`}
    style={{ fontSize: size }}
    role="img"
    aria-label="norr.fun"
  >
    <span className="norr-logo__stack">
      <span className="norr-logo__ghost norr-logo__ghost--cyan" aria-hidden="true">
        {WORDMARK}
      </span>
      <span className="norr-logo__ghost norr-logo__ghost--magenta" aria-hidden="true">
        {WORDMARK}
      </span>
      <span className="norr-logo__core">{WORDMARK}</span>
    </span>
  </span>
);

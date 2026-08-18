import { useEffect, useRef, useState } from "react";

/**
 * A figure that shows it changed.
 *
 * Chain state arrives asynchronously and often while the reader is looking
 * somewhere else, so a number that swaps silently is a number they will not
 * notice moved. This rolls to the new value over a short ramp and flashes the
 * accent once on arrival.
 *
 * Only the numeric part is animated — the unit, the symbol and any prefix are
 * rendered as given, so "1.0K AVAXTEST" does not turn into a slot machine.
 */
export const Live = ({
  value,
  format,
  className = "",
  title,
}: {
  value: number;
  /** How to render an intermediate value. Keeps units and precision stable. */
  format: (n: number) => string;
  className?: string;
  title?: string;
}) => {
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState(false);
  const from = useRef(value);
  const frame = useRef<number>(0);

  useEffect(() => {
    // First render, or nothing moved: adopt the value without animating.
    if (from.current === value) return;

    const start = performance.now();
    const a = from.current;
    const b = value;
    const DURATION = 420;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      from.current = b;
      setShown(b);
      return;
    }

    setFlash(true);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      // Ease out: the value should settle, not coast.
      const eased = 1 - (1 - t) ** 3;
      setShown(a + (b - a) * eased);
      if (t < 1) frame.current = requestAnimationFrame(step);
      else {
        from.current = b;
        setShown(b);
      }
    };
    frame.current = requestAnimationFrame(step);

    const clearFlash = setTimeout(() => setFlash(false), 700);
    return () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(clearFlash);
    };
  }, [value]);

  return (
    <span className={`tabular ${flash ? "ticked" : ""} ${className}`} title={title}>
      {format(shown)}
    </span>
  );
};

/**
 * Copy-to-clipboard with an acknowledgement.
 *
 * A copy button that does nothing visible is a button people press twice.
 * The icon swaps to a tick for a moment, and the action is announced for a
 * screen reader rather than only drawn.
 */
export const CopyButton = ({
  value,
  label,
  className = "",
  children,
}: {
  value: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) => {
  const [done, setDone] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            await navigator.clipboard?.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1400);
          } catch {
            // A denied clipboard is not worth an error state; the address is
            // on screen and selectable either way.
          }
        }}
        aria-label={done ? `${label} copied` : `Copy ${label}`}
        className={className}
        style={done ? { color: "var(--gain)" } : undefined}
      >
        {done ? <CheckMark /> : children}
      </button>
      <span aria-live="polite" className="sr-only">
        {done ? `${label} copied to clipboard` : ""}
      </span>
    </>
  );
};

const CheckMark = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className="settle">
    <path
      d="M2 6.5 L4.8 9.2 L10 3.4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="square"
    />
  </svg>
);

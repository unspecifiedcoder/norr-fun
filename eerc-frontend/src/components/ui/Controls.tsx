import type { ReactNode } from "react";

export type Option<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Shown in a title attribute — the reason to pick this option. */
  hint?: string;
};

/**
 * One control with one state, drawn as a bounded strip with internal rules.
 *
 * A row of separate buttons says "these are unrelated actions"; a segmented
 * strip says "these are the states of one thing", which is what a timeframe
 * or a chart mode actually is.
 */
export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  accent = false,
  label,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Marks a control that changes *what* is shown, not merely how. */
  accent?: boolean;
  label: string;
}) => (
  <div className="seg" role="group" aria-label={label}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        className="seg__btn"
        data-on={value === o.value}
        data-accent={accent || undefined}
        aria-pressed={value === o.value}
        title={o.hint}
        onClick={() => onChange(o.value)}
      >
        {o.icon}
        {o.label}
      </button>
    ))}
  </div>
);

/** Feed sorts and other filters: bare until chosen, then reversed. */
export const Pills = <T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) => (
  <div className="flex gap-1.5 flex-wrap" role="group" aria-label={label}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        className="pill"
        aria-pressed={value === o.value}
        title={o.hint}
        onClick={() => onChange(o.value)}
      >
        {o.icon}
        {o.label}
      </button>
    ))}
  </div>
);

/**
 * A tab strip.
 *
 * Tabs here switch between views of the *same* subject — trades, discussion,
 * holders of one launch — which is the only case they beat a rail. Navigation
 * between subjects stays in the rail.
 */
export const Tabs = <T extends string>({
  tabs,
  value,
  onChange,
  label,
  aside,
}: {
  tabs: readonly (Option<T> & { count?: number })[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  aside?: ReactNode;
}) => (
  <div className="flex items-end justify-between gap-4">
    <div className="tabbar flex-1 min-w-0" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          className="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
        >
          {t.icon}
          {t.label}
          {t.count !== undefined && t.count > 0 && (
            <span className="tab__count tabular">{t.count}</span>
          )}
        </button>
      ))}
    </div>
    {aside}
  </div>
);

/**
 * Progress toward a stated target.
 *
 * The target is always printed next to the bar. A bar with no denominator is
 * decoration — the reader cannot tell 90% of a small goal from 9% of a large
 * one, and on a launch page that distinction is the whole point.
 */
export const Meter = ({
  value,
  max,
  left,
  right,
  done = false,
  ticked = true,
}: {
  value: number;
  max: number;
  left?: ReactNode;
  right?: ReactNode;
  done?: boolean;
  ticked?: boolean;
}) => {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div>
      {(left || right) && (
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          {left}
          {right}
        </div>
      )}
      <div
        className={`meter ${ticked ? "meter--ticked" : ""}`}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`meter__fill ${done || pct >= 100 ? "meter__fill--done" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

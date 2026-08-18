import type { ReactNode } from "react";

/**
 * A ruled region of the sheet.
 *
 * Differs from Card in that the head is optional and the body padding can be
 * dropped: a chart or a table wants to run to the panel's own rule, and
 * padding it would put a card inside a card.
 */
export const Panel = ({
  title,
  aside,
  children,
  className = "",
  bodyClass = "",
  flush = false,
  hud = false,
}: {
  title?: ReactNode;
  /** Right-aligned slot in the head rule — counts, states, one control. */
  aside?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClass?: string;
  /** Body runs to the panel edge. For charts and full-bleed tables. */
  flush?: boolean;
  /** Draw the HUD corner ticks. Reserved for regions that carry live state. */
  hud?: boolean;
}) => (
  <section className={`panel ${hud ? "hud" : ""} ${className}`}>
    {(title || aside) && (
      <header className="panel__head">
        {typeof title === "string" ? <h2 className="label !text-[var(--ink)]">{title}</h2> : title}
        {aside}
      </header>
    )}
    {children != null && (
      <div className={flush ? bodyClass : `panel__body ${bodyClass}`}>{children}</div>
    )}
  </section>
);

/**
 * Nothing here yet, said properly.
 *
 * An empty state is the first thing a judge sees on a fresh chain, and a bare
 * sentence in grey reads as a component that failed to load. This is drawn as
 * a bounded region in the same idiom as everything else -- corner ticks, a
 * rule, a stated reason -- so an empty surface still looks deliberate.
 */
export const Empty = ({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) => (
  <div className="hud border border-dashed border-[var(--rule)] rounded-[var(--r-panel)] p-10 text-center">
    {icon && (
      <span
        className="w-9 h-9 mx-auto mb-3 grid place-items-center border rounded-[var(--r-control)]"
        style={{ color: "var(--ink-4)", borderColor: "var(--rule)" }}
      >
        {icon}
      </span>
    )}
    <p className="text-[var(--ink)] font-bold">{title}</p>
    <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-2 max-w-md mx-auto">{body}</p>
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

/** A label/figure pair, for the metadata strip above a chart. */
export const Chip = ({
  k,
  v,
  tone,
  title,
}: {
  k: ReactNode;
  v: ReactNode;
  /** Only for market direction and live state. Everything else stays ink. */
  tone?: "gain" | "loss" | "accent";
  title?: string;
}) => (
  <span className="chip" title={title}>
    <span className="chip__k">{k}</span>
    <span
      className="chip__v"
      style={
        tone === "gain"
          ? { color: "var(--gain)" }
          : tone === "loss"
            ? { color: "var(--loss)" }
            : tone === "accent"
              ? { color: "var(--falu)" }
              : undefined
      }
    >
      {v}
    </span>
  </span>
);

/** A stated figure in its own cell. The feed masthead is built from these. */
export const Figure = ({
  label,
  value,
  sub,
  tone,
  emissive = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "gain" | "loss" | "accent";
  emissive?: boolean;
}) => (
  <div className="panel panel__body !py-2.5">
    <p className="label">{label}</p>
    <p
      className={`text-[length:var(--t-base)] font-bold tabular truncate mt-0.5 ${emissive ? "emissive" : ""}`}
      style={
        tone === "gain"
          ? { color: "var(--gain)" }
          : tone === "loss"
            ? { color: "var(--loss)" }
            : tone === "accent"
              ? { color: "var(--falu)" }
              : { color: "var(--ink)" }
      }
    >
      {value}
    </p>
    {sub && <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] truncate">{sub}</p>}
  </div>
);

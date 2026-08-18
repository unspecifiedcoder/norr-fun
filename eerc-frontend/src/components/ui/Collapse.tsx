import { useId, useState, type ReactNode } from "react";
import { FaChevronDown } from "react-icons/fa";

/**
 * An optional section of the launch form.
 *
 * Collapsed sections print their current value in the head, so folding one
 * away never hides what it is set to. A disclosure that hides state is how a
 * creator ships a launch with a fee they never saw.
 */
export const Collapse = ({
  title,
  hint,
  summary,
  badge,
  children,
  defaultOpen = false,
  accent = false,
}: {
  title: string;
  hint?: string;
  /** The section's current setting, printed whether open or shut. */
  summary?: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  /** For the one section that is this product's signature. */
  accent?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <section
      className="panel"
      style={accent ? { borderColor: "var(--falu-deep)" } : undefined}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={id}
        className="w-full flex items-center gap-3 text-left px-3.5 py-3 hover:bg-[var(--sheet-raised)] transition-colors"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[length:var(--t-base)] font-bold text-[var(--ink)]">
              {title}
            </span>
            {badge}
          </span>
          {hint && (
            <span className="block text-[length:var(--t-fine)] text-[var(--ink-3)] mt-0.5">
              {hint}
            </span>
          )}
        </span>
        {summary && (
          <span className="text-[length:var(--t-fine)] text-[var(--ink-2)] text-right shrink-0 hidden sm:block tabular">
            {summary}
          </span>
        )}
        <FaChevronDown
          className={`text-[length:var(--t-fine)] text-[var(--ink-3)] shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div id={id} className="px-3.5 pb-3.5 pt-1 border-t border-[var(--rule)]">
          {children}
        </div>
      )}
    </section>
  );
};

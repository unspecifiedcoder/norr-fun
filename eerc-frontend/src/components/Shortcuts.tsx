import { useEffect, useState } from "react";
import { FaTimes } from "react-icons/fa";

/**
 * The keyboard sheet, on "?".
 *
 * A dense operator surface earns shortcuts, and shortcuts nobody can discover
 * are shortcuts nobody uses. Every row here is a binding that actually
 * exists — the list is not aspirational.
 */
const BINDINGS: { keys: string[]; what: string }[] = [
  { keys: ["⌘", "K"], what: "Command palette — jump to any raise, desk or action" },
  { keys: ["/"], what: "Focus search" },
  { keys: ["?"], what: "This sheet" },
  { keys: ["Esc"], what: "Close the palette or this sheet" },
  { keys: ["↑", "↓"], what: "Move through palette results" },
  { keys: ["↵"], what: "Open the highlighted result" },
];

export const Shortcuts = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el as HTMLElement | null)?.isContentEditable;
      if (e.key === "?" && !typing) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center px-4"
      style={{ background: "rgba(5,6,7,0.72)" }}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="panel w-full max-w-md settle"
        style={{ borderColor: "var(--rule-strong)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="panel__head">
          <h2 className="label !text-[var(--ink)]">Keyboard</h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="text-[var(--ink-4)] hover:text-[var(--ink)] transition-colors"
          >
            <FaTimes className="text-[10px]" />
          </button>
        </header>
        <div className="panel__body">
          <dl className="space-y-2.5">
            {BINDINGS.map((b) => (
              <div key={b.what} className="flex items-baseline gap-3">
                <dt className="flex gap-1 shrink-0 w-20">
                  {b.keys.map((k) => (
                    <span key={k} className="kbd">
                      {k}
                    </span>
                  ))}
                </dt>
                <dd className="text-[length:var(--t-fine)] text-[var(--ink-2)]">{b.what}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
};

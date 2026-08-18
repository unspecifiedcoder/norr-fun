import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastContext, type Toast, type ToastApi, type ToastKind } from "./toast-context";
import { FaCheck, FaTimes, FaCircleNotch, FaExternalLinkAlt } from "react-icons/fa";

/**
 * Transaction feedback.
 *
 * Every meaningful action here costs a signature, and until now the only
 * evidence one had happened was a figure changing somewhere else on the page.
 * A toast states what was signed, that it is in flight, and how it ended --
 * including the revert reason, which is the one thing a person needs when it
 * fails and the one thing wallets bury.
 *
 * Announced through a polite live region as well as drawn, so the state of a
 * pending transaction is available without watching a corner of the screen.
 */

const HOLD_MS = 7000;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { ...t, id }]);
    return id;
  }, []);

  const settle = useCallback(
    (id: number, patch: Partial<Omit<Toast, "id">>) => {
      setToasts((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      // A settled toast clears itself; a pending one never does, because a
      // transaction that vanished without a verdict is the worst outcome.
      const timer = setTimeout(() => dismiss(id), HOLD_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const track: ToastApi["track"] = useCallback(
    async (title, fn, opts) => {
      const started = performance.now();
      const id = push({ kind: "pending", title, detail: opts?.detail });
      try {
        const result = await fn();
        settle(id, {
          kind: "done",
          title,
          detail: undefined,
          hash: opts?.hashOf?.(result as never),
          elapsedMs: Math.round(performance.now() - started),
        });
        return result;
      } catch (err) {
        const e = err as { shortMessage?: string; message?: string };
        settle(id, {
          kind: "failed",
          title,
          detail: e.shortMessage ?? e.message ?? String(err),
        });
        return undefined;
      }
    },
    [push, settle],
  );

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    },
    [],
  );

  const api = useMemo<ToastApi>(() => ({ push, settle, dismiss, track }), [push, settle, dismiss, track]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed bottom-12 right-4 z-50 flex flex-col gap-2 w-[21rem] max-w-[calc(100vw-2rem)] pointer-events-none"
        role="region"
        aria-label="Transaction status"
      >
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
      <p aria-live="polite" className="sr-only">
        {toasts.map((t) => `${t.title}: ${t.kind}${t.detail ? `. ${t.detail}` : ""}`).join(". ")}
      </p>
    </ToastContext.Provider>
  );
};

const TONE: Record<ToastKind, string> = {
  pending: "var(--falu)",
  done: "var(--gain)",
  failed: "var(--falu-bright)",
  info: "var(--ink-3)",
};

const ToastRow = ({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) => (
  <div
    className="toast panel pointer-events-auto"
    style={{ borderColor: toast.kind === "pending" ? "var(--falu-deep)" : "var(--rule)" }}
  >
    <div className="flex items-start gap-2.5 p-3">
      <span className="mt-0.5 shrink-0" style={{ color: TONE[toast.kind] }}>
        {toast.kind === "pending" ? (
          <FaCircleNotch className="text-[11px] spin" />
        ) : toast.kind === "failed" ? (
          <FaTimes className="text-[11px]" />
        ) : (
          <FaCheck className="text-[11px]" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[length:var(--t-fine)] text-[var(--ink)] font-bold">
          {toast.title}
          {toast.elapsedMs !== undefined && toast.elapsedMs > 400 && (
            <span className="font-normal text-[var(--ink-4)] tabular">
              {" "}
              {(toast.elapsedMs / 1000).toFixed(1)}s
            </span>
          )}
        </p>
        {toast.detail && (
          <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-0.5 break-words clamp-3">
            {toast.detail}
          </p>
        )}
        {toast.hash && (
          <p
            className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-1 truncate flex items-center gap-1.5"
            title={toast.hash}
          >
            <FaExternalLinkAlt className="text-[9px]" />
            {toast.hash.slice(0, 10)}…{toast.hash.slice(-8)}
          </p>
        )}
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-[var(--ink-4)] hover:text-[var(--ink)] transition-colors shrink-0"
      >
        <FaTimes className="text-[10px]" />
      </button>
    </div>

    {/* A pending toast carries a moving rule, so an in-flight transaction is
        distinguishable from a settled one at a glance. */}
    {toast.kind === "pending" && <span className="toast__bar" />}
  </div>
);

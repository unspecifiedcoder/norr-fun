import { createContext, useContext } from "react";

/**
 * Transaction feedback, shared.
 *
 * Kept in its own module so the provider file exports only components: mixing
 * a hook and a context into it breaks fast refresh, and a stale module served
 * mid-session is how a working screen starts throwing for no visible reason.
 */

export type ToastKind = "pending" | "done" | "failed" | "info";

export type Toast = {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
  /** Transaction hash, when there is one to point at. */
  hash?: string;
  /** Milliseconds a proof took, for the operations that generate one. */
  elapsedMs?: number;
};

export type ToastApi = {
  /** Open a toast and get its id back so it can be settled later. */
  push: (t: Omit<Toast, "id">) => number;
  /** Move an open toast to its final state. */
  settle: (id: number, patch: Partial<Omit<Toast, "id">>) => void;
  dismiss: (id: number) => void;
  /** Wrap an async action: pending while it runs, settled by its outcome. */
  track: <T>(
    title: string,
    fn: () => Promise<T>,
    opts?: { detail?: string; hashOf?: (result: T) => string | undefined },
  ) => Promise<T | undefined>;
};

export const ToastContext = createContext<ToastApi | null>(null);

/** Toasts are optional: a component outside the provider simply gets no-ops. */
export const useToast = (): ToastApi =>
  useContext(ToastContext) ?? {
    push: () => 0,
    settle: () => {},
    dismiss: () => {},
    track: async (_t, fn) => fn(),
  };

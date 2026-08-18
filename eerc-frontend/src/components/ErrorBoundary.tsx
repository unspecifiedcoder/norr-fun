import { Component, type ErrorInfo, type ReactNode } from "react";
import { FaExclamationTriangle } from "react-icons/fa";

/**
 * Keeps one broken region from taking the whole surface down.
 *
 * This exists because of a real failure: the eERC SDK decrypts balances during
 * render, and a ciphertext it cannot decrypt throws from inside a hook. React
 * unmounts the entire tree for an error thrown in render, so a single
 * unreadable balance turned every screen — the feed, the rail, the launch
 * pages — into a blank page with the explanation only in the console.
 *
 * A wallet-scoped cryptographic failure is a normal condition on a surface
 * like this. It gets reported where it happened, and the rest of the app keeps
 * working.
 */
type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept: the stack is the only way to tell an SDK decryption failure from a
    // genuine bug in this app.
    console.error("Unhandled error in", this.props.label ?? "a view", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="border border-dashed border-[var(--rule)] rounded-[var(--r-panel)] p-10">
        <p className="text-[var(--ink)] font-bold flex items-center gap-2">
          <FaExclamationTriangle className="text-[var(--falu)]" />
          This view could not be shown
        </p>
        <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-2 max-w-xl">
          The rest of the app is unaffected. If this is the private balance
          view, it usually means an encrypted balance on this contract was
          written with a different key than the one this wallet derives — the
          decryption fails rather than returning a wrong number.
        </p>
        <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-3 break-words">
          {this.state.error.message}
        </p>
        <button
          onClick={() => this.setState({ error: null })}
          className="mt-4 px-4 py-2 border border-[var(--rule)] rounded-[var(--r-control)] text-[length:var(--t-fine)] uppercase tracking-[0.09em] text-[var(--ink)] hover:border-[var(--ink)] transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }
}

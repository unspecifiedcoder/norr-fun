import { useEffect, useRef } from "react";
import { usePortfolio } from "./usePortfolio";
import { useToast } from "../components/toast-context";

/**
 * Tell the reader when something they are watching changes.
 *
 * A watchlist that only lists is a bookmark folder. The point of saving a
 * raise is that you want to know when it moves — when the tally lands and
 * claims open, or when the splits are frozen and the economics stop being
 * changeable.
 *
 * Both of those are one-way transitions, which is what makes this honest to
 * announce: the phase is read from the contract on every poll, and a toast
 * fires on the change rather than on the state. The previous phase is held in
 * this browser so a reload does not re-announce a change from last week; the
 * first read after a fresh start records a baseline silently.
 */
const STORE = "norr.watch.phase.v1";

type Phases = Record<string, { finalized: boolean; locked: boolean }>;

const read = (): Phases => {
  try {
    return JSON.parse(window.localStorage.getItem(STORE) ?? "{}") as Phases;
  } catch {
    return {};
  }
};

export function useWatchAlerts() {
  const portfolio = usePortfolio();
  const toast = useToast();
  const seeded = useRef(false);

  useEffect(() => {
    if (portfolio.loading || portfolio.watchlist.length === 0) return;

    const previous = read();
    const next: Phases = { ...previous };
    let changed = false;

    for (const pos of portfolio.watchlist) {
      const key = pos.row.launch.ido.toLowerCase();
      const now = { finalized: pos.row.finalized, locked: pos.row.locked };
      const before = previous[key];

      if (before) {
        if (!before.finalized && now.finalized) {
          toast.push({
            kind: "info",
            title: `${pos.row.launch.name} published its tally`,
            detail: "Allocations are committed on chain. Claims are open.",
          });
        }
        if (!before.locked && now.locked) {
          toast.push({
            kind: "info",
            title: `${pos.row.launch.name} froze its splits`,
            detail: "The payout table can no longer be changed.",
          });
        }
      }

      if (!before || before.finalized !== now.finalized || before.locked !== now.locked) {
        next[key] = now;
        changed = true;
      }
    }

    // The first pass after a fresh start only records where things stand.
    if (!seeded.current) seeded.current = true;

    if (changed) {
      try {
        window.localStorage.setItem(STORE, JSON.stringify(next));
      } catch {
        /* without storage every reload re-baselines, which is the safe way round */
      }
    }
  }, [portfolio.watchlist, portfolio.loading, toast]);
}

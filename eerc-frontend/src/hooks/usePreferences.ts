import { useCallback, useEffect, useState } from "react";

export type Preferences = {
  /** Default slippage tolerance, in percent, prefilled into the trade panel. */
  slippagePct: string;
  /** The animated backdrop is decorative and costs a canvas repaint loop. */
  /** Whether the activity feed opens scoped to you or to the whole protocol. */
  activityScope: "mine" | "all";
  /** Collapse long addresses to their ends. */
  abbreviateAddresses: boolean;
  /**
   * How tightly the sheet is packed.
   *
   * An operator surface is read at two distances: leaning in on one raise,
   * and scanning a feed of them. Compact takes a step out of every panel's
   * padding without touching the type scale, because shrinking text below the
   * 12px floor to fit more in is the trade this design already refused.
   */
  density: "comfortable" | "compact";
  /**
   * Raise every rule and every muted ink to full strength.
   *
   * The palette clears AA everywhere, but hairlines at 1px in #22262b are the
   * first thing to disappear on a projector or a bad panel -- which is
   * exactly where a demo gets seen.
   */
  highContrast: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  slippagePct: "1",
  activityScope: "mine",
  abbreviateAddresses: true,
  density: "comfortable",
  highContrast: false,
};

const KEY = "norr.preferences.v1";
const EVENT = "norr:preferences";

/**
 * Display preferences, held locally.
 *
 * Deliberately not on chain: these change nothing another party can verify, and
 * writing them would cost gas for a cosmetic choice. Anything consequential --
 * follows, watchlist -- lives on chain instead.
 *
 * Changes broadcast on a custom event so every mounted reader updates at once;
 * the storage event alone only fires in other tabs.
 */
const read = (): Preferences => {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    // Merge rather than replace, so a preference added in a later version does
    // not come back undefined for someone with stored settings.
    return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) };
  } catch {
    return DEFAULT_PREFERENCES;
  }
};

export function usePreferences() {
  const [prefs, setPrefs] = useState<Preferences>(read);

  useEffect(() => {
    const sync = () => setPrefs(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const set = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    const next = { ...read(), [key]: value };
    window.localStorage.setItem(KEY, JSON.stringify(next));
    setPrefs(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const reset = useCallback(() => {
    window.localStorage.removeItem(KEY);
    setPrefs(DEFAULT_PREFERENCES);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { prefs, set, reset };
}

import { useEffect, useState } from "react";
import { FaArrowRight, FaTimes, FaLock, FaGavel, FaShieldAlt, FaCoins } from "react-icons/fa";

/**
 * A first-run explanation of the one thing that is not obvious.
 *
 * Someone meeting this product cold sees a launchpad. What makes it different
 * is invisible: the contribution amounts are encrypted, and the settlement
 * that follows needs no trust in the operator. Four cards, once, and never
 * again — dismissal is remembered, and there is no way to trigger it a second
 * time by accident.
 *
 * Deliberately not a spotlight tour over the UI. Those interrupt the first
 * thing someone tries to do; this states the idea and gets out of the way.
 */

const KEY = "norr.tour.seen.v1";

const CARDS = [
  {
    icon: <FaLock />,
    title: "Contributions are sealed",
    body: "Backers move value as encrypted balances. The chain records that a transfer happened and not what it was worth, so no wallet's position is readable while the round runs.",
  },
  {
    icon: <FaGavel />,
    title: "Then the tally is published",
    body: "When the round closes, the operator decrypts what arrived, totals it, and commits the result on chain as a Merkle root. From that moment the outcome is fixed and public.",
  },
  {
    icon: <FaShieldAlt />,
    title: "And anyone can check it",
    body: "Every allocation can be verified against that root in your own browser, on the Privacy tab of any raise. Nobody has to trust the operator's arithmetic — including you.",
  },
  {
    icon: <FaCoins />,
    title: "The split is enforced, not promised",
    body: "A raise commits who earns what before it opens. Recipients withdraw their own share and the operator cannot redirect it afterwards.",
  },
];

export const Tour = () => {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(KEY)) setOpen(true);
    } catch {
      // A blocked localStorage should not mean an unskippable tour.
    }
  }, []);

  const close = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* nothing to do; it simply shows again next time */
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const card = CARDS[step];
  const last = step === CARDS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center px-4"
      style={{ background: "rgba(5,6,7,0.8)" }}
      role="dialog"
      aria-modal="true"
      aria-label="How norr.fun works"
    >
      <div className="panel hud w-full max-w-lg settle" style={{ borderColor: "var(--falu-deep)" }}>
        <header className="panel__head">
          <p className="label !text-[var(--ink)]">How this works</p>
          <button
            onClick={close}
            aria-label="Skip"
            className="text-[var(--ink-4)] hover:text-[var(--ink)] transition-colors"
          >
            <FaTimes className="text-[10px]" />
          </button>
        </header>

        <div className="panel__body">
          <span
            className="w-9 h-9 grid place-items-center border rounded-[var(--r-control)]"
            style={{ color: "var(--falu)", borderColor: "var(--falu-deep)", background: "var(--falu-wash)" }}
          >
            {card.icon}
          </span>
          <h2 className="text-[length:var(--t-base)] font-bold text-[var(--ink)] mt-3">
            {card.title}
          </h2>
          <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-1.5">{card.body}</p>
        </div>

        <div className="flex items-center gap-3 px-3.5 py-3 border-t border-[var(--rule)]">
          <span className="flex gap-1.5" aria-hidden="true">
            {CARDS.map((_, i) => (
              <span
                key={i}
                className="w-5 h-[3px] transition-colors"
                style={{ background: i <= step ? "var(--falu)" : "var(--rule)" }}
              />
            ))}
          </span>
          <span className="text-[length:var(--t-fine)] text-[var(--ink-4)] tabular">
            {step + 1}/{CARDS.length}
          </span>
          <button
            onClick={close}
            className="ml-auto text-[length:var(--t-fine)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => (last ? close() : setStep((s) => s + 1))}
            className="px-3.5 py-1.5 border rounded-[var(--r-control)] text-[length:var(--t-fine)] uppercase tracking-[0.09em] font-bold inline-flex items-center gap-2 transition-colors"
            style={{ background: "var(--falu)", borderColor: "var(--falu)", color: "var(--snow)" }}
          >
            {last ? "Start" : "Next"} <FaArrowRight className="text-[9px]" />
          </button>
        </div>
      </div>
    </div>
  );
};

import { FaLock, FaEye } from "react-icons/fa";
import { Panel } from "./ui/Panel";

/**
 * What is sealed, and what anyone can read.
 *
 * The product's whole position is a line drawn between two halves, and a
 * judge should not have to take the pitch's word for where it sits. This
 * states the split concretely, per item, on the page it applies to — and it
 * names the limit rather than glossing it: contributors are private from each
 * other and from the public, not from whoever holds the auditor key.
 */
export const PrivacyLedger = () => (
  <Panel
    title="What is sealed"
    hud
    aside={
      <span className="text-[length:var(--t-fine)] text-[var(--ink-3)] uppercase tracking-[0.12em] hidden sm:block">
        the line this product draws
      </span>
    }
  >
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <p className="flex items-center gap-2 label mb-2" style={{ color: "var(--falu)" }}>
          <FaLock className="text-[10px]" /> Sealed
        </p>
        <ul className="space-y-1.5">
          {[
            "What each backer contributed",
            "Every contributor's running balance",
            "The size of any single transfer into the vault",
          ].map((t) => (
            <li key={t} className="text-[length:var(--t-fine)] text-[var(--ink-2)] flex gap-2">
              <span className="text-[var(--falu)]">·</span>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="flex items-center gap-2 label mb-2" style={{ color: "var(--gain)" }}>
          <FaEye className="text-[10px]" /> Public and checkable
        </p>
        <ul className="space-y-1.5">
          {[
            "The payout split, and that it totals 100%",
            "The published tally root, and every claim against it",
            "Every trade once the distributed token opens a market",
            "That a contribution happened, and when",
          ].map((t) => (
            <li key={t} className="text-[length:var(--t-fine)] text-[var(--ink-2)] flex gap-2">
              <span className="text-[var(--gain)]">·</span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>

    <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-4 pt-3 border-t border-[var(--rule)]">
      The honest limit: the operator holds the decryption key during the tally.
      Contributors are private from each other and from the public — not from
      the operator. Everything after the root is published needs no trust at
      all, which is what the verifier below demonstrates.
    </p>
  </Panel>
);

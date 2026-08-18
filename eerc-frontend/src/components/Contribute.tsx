import { useState } from "react";
import { Link } from "react-router-dom";
import { FaLock, FaPaperPlane, FaExclamationTriangle, FaCheck } from "react-icons/fa";
import { Panel } from "./ui/Panel";
import { ErrorBoundary } from "./ErrorBoundary";
import { ActionButton } from "./ActionButton";
import { StyledInput } from "./StyledIntput";
import { useEERC } from "../hooks/useEERC";
import { short } from "./ui/format";

/**
 * Contribute to a raise without publishing the amount.
 *
 * This is the product. A backer converts public tokens into encrypted ones and
 * transfers them to the raise's vault; the chain records that a transfer
 * happened and nothing about its size. After the window closes the operator
 * decrypts what arrived, tallies it, and publishes a Merkle root — from which
 * point every allocation and every claim is public.
 *
 * Two rules this panel will not bend:
 *
 * - **Nothing here aggregates contributions.** No running total, no count, no
 *   "raised so far" derived from encrypted transfers. Rendering any of those
 *   while a sale is open is exactly the leak the product exists to prevent —
 *   the raise figures elsewhere on the page come from the public fee router,
 *   which is a different quantity.
 * - **Your own receipt is yours.** The transaction hash is shown to the person
 *   who sent it, because they need it to check their own allocation later.
 */
/**
 * Wrapped, because the SDK decrypts during render.
 *
 * `@avalabs/eerc-sdk@1.0.2` throws out of `useEncryptedBalance` when it cannot
 * decrypt a balance ciphertext ("The last element of the message must be 0").
 * A throw in render unmounts the whole tree, so without this boundary one
 * wallet's unreadable encrypted balance blanks the entire launch page --
 * chart, trades, claim and all. The panel degrades; the page does not.
 */
export const Contribute = (props: { vault: string; finalized: boolean }) => (
  <ErrorBoundary label="contribution panel">
    <ContributePanel {...props} />
  </ErrorBoundary>
);

const ContributePanel = ({
  vault,
  finalized,
}: {
  /** The operator who holds the decryption key and performs the tally. */
  vault: string;
  /** A settled raise takes no more contributions. */
  finalized: boolean;
}) => {
  const e = useEERC();
  const [amount, setAmount] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);

  if (!e.available) return null;

  if (finalized) {
    return (
      <Panel title="Contribute" aside={<span className="mark mark--sealed">closed</span>}>
        <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
          This round is tallied. Contributions are closed; allocations are
          published and claimable above.
        </p>
      </Panel>
    );
  }

  const ready = e.isRegistered && e.isDecryptionKeySet;
  const isVault = e.address?.toLowerCase() === vault.toLowerCase();

  return (
    <Panel
      title="Contribute privately"
      hud
      aside={<span className="mark mark--live">open</span>}
    >
      <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mb-3">
        Send encrypted {e.symbol} to this raise's vault. The chain records that
        a transfer happened, not what it was worth.
      </p>

      <dl className="text-[length:var(--t-fine)] space-y-1 mb-3">
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--ink-3)]">Vault</dt>
          <dd className="text-[var(--ink)]">{short(vault)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--ink-3)]">Your sealed balance</dt>
          <dd className="text-[var(--ink)] tabular">
            {e.isDecryptionKeySet ? `${e.encrypted} ${e.symbol}` : "sealed"}
          </dd>
        </div>
      </dl>

      {!e.address ? (
        <p className="text-[length:var(--t-fine)] text-[var(--ochre)]">
          Connect a wallet to contribute.
        </p>
      ) : isVault ? (
        <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
          This wallet runs the vault for this raise. Contributions come from
          other addresses.
        </p>
      ) : !ready ? (
        <div>
          <p className="text-[length:var(--t-fine)] text-[var(--ochre)] flex items-start gap-2 mb-3">
            <FaExclamationTriangle className="mt-0.5 shrink-0" />
            {e.isDecryptionKeySet
              ? "Register a public key before contributing — the transfer proof is built against it."
              : "Derive your decryption key and register before contributing."}
          </p>
          <Link
            to="/private"
            className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--rule)] rounded-[var(--r-control)] text-[length:var(--t-fine)] uppercase tracking-[0.09em] text-[var(--ink)] hover:border-[var(--ink)] transition-colors"
          >
            <FaLock className="text-[10px]" /> Set up private balance
          </Link>
        </div>
      ) : (
        <>
          <StyledInput
            value={amount}
            onChange={(ev) => setAmount(ev.target.value)}
            placeholder={`Amount in ${e.symbol}`}
            type="number"
          />

          <div className="mt-3">
            <ActionButton
              onClick={async () => {
                const result = await e.transfer(vault, amount, "norr.fun contribution");
                if (result) {
                  setReceipt(result.transactionHash);
                  setAmount("");
                }
              }}
              disabled={!amount || e.busy !== null}
            >
              <FaPaperPlane />
              {e.busy === "transfer" ? "Proving…" : "Contribute privately"}
            </ActionButton>
          </div>

          {e.status && (
            <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-2.5">
              {e.status} This builds a zero-knowledge proof in the browser and
              can take a while.
            </p>
          )}
          {e.error && (
            <p className="text-[length:var(--t-fine)] text-[var(--falu)] mt-2.5 break-words">
              {e.error}
            </p>
          )}
          {receipt && (
            <div className="mt-3 pt-3 border-t border-[var(--rule)]">
              <p className="text-[length:var(--t-fine)] text-[var(--gain)] flex items-center gap-2">
                <FaCheck /> Contribution sent.
              </p>
              <p
                className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-1 truncate"
                title={receipt}
              >
                {receipt}
              </p>
              <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-1.5">
                Keep this. It is your own receipt for checking your allocation
                against the published root.
              </p>
            </div>
          )}
        </>
      )}
    </Panel>
  );
};

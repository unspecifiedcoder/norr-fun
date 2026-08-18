import { useState } from "react";
import {
  FaKey, FaUserCheck, FaArrowDown, FaPaperPlane, FaArrowUp, FaLock,
  FaCheck, FaExclamationTriangle,
} from "react-icons/fa";
import { Panel, Figure } from "./ui/Panel";
import { ErrorBoundary } from "./ErrorBoundary";
import { ActionButton } from "./ActionButton";
import { StyledInput } from "./StyledIntput";
import { useEERC } from "../hooks/useEERC";
import { compact, short } from "./ui/format";

/**
 * The sealed-balance surface.
 *
 * Encrypted value has a setup path that cannot be skipped — derive a key,
 * register the public half, convert public tokens — and a person who lands
 * here without it sees a send form that silently does nothing. So the
 * prerequisites are stated as an ordered strip with the current step marked,
 * and each control is disabled with its reason rather than merely inert.
 *
 * The honest limit is printed on the page rather than left to documentation:
 * amounts are hidden from other contributors and from the public, not from
 * whoever holds the auditor key.
 */
export const PrivateVault = () => (
  <ErrorBoundary label="private balance">
    <Vault />
  </ErrorBoundary>
);

const Vault = () => {
  const e = useEERC();
  const [to, setTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  if (!e.available) {
    return (
      <Notice
        title="Not on this network"
        body={`No encrypted-token deployment is registered for chain ${e.chainId}. Deploy one with scripts/converter/02_deploy-converter.ts, or switch networks.`}
      />
    );
  }
  if (!e.address) {
    return (
      <Notice
        title="Connect a wallet"
        body="An encrypted balance belongs to an address, so there is nothing to show until one is connected."
      />
    );
  }

  const steps = [
    { key: "key", label: "Decryption key", done: e.isDecryptionKeySet, icon: <FaKey /> },
    { key: "register", label: "Registered", done: e.isRegistered, icon: <FaUserCheck /> },
    { key: "funds", label: "Encrypted funds", done: e.encryptedRaw > 0n, icon: <FaLock /> },
  ] as const;

  const balanceLabel = e.unreadable
    ? "unreadable"
    : e.isDecryptionKeySet
      ? `${e.encrypted} ${e.symbol}`
      : "sealed";

  const balanceNote = e.unreadable
    ? "a stored ciphertext will not decrypt with this key"
    : e.isDecryptionKeySet
      ? undefined
      : "derive your key to read it";

  return (
    <div className="max-w-4xl">
      <header className="mb-5">
        <h1 className="lead">Private balance</h1>
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-1.5 max-w-2xl">
          Hold and move {e.symbol} as an encrypted balance. On-chain observers
          see that a transfer happened, not what it was worth.
        </p>
      </header>

      {/* ---- where you are in the setup ---- */}
      <div className="flex items-stretch gap-0 mb-4 border border-[var(--rule)] rounded-[var(--r-panel)] overflow-hidden">
        {steps.map((s, i) => (
          <div
            key={s.key}
            className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 border-r border-[var(--rule)] last:border-r-0"
            style={{ background: s.done ? "var(--sheet-raised)" : "var(--sheet)" }}
          >
            <span
              className="w-5 h-5 grid place-items-center border rounded-[var(--r-control)] text-[9px] shrink-0"
              style={{
                color: s.done ? "var(--gain)" : "var(--ink-4)",
                borderColor: s.done ? "var(--gain)" : "var(--rule)",
              }}
            >
              {s.done ? <FaCheck /> : i + 1}
            </span>
            <span
              className="text-[length:var(--t-fine)] truncate"
              style={{ color: s.done ? "var(--ink)" : "var(--ink-3)" }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {e.error && (
        <p className="panel panel__body mb-3 text-[length:var(--t-fine)] text-[var(--falu)] flex items-start gap-2 break-words">
          <FaExclamationTriangle className="mt-0.5 shrink-0" />
          {e.error}
        </p>
      )}
      {e.status && (
        <p className="panel panel__body mb-3 text-[length:var(--t-fine)] text-[var(--ink-2)]">
          {e.status} This generates a zero-knowledge proof in the browser and
          can take a while.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <Figure
          label="Encrypted balance"
          value={balanceLabel}
          sub={balanceNote}
          tone="accent"
          emissive
        />
        <Figure
          label={`Public ${e.symbol}`}
          value={`${compact(Number(e.formatPublic(e.publicBalance)))} ${e.symbol}`}
          sub="available to convert"
        />
      </div>

      {/* ---- setup ---- */}
      {(!e.isDecryptionKeySet || !e.isRegistered) && (
        <Panel title="Set up" hud className="mb-3">
          <ol className="space-y-4">
            {!e.isDecryptionKeySet && (
              <Step
                n={1}
                title="Derive your decryption key"
                body="Signed by your wallet and derived deterministically, so the same wallet always recovers the same key. It is kept in this browser and never sent anywhere."
              >
                <ActionButton onClick={e.generateKey} disabled={anyBusy(e)}>
                  <FaKey /> {e.busy === "key" ? "Waiting for signature…" : "Derive key"}
                </ActionButton>
              </Step>
            )}

            {e.isDecryptionKeySet && !e.isRegistered && (
              <Step
                n={2}
                title="Register your public key"
                body="Publishes the public half of your key so others can build transfer proofs addressed to you. One transaction, one proof."
              >
                <ActionButton onClick={e.register} disabled={anyBusy(e)}>
                  <FaUserCheck /> {e.busy === "register" ? "Proving…" : "Register"}
                </ActionButton>
              </Step>
            )}
          </ol>
        </Panel>
      )}

      {!e.isAuditorKeySet && (
        <p className="panel panel__body mb-3 text-[length:var(--t-fine)] text-[var(--ochre)] flex items-start gap-2">
          <FaExclamationTriangle className="mt-0.5 shrink-0" />
          This deployment has no auditor key set, so deposits will revert. Run
          scripts/converter/04_set-auditor.ts against it.
        </p>
      )}

      {/* ---- operations ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Panel title="Convert in">
          <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mb-3">
            Turn public {e.symbol} into encrypted {e.symbol}. The deposit itself
            is public; everything you do with the balance afterwards is not.
          </p>
          <StyledInput
            value={depositAmount}
            onChange={(ev) => setDepositAmount(ev.target.value)}
            placeholder={`Amount in ${e.symbol}`}
            type="number"
          />
          <div className="mt-3">
            <ActionButton
              onClick={() => e.deposit(depositAmount).then(() => setDepositAmount(""))}
              disabled={!e.isRegistered || !depositAmount || anyBusy(e)}
            >
              <FaArrowDown /> {e.busy === "deposit" ? "Converting…" : "Convert in"}
            </ActionButton>
          </div>
          {!e.isRegistered && (
            <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-2">
              Register first.
            </p>
          )}
        </Panel>

        <Panel title="Convert out">
          <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mb-3">
            Turn encrypted {e.symbol} back into public {e.symbol}. The amount
            becomes visible at this point — that is what withdrawing means.
          </p>
          <StyledInput
            value={withdrawAmount}
            onChange={(ev) => setWithdrawAmount(ev.target.value)}
            placeholder={`Amount in ${e.symbol}`}
            type="number"
          />
          <div className="mt-3">
            <ActionButton
              onClick={() => e.withdraw(withdrawAmount).then(() => setWithdrawAmount(""))}
              disabled={!e.isRegistered || !withdrawAmount || anyBusy(e)}
              tone="quiet"
            >
              <FaArrowUp /> {e.busy === "withdraw" ? "Proving…" : "Convert out"}
            </ActionButton>
          </div>
        </Panel>
      </div>

      <Panel title="Send privately" className="mt-3">
        <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mb-3">
          The recipient must have registered a public key — a transfer proof is
          built against it, so an unregistered address cannot receive one.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_10rem] gap-2.5">
          <StyledInput
            value={to}
            onChange={(ev) => setTo(ev.target.value)}
            placeholder="Recipient address (0x…)"
          />
          <StyledInput
            value={sendAmount}
            onChange={(ev) => setSendAmount(ev.target.value)}
            placeholder="Amount"
            type="number"
          />
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <ActionButton
            onClick={() =>
              e.transfer(to, sendAmount).then(() => {
                setSendAmount("");
              })
            }
            disabled={!e.isRegistered || !to || !sendAmount || anyBusy(e)}
          >
            <FaPaperPlane /> {e.busy === "transfer" ? "Proving…" : "Send privately"}
          </ActionButton>
          <p className="text-[length:var(--t-fine)] text-[var(--ink-4)]">
            from {short(e.address)}
          </p>
        </div>
      </Panel>

      <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-4 flex items-start gap-2 max-w-2xl">
        <FaLock className="mt-0.5 shrink-0" />
        The honest limit: amounts are hidden from other contributors and from
        the public, not from whoever holds the auditor key on this deployment.
        That key is what makes a tally possible.
      </p>
    </div>
  );
};

/**
 * True while any operation is running.
 *
 * Deliberately not per-step: these all share one wallet and one prover, so a
 * second control offered as live during a proof is a control that will queue
 * behind the first and look broken doing it.
 */
const anyBusy = (e: ReturnType<typeof useEERC>) => e.busy !== null;

const Step = ({
  n,
  title,
  body,
  children,
}: {
  n: number;
  title: string;
  body: string;
  children: React.ReactNode;
}) => (
  <li className="flex items-start gap-3">
    <span className="w-5 h-5 grid place-items-center border border-[var(--rule)] rounded-[var(--r-control)] text-[length:var(--t-fine)] text-[var(--ink-3)] shrink-0 mt-0.5">
      {n}
    </span>
    <div className="min-w-0">
      <p className="text-[length:var(--t-base)] font-bold text-[var(--ink)]">{title}</p>
      <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-0.5 mb-2.5 max-w-xl">
        {body}
      </p>
      {children}
    </div>
  </li>
);

const Notice = ({ title, body }: { title: string; body: string }) => (
  <div className="border border-dashed border-[var(--rule)] rounded-[var(--r-panel)] p-12 text-center">
    <p className="text-[var(--ink)] font-bold">{title}</p>
    <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-2 max-w-md mx-auto">{body}</p>
  </div>
);

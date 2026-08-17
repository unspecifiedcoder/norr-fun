import { FaPlus, FaTrash, FaRocket, FaCheck, FaTimes } from "react-icons/fa";
import { Card } from "./Card";
import { ActionButton } from "./ActionButton";
import { StyledInput } from "./StyledIntput";
import {
  useCreateLaunch,
  CATEGORIES,
  type Category,
  type DeployStep,
} from "../hooks/useCreateLaunch";
import { useBoards } from "../hooks/useBoards";

const CATEGORY_COLORS: Record<string, string> = {
  Creator: "bg-blue-500",
  Partner: "bg-indigo-500",
  Rewards: "bg-emerald-500",
  Marketing: "bg-amber-500",
  Buyback: "bg-rose-500",
  Liquidity: "bg-cyan-500",
  Treasury: "bg-violet-500",
  Custom: "bg-gray-500",
};

export const CreateLaunch = ({ onDone }: { onDone: () => void }) => {
  const c = useCreateLaunch();
  const { boards } = useBoards();
  const chosen = boards.find((b) => b.id === c.draft.boardId);
  const pct = c.totalBps / 100;
  const allocationOk = c.totalBps === 10_000;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-6">
      {/* ---- form ---- */}
      <div>
        <Card title="Identity">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Project name">
              <StyledInput
                value={c.draft.name}
                onChange={(e) => c.update("name", e.target.value)}
                placeholder="e.g. Northern Lights"
              />
            </Field>
            <Field label="Ticker">
              <StyledInput
                value={c.draft.symbol}
                onChange={(e) => c.update("symbol", e.target.value.toUpperCase())}
                placeholder="e.g. NRTH"
              />
            </Field>
            <Field label="Total supply">
              <StyledInput
                value={c.draft.supply}
                onChange={(e) => c.update("supply", e.target.value)}
                placeholder="1000000"
                type="number"
              />
            </Field>
            <Field label="One-line summary">
              <StyledInput
                value={c.draft.description}
                onChange={(e) => c.update("description", e.target.value)}
                placeholder="What is this raise for?"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Publish through a desk">
              <select
                value={String(c.draft.boardId)}
                onChange={(e) => c.update("boardId", BigInt(e.target.value))}
                className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full"
              >
                <option value="0">On my own — no desk</option>
                {boards.map((b) => (
                  <option key={b.slug} value={String(b.id)}>
                    {b.name} (/{b.slug}) — {b.minPartnerBps / 100}% minimum
                  </option>
                ))}
              </select>
            </Field>
            {chosen && chosen.minPartnerBps > 0 && (
              <p className="text-[11px] text-amber-400 mt-2">
                This desk requires at least {chosen.minPartnerBps / 100}% routed to{" "}
                {chosen.owner.slice(0, 6)}…{chosen.owner.slice(-4)}. The registry
                checks your split against that and will reject the raise otherwise.
              </p>
            )}
          </div>
        </Card>

        <Card title="Where the money goes">
          <p className="text-gray-400 text-sm mb-4">
            Split the raise between the people who earn from it. Enforced by the
            contract at settlement — recipients withdraw their own share, and
            the total has to land on 100% before this can ship.
          </p>

          <div className="space-y-3">
            {c.draft.splits.map((s) => (
              <div
                key={s.id}
                className="bg-black/30 border border-gray-700 rounded-lg p-3 grid grid-cols-1 md:grid-cols-[9rem_1fr_6rem_2.5rem] gap-3 items-end"
              >
                <Field label="Bucket" dense>
                  <select
                    value={s.category}
                    onChange={(e) =>
                      c.setSplit(s.id, { category: e.target.value as Category })
                    }
                    className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Wallet + what it's for" dense>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <StyledInput
                      value={s.recipient}
                      onChange={(e) => c.setSplit(s.id, { recipient: e.target.value })}
                      placeholder="0x..."
                    />
                    <StyledInput
                      value={s.label}
                      onChange={(e) => c.setSplit(s.id, { label: e.target.value })}
                      placeholder="Founding team"
                    />
                  </div>
                </Field>
                <Field label="Share %" dense>
                  <StyledInput
                    value={s.percent}
                    onChange={(e) => c.setSplit(s.id, { percent: e.target.value })}
                    placeholder="60"
                    type="number"
                  />
                </Field>
                <button
                  onClick={() => c.removeSplit(s.id)}
                  disabled={c.draft.splits.length === 1}
                  aria-label="Remove allocation"
                  className="h-10 grid place-items-center rounded-lg border border-gray-700 text-gray-500 hover:text-rose-400 hover:border-rose-800 disabled:opacity-30 disabled:hover:text-gray-500 disabled:hover:border-gray-700 transition-colors"
                >
                  <FaTrash className="text-xs" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 mt-4 flex-wrap">
            <button
              onClick={c.addSplit}
              className="text-xs text-gray-300 flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
            >
              <FaPlus className="text-[10px]" /> Add a recipient
            </button>
            <p
              className={`text-sm font-bold ${
                allocationOk ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {pct}% allocated
              {!allocationOk && (
                <span className="font-normal text-gray-500">
                  {" "}
                  — {(100 - pct).toFixed(2)}% left
                </span>
              )}
            </p>
          </div>
        </Card>
      </div>

      {/* ---- side rail ---- */}
      <div className="flex flex-col gap-6">
        <Card title="Preview">
          <div className="bg-black/40 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/30 to-fuchsia-500/30 border border-gray-600 grid place-items-center text-[10px] font-bold shrink-0">
                {c.draft.symbol.slice(0, 4) || "—"}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-100 truncate">
                  {c.draft.name || "Untitled raise"}
                </p>
                <p className="text-xs text-gray-500">
                  {c.draft.symbol || "TICKER"} · sealed contribution
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3 line-clamp-2">
              {c.draft.description || "No summary yet."}
            </p>
            <div className="flex h-1.5 rounded-full overflow-hidden mt-3 bg-gray-800">
              {c.draft.splits.map((s) => {
                const p = Number.parseFloat(s.percent);
                return Number.isFinite(p) && p > 0 ? (
                  <div
                    key={s.id}
                    className={CATEGORY_COLORS[s.category]}
                    style={{ width: `${Math.min(p, 100)}%` }}
                  />
                ) : null;
              })}
            </div>
          </div>
        </Card>

        <Card title="Before it ships">
          {c.problems.length === 0 ? (
            <p className="text-sm text-emerald-400 flex items-center gap-2">
              <FaCheck /> Everything checks out.
            </p>
          ) : (
            <ul className="text-xs text-gray-400 space-y-1.5">
              {c.problems.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  <span>Still needs {p}.</span>
                </li>
              ))}
            </ul>
          )}

          {!c.isConnected && (
            <p className="text-xs text-amber-400 mt-3">
              Connect a wallet to sign the deployment.
            </p>
          )}

          <div className="mt-4">
            <ActionButton onClick={c.deploy} disabled={!c.ready || c.busy}>
              <FaRocket /> {c.busy ? "Deploying..." : "Deploy launch"}
            </ActionButton>
          </div>

          <p className="text-[11px] text-gray-600 mt-3">
            Four signatures: token, fee router, sale contract, then publishing it
            to the feed.
          </p>
        </Card>

        {c.steps.length > 0 && (
          <Card title="Progress">
            <ol className="space-y-2">
              {c.steps.map((s) => (
                <StepRow key={s.key} step={s} />
              ))}
            </ol>

            {c.error && (
              <p className="text-xs text-rose-400 mt-3 break-words">{c.error}</p>
            )}

            {c.deployed && (
              <div className="mt-4">
                <p className="text-xs text-emerald-400 mb-3">
                  Live. It's in the feed now.
                </p>
                <ActionButton onClick={onDone}>Go to the feed</ActionButton>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

const Field = ({
  label,
  children,
  dense = false,
}: {
  label: string;
  children: React.ReactNode;
  dense?: boolean;
}) => (
  <label className="block">
    <span
      className={`block text-gray-400 mb-1.5 ${
        dense ? "text-[10px] uppercase tracking-wider" : "text-sm"
      }`}
    >
      {label}
    </span>
    {children}
  </label>
);

const StepRow = ({ step }: { step: DeployStep }) => {
  const icon = {
    pending: <span className="text-gray-600">○</span>,
    active: <span className="text-blue-400 animate-pulse">◐</span>,
    done: <FaCheck className="text-emerald-400 text-[10px]" />,
    failed: <FaTimes className="text-rose-400 text-[10px]" />,
  }[step.status];

  return (
    <li className="flex items-start gap-3 text-xs">
      <span className="w-4 grid place-items-center mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">
        <span
          className={step.status === "pending" ? "text-gray-500" : "text-gray-200"}
        >
          {step.label}
        </span>
        {step.detail && (
          <span className="block text-[10px] text-gray-600 break-all">
            {step.detail}
          </span>
        )}
      </span>
    </li>
  );
};

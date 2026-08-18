import { FaPlus, FaTrash, FaRocket, FaCheck, FaTimes } from "react-icons/fa";
import { Card } from "./Card";
import { ActionButton } from "./ActionButton";
import { StyledInput } from "./StyledIntput";
import { useCreateLaunch,
  CATEGORIES, type Category, type DeployStep,
} from "../hooks/useCreateLaunch";
import { useBoards } from "../hooks/useBoards"; const CATEGORY_COLORS: Record<string, string> = {
  Creator: "bg-[var(--cat-creator)]",
  Partner: "bg-[var(--cat-partner)]",
  Rewards: "bg-[var(--cat-rewards)]",
  Marketing: "bg-[var(--cat-marketing)]",
  Buyback: "bg-[var(--cat-buyback)]",
  Liquidity: "bg-[var(--cat-liquidity)]",
  Treasury: "bg-[var(--cat-treasury)]",
  Custom: "bg-[var(--cat-custom)]",
}; export const CreateLaunch = ({ onDone }: { onDone: () => void }) => { const c = useCreateLaunch(); const { boards } = useBoards(); const chosen = boards.find((b) => b.id === c.draft.boardId); const pct = c.totalBps / 100; const allocationOk = c.totalBps === 10_000; return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_20rem] gap-6">
      {/* ---- form ---- */}
      <div>
        <Card title="Identity">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Project name">
              <StyledInput value={c.draft.name} onChange={(e) => c.update("name", e.target.value)} placeholder="e.g. Northern Lights"
              />
            </Field>
            <Field label="Ticker">
              <StyledInput value={c.draft.symbol} onChange={(e) => c.update("symbol", e.target.value.toUpperCase())} placeholder="e.g. NRTH"
              />
            </Field>
            <Field label="Total supply">
              <StyledInput value={c.draft.supply} onChange={(e) => c.update("supply", e.target.value)} placeholder="1000000" type="number"
              />
            </Field>
            <Field label="Logo URL (optional)">
              <StyledInput value={c.draft.logoURI} onChange={(e) => c.update("logoURI", e.target.value)} placeholder="https://…/logo.png"
              />
            </Field>
            <Field label="One-line summary">
              <StyledInput value={c.draft.description} onChange={(e) => c.update("description", e.target.value)} placeholder="What is this raise for?"
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="Publish through a desk">
              <select value={String(c.draft.boardId)} onChange={(e) => c.update("boardId", BigInt(e.target.value))} className="bg-[var(--snow-sunk)] border border-[var(--rule)] px-4 py-2 text-[var(--ink)] text-[length:var(--t-base)] outline-none w-full"
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
              <p className="text-[length:var(--t-fine)] text-[var(--ochre)] mt-2">
                This desk requires at least {chosen.minPartnerBps / 100}% routed to{" "}
                {chosen.owner.slice(0, 6)}…{chosen.owner.slice(-4)}. The registry checks your split against that and will reject the raise otherwise.
              </p>
            )}
          </div>
        </Card>

        <Card title="Where the money goes">
          <p className="text-[var(--ink-2)] text-[length:var(--t-base)] mb-4">
            Split the raise between the people who earn from it. Enforced by the contract at settlement — recipients withdraw their own share, and the total has to land on 100% before this can ship.
          </p>

          <div className="space-y-3">
            {c.draft.splits.map((s) => (
              <div key={s.id} className="bg-[var(--sheet)] border border-[var(--rule)] p-3 grid grid-cols-1 md:grid-cols-[9rem_1fr_6rem_2.5rem] gap-3 items-end"
              >
                <Field label="Bucket" dense>
                  <select value={s.category} onChange={(e) => c.setSplit(s.id, { category: e.target.value as Category })
                    } className="bg-[var(--snow-sunk)] border border-[var(--rule)] px-3 py-2 text-[var(--ink)] text-[length:var(--t-base)] outline-none w-full"
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
                    <StyledInput value={s.recipient} onChange={(e) => c.setSplit(s.id, { recipient: e.target.value })} placeholder="0x..."
                    />
                    <StyledInput value={s.label} onChange={(e) => c.setSplit(s.id, { label: e.target.value })} placeholder="Founding team"
                    />
                  </div>
                </Field>
                <Field label="Share %" dense>
                  <StyledInput value={s.percent} onChange={(e) => c.setSplit(s.id, { percent: e.target.value })} placeholder="60" type="number"
                  />
                </Field>
                <button onClick={() => c.removeSplit(s.id)} disabled={c.draft.splits.length === 1} aria-label="Remove allocation" className="h-10 grid place-items-center border border-[var(--rule)] text-[var(--ink-3)] hover:text-[var(--falu)] hover:border-[var(--falu)] disabled:opacity-30 disabled:hover:text-[var(--ink-3)] disabled:hover:border-[var(--rule)] transition-colors"
                >
                  <FaTrash className="text-[length:var(--t-fine)]" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4 mt-4 flex-wrap">
            <button onClick={c.addSplit} className="text-[length:var(--t-fine)] text-[var(--ink-2)] flex items-center gap-2 px-3 py-2 border border-[var(--rule)] hover:border-[var(--rule)] transition-colors"
            >
              <FaPlus className="text-[length:var(--t-fine)]" /> Add a recipient
            </button>
            <p className={`text-[length:var(--t-base)] font-bold ${ allocationOk ? "text-[var(--lichen)]" : "text-[var(--ochre)]"
              }`}
            >
              {pct}% allocated
              {!allocationOk && (
                <span className="font-normal text-[var(--ink-3)]">
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
          <div className="bg-[var(--sheet)] border border-[var(--rule)] p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-[var(--fjord-wash)] border border-[var(--rule)] grid place-items-center text-[length:var(--t-fine)] font-bold shrink-0">
                {c.draft.symbol.slice(0, 4) || "—"}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[var(--ink)] truncate">
                  {c.draft.name || "Untitled raise"}
                </p>
                <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
                  {c.draft.symbol || "TICKER"} · sealed contribution
                </p>
              </div>
            </div>
            <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-3 line-clamp-2">
              {c.draft.description || "No summary yet."}
            </p>
            <div className="flex h-1.5 rounded-full overflow-hidden mt-3 bg-[var(--snow-sunk)]">
              {c.draft.splits.map((s) => { const p = Number.parseFloat(s.percent); return Number.isFinite(p) && p > 0 ? (
                  <div key={s.id} className={CATEGORY_COLORS[s.category]} style={{ width: `${Math.min(p, 100)}%` }}
                  />
                ) : null;
              })}
            </div>
          </div>
        </Card>

        <Card title="Before it ships">
          {c.problems.length === 0 ? (
            <p className="text-[length:var(--t-base)] text-[var(--lichen)] flex items-center gap-2">
              <FaCheck /> Everything checks out.
            </p>
          ) : (
            <ul className="text-[length:var(--t-fine)] text-[var(--ink-2)] space-y-1.5">
              {c.problems.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <span className="text-[var(--ochre)] mt-0.5">•</span>
                  <span>Still needs {p}.</span>
                </li>
              ))}
            </ul>
          )}

          {!c.isConnected && (
            <p className="text-[length:var(--t-fine)] text-[var(--ochre)] mt-3">
              Connect a wallet to sign the deployment.
            </p>
          )}

          <div className="mt-4">
            <ActionButton onClick={c.deploy} disabled={!c.ready || c.busy}>
              <FaRocket /> {c.busy ? "Deploying..." : "Deploy launch"}
            </ActionButton>
          </div>

          <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-3">
            Four signatures: token, fee router, sale contract, then publishing it to the feed.
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
              <p className="text-[length:var(--t-fine)] text-[var(--falu)] mt-3 break-words">{c.error}</p>
            )}

            {c.deployed && (
              <div className="mt-4">
                <p className="text-[length:var(--t-fine)] text-[var(--lichen)] mb-3">
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
}; const Field = ({ label, children, dense = false,
}: { label: string; children: React.ReactNode; dense?: boolean;
}) => (
  <label className="block">
    <span className={`block text-[var(--ink-2)] mb-1.5 ${ dense ? "text-[length:var(--t-fine)] uppercase tracking-wider" : "text-[length:var(--t-base)]"
      }`}
    >
      {label}
    </span>
    {children}
  </label>
); const StepRow = ({ step }: { step: DeployStep }) => { const icon = { pending: <span className="text-[var(--ink-3)]">○</span>, active: <span className="text-[var(--fjord)] animate-pulse">◐</span>, done: <FaCheck className="text-[var(--lichen)] text-[length:var(--t-fine)]" />, failed: <FaTimes className="text-[var(--falu)] text-[length:var(--t-fine)]" />,
  }[step.status]; return (
    <li className="flex items-start gap-3 text-[length:var(--t-fine)]">
      <span className="w-4 grid place-items-center mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className={step.status === "pending" ? "text-[var(--ink-3)]" : "text-[var(--ink)]"}
        >
          {step.label}
        </span>
        {step.detail && (
          <span className="block text-[length:var(--t-fine)] text-[var(--ink-3)] break-all">
            {step.detail}
          </span>
        )}
      </span>
    </li>
  );
};

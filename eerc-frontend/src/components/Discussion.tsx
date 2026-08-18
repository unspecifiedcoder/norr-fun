import { FaComment, FaTimes } from "react-icons/fa";
import { Card } from "./Card";
import { ActionButton } from "./ActionButton";
import { useComments, MAX_COMMENT_LENGTH } from "../hooks/useComments"; const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`; const ago = (seconds: bigint) => { const diff = Math.max(0, Math.floor(Date.now() / 1000) - Number(seconds)); if (diff < 60) return "just now"; if (diff < 3600) return `${Math.floor(diff / 60)}m ago`; if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`; return `${Math.floor(diff / 86400)}d ago`;
};

/**
 * On-chain discussion for one raise.
 *
 * Every comment is signed by its author, so attribution needs no server to
 * vouch for it. The cost of posting is stated up front rather than appearing
 * as a surprise signature prompt.
 */
export const Discussion = ({ subject }: { subject: string }) => { const c = useComments(subject); if (!c.available) { return (
      <Card title="Discussion">
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)]">
          No discussion contract is deployed on this network.
        </p>
      </Card>
    );
  } return (
    <Card title={`Discussion${c.total > 0 ? ` (${c.total})` : ""}`}>
      {c.isConnected ? (
        <div className="mb-6">
          <textarea value={c.draft} onChange={(e) => c.setDraft(e.target.value)} placeholder="Say something useful about this raise." rows={3} className="w-full bg-[var(--snow-sunk)] border border-[var(--rule)] px-4 py-3 text-[length:var(--t-base)] text-[var(--ink)] placeholder-gray-500 outline-none resize-y"
          />
          <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
            <p className={`text-[length:var(--t-fine)] ${c.tooLong ? "text-[var(--falu)]" : "text-[var(--ink-3)]"}`}>
              {c.draft.length}/{MAX_COMMENT_LENGTH} · stored on chain, so posting costs gas and cannot be edited later
            </p>
            <ActionButton onClick={c.post} disabled={!c.canPost}>
              <FaComment /> {c.busy ? "Posting…" : "Post"}
            </ActionButton>
          </div>
          {c.status && (
            <p className="text-[length:var(--t-fine)] text-[var(--falu)] mt-2 break-words">{c.status}</p>
          )}
        </div>
      ) : (
        <p className="text-[length:var(--t-fine)] text-[var(--ochre)] mb-6">
          Connect a wallet to join the discussion.
        </p>
      )}

      {c.comments.length === 0 ? (
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)]">
          Nothing here yet. Be the first to weigh in.
        </p>
      ) : (
        <ul className="space-y-3">
          {c.comments.map((entry, i) => (
            <li key={`${entry.author}-${entry.postedAt}-${i}`} className="bg-[var(--sheet)] border border-[var(--rule)] p-4"
            >
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <span className="text-[length:var(--t-fine)] font-bold text-[var(--ink-2)] font-mono">
                  {short(entry.author)}
                  {c.address?.toLowerCase() === entry.author.toLowerCase() && (
                    <span className="ml-2 text-[length:var(--t-fine)] text-[var(--lichen)] font-normal"> you
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-[length:var(--t-fine)] text-[var(--ink-3)]">{ago(entry.postedAt)}</span>
                  {!entry.hidden && c.address?.toLowerCase() === entry.author.toLowerCase() && (
                      <button onClick={() => c.withdraw(i)} disabled={c.busy} aria-label="Withdraw comment" className="text-[var(--ink-3)] hover:text-[var(--falu)] transition-colors disabled:opacity-40"
                      >
                        <FaTimes className="text-[length:var(--t-fine)]" />
                      </button>
                    )}
                </span>
              </div>
              {entry.hidden ? (
                <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] italic">
                  Withdrawn by its author.
                </p>
              ) : (
                <p className="text-[length:var(--t-base)] text-[var(--ink)] whitespace-pre-wrap break-words">
                  {entry.body}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

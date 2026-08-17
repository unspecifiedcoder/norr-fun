import { FaComment, FaTimes } from "react-icons/fa";
import { Card } from "./Card";
import { ActionButton } from "./ActionButton";
import { useComments, MAX_COMMENT_LENGTH } from "../hooks/useComments";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const ago = (seconds: bigint) => {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - Number(seconds));
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

/**
 * On-chain discussion for one raise.
 *
 * Every comment is signed by its author, so attribution needs no server to
 * vouch for it. The cost of posting is stated up front rather than appearing
 * as a surprise signature prompt.
 */
export const Discussion = ({ subject }: { subject: string }) => {
  const c = useComments(subject);

  if (!c.available) {
    return (
      <Card title="Discussion">
        <p className="text-sm text-gray-500">
          No discussion contract is deployed on this network.
        </p>
      </Card>
    );
  }

  return (
    <Card title={`Discussion${c.total > 0 ? ` (${c.total})` : ""}`}>
      {c.isConnected ? (
        <div className="mb-6">
          <textarea
            value={c.draft}
            onChange={(e) => c.setDraft(e.target.value)}
            placeholder="Say something useful about this raise."
            rows={3}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
            <p className={`text-[11px] ${c.tooLong ? "text-rose-400" : "text-gray-600"}`}>
              {c.draft.length}/{MAX_COMMENT_LENGTH} · stored on chain, so posting
              costs gas and cannot be edited later
            </p>
            <ActionButton onClick={c.post} disabled={!c.canPost}>
              <FaComment /> {c.busy ? "Posting…" : "Post"}
            </ActionButton>
          </div>
          {c.status && (
            <p className="text-xs text-rose-400 mt-2 break-words">{c.status}</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-amber-400 mb-6">
          Connect a wallet to join the discussion.
        </p>
      )}

      {c.comments.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing here yet. Be the first to weigh in.
        </p>
      ) : (
        <ul className="space-y-3">
          {c.comments.map((entry, i) => (
            <li
              key={`${entry.author}-${entry.postedAt}-${i}`}
              className="bg-black/30 border border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <span className="text-xs font-bold text-gray-300 font-mono">
                  {short(entry.author)}
                  {c.address?.toLowerCase() === entry.author.toLowerCase() && (
                    <span className="ml-2 text-[10px] text-emerald-400 font-normal">
                      you
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-600">{ago(entry.postedAt)}</span>
                  {!entry.hidden &&
                    c.address?.toLowerCase() === entry.author.toLowerCase() && (
                      <button
                        onClick={() => c.withdraw(i)}
                        disabled={c.busy}
                        aria-label="Withdraw comment"
                        className="text-gray-600 hover:text-rose-400 transition-colors disabled:opacity-40"
                      >
                        <FaTimes className="text-[10px]" />
                      </button>
                    )}
                </span>
              </div>
              {entry.hidden ? (
                <p className="text-xs text-gray-600 italic">
                  Withdrawn by its author.
                </p>
              ) : (
                <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
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

import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaComment, FaReply, FaTimes, FaLink } from "react-icons/fa";
import { Panel } from "./ui/Panel";
import { Segmented } from "./ui/Controls";
import { Avatar } from "./ui/Avatar";
import { ActionButton } from "./ActionButton";
import { useComments, MAX_COMMENT_LENGTH, type CommentEntry } from "../hooks/useComments";
import { short, ago } from "./ui/format";

/**
 * On-chain discussion for one raise.
 *
 * Every comment is signed by its author, so attribution needs no server to
 * vouch for it, and the cost of posting is stated in the composer rather than
 * appearing as a surprise signature prompt.
 *
 * Threading is carried in the body as a `↪#<index>` marker rather than in a
 * second contract. The marker is written by the reply control, parsed back
 * out for display, and points at the comment's stored index — which is what
 * the contract already addresses entries by. This keeps replies verifiable
 * from chain data alone; an off-chain thread table would be a claim about the
 * conversation that the conversation itself could not confirm.
 *
 * There are no vote counts. The contract stores none, and a score kept in
 * this browser would look identical to one the network agreed on while
 * meaning nothing.
 */

const MARKER = /^↪#(\d+)\s*/;

/**
 * Addresses written in a comment become links.
 *
 * People quote wallets constantly in a thread — "0x7099… is the vault", "did
 * 0x3C44… claim yet" — and every one of those was dead text the reader had to
 * copy by hand. Matched strictly on the 0x-plus-40-hex shape so nothing else
 * in the body is touched, and rendered short so a paragraph does not turn
 * into a wall of hex.
 */
/**
 * The three marks people actually type in a thread.
 *
 * `backticks` for a value, *asterisks* for emphasis, and bare addresses. Not
 * a markdown parser: a comment is on-chain and permanent, and a renderer that
 * accepts arbitrary markup is a renderer that eventually renders something
 * someone crafted. Everything outside these three shapes is printed as typed.
 */
const TOKENS = /(0x[a-fA-F0-9]{40}|`[^`\n]+`|\*[^*\n]+\*)/g;

const Body = ({ text }: { text: string }) => (
  <>
    {text.split(TOKENS).map((part, i) => {
      if (/^0x[a-fA-F0-9]{40}$/.test(part)) {
        return (
          <Link
            key={i}
            to={`/u/${part}`}
            className="text-[var(--falu)] hover:text-[var(--falu-bright)] transition-colors"
            title={part}
            onClick={(e) => e.stopPropagation()}
          >
            {short(part)}
          </Link>
        );
      }
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code
            key={i}
            className="px-1 border border-[var(--rule)] rounded-[var(--r-control)] bg-[var(--snow-sunk)] text-[var(--ink)]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return (
          <strong key={i} className="text-[var(--ink)] font-bold">
            {part.slice(1, -1)}
          </strong>
        );
      }
      return <span key={i}>{part}</span>;
    })}
  </>
);

type Node = {
  entry: CommentEntry;
  /** Stored index — what the contract addresses this comment by. */
  id: number;
  parent: number | null;
  body: string;
  children: Node[];
};

export const Discussion = ({
  subject,
  creator,
}: {
  subject: string;
  /** Marked in the thread, so the reader can tell the team from the crowd. */
  creator?: string;
}) => {
  const c = useComments(subject);
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const location = useLocation();

  /**
   * A linked comment scrolls itself into view and is marked.
   *
   * The Link button copied a `#c<id>` fragment that nothing consumed, so
   * following one landed on the launch page with the discussion tab shut and
   * no indication which comment was meant. The fragment now selects the
   * comment, and the highlight fades rather than staying on permanently and
   * looking like state.
   */
  const linked = location.hash.startsWith("#c")
    ? Number(location.hash.slice(2))
    : null;

  useEffect(() => {
    if (linked === null) return;
    const el = document.getElementById(`c${linked}`);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [linked, c.comments.length]);

  /**
   * page() returns newest-first, so a comment's stored index is
   * total - 1 - positionFromNewest. Every id below is that stored index.
   */
  const tree = useMemo(() => {
    const nodes: Node[] = c.comments.map((entry, i) => {
      const id = c.total - 1 - i;
      const m = MARKER.exec(entry.body);
      return {
        entry,
        id,
        parent: m ? Number(m[1]) : null,
        body: m ? entry.body.slice(m[0].length) : entry.body,
        children: [],
      };
    });

    const byId = new Map(nodes.map((n) => [n.id, n]));
    const roots: Node[] = [];
    for (const n of nodes) {
      const parent = n.parent !== null ? byId.get(n.parent) : undefined;
      // A reply whose parent was never fetched is shown at the top level
      // rather than dropped — losing a comment is worse than losing a nesting.
      if (parent && parent.id !== n.id) parent.children.push(n);
      else roots.push(n);
    }

    const sort = (list: Node[]) =>
      list.sort((a, b) => (order === "newest" ? b.id - a.id : a.id - b.id));
    sort(roots);
    for (const n of nodes) n.children.sort((a, b) => a.id - b.id);
    return roots;
  }, [c.comments, c.total, order]);

  if (!c.available) {
    return (
      <Panel title="Discussion">
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)]">
          No discussion contract is deployed on this network.
        </p>
      </Panel>
    );
  }

  const parentOf = replyTo !== null ? c.comments.find((_, i) => c.total - 1 - i === replyTo) : null;

  /**
   * The marker is prepended to the body handed to post(), not written into
   * draft state first: state does not apply until the next render, so a
   * post() in the same tick would send the unmarked text and the reply would
   * land as a top-level comment.
   */
  const submit = () => {
    const text = c.draft.replace(MARKER, "").trim();
    if (!text) return;
    const body = replyTo !== null ? `↪#${replyTo} ${text}` : text;
    void c.post(body).then(() => setReplyTo(null));
  };

  return (
    <Panel
      title={`Discussion${c.total > 0 ? ` · ${c.total}` : ""}`}
      aside={
        c.total > 1 && (
          <Segmented
            options={[
              { value: "newest" as const, label: "Newest" },
              { value: "oldest" as const, label: "Oldest" },
            ]}
            value={order}
            onChange={setOrder}
            label="Comment order"
          />
        )
      }
    >
      {/* ---- composer ---- */}
      {c.isConnected ? (
        <div className="mb-5">
          {parentOf && (
            <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mb-1.5 flex items-center gap-2">
              <FaReply className="text-[10px]" />
              replying to{" "}
              <span className="text-[var(--ink-2)]">{short(parentOf.author)}</span>
              <button
                onClick={() => setReplyTo(null)}
                className="text-[var(--ink-4)] hover:text-[var(--falu)] transition-colors"
                aria-label="Cancel reply"
              >
                <FaTimes className="text-[10px]" />
              </button>
            </p>
          )}
          <textarea
            value={c.draft.replace(MARKER, "")}
            onChange={(e) => c.setDraft(e.target.value)}
            placeholder="Say something useful about this raise."
            rows={3}
            className="w-full bg-[var(--snow-sunk)] border border-[var(--rule)] rounded-[var(--r-control)] px-3 py-2.5 text-[length:var(--t-base)] text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--ink-4)] transition-colors resize-y"
          />
          <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
            <p
              className="text-[length:var(--t-fine)] tabular"
              style={{ color: c.tooLong ? "var(--falu)" : "var(--ink-3)" }}
            >
              {c.draft.replace(MARKER, "").length}/{MAX_COMMENT_LENGTH} · stored on
              chain, so posting costs gas and cannot be edited later
            </p>
            <ActionButton onClick={submit} disabled={!c.canPost}>
              <FaComment /> {c.busy ? "Posting…" : replyTo !== null ? "Reply" : "Post"}
            </ActionButton>
          </div>
          {c.status && (
            <p className="text-[length:var(--t-fine)] text-[var(--falu)] mt-2 break-words">
              {c.status}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[length:var(--t-fine)] text-[var(--ochre)] mb-5">
          Connect a wallet to join the discussion.
        </p>
      )}

      {/* ---- thread ---- */}
      {tree.length === 0 ? (
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)]">
          Nothing here yet. Be the first to weigh in.
        </p>
      ) : (
        <ul className="space-y-3">
          {tree.map((n) => (
            <li key={n.id}>
              <Entry
                node={n}
                you={c.address}
                creator={creator}
                busy={c.busy}
                linked={linked}
                onReply={setReplyTo}
                onWithdraw={(id) => c.withdraw(c.total - 1 - id)}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

const Entry = ({
  node,
  you,
  creator,
  busy,
  linked,
  onReply,
  onWithdraw,
  depth = 0,
}: {
  node: Node;
  you?: string;
  creator?: string;
  busy: boolean;
  linked?: number | null;
  onReply: (id: number) => void;
  onWithdraw: (id: number) => void;
  depth?: number;
}) => {
  const mine = you?.toLowerCase() === node.entry.author.toLowerCase();
  const isCreator = creator?.toLowerCase() === node.entry.author.toLowerCase();

  return (
    <>
      <div
        id={`c${node.id}`}
        className="flex gap-3 scroll-mt-24"
        style={
          linked === node.id
            ? {
                boxShadow: "inset 2px 0 0 var(--falu)",
                paddingLeft: "0.625rem",
                background: "var(--falu-wash)",
              }
            : undefined
        }
      >
        <Avatar seed={node.entry.author} fallback={node.entry.author.slice(2, 4)} size={28} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/u/${node.entry.author}`}
              className="text-[length:var(--t-fine)] font-bold text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
            >
              {short(node.entry.author)}
            </Link>
            {isCreator && <span className="mark mark--live">creator</span>}
            {mine && !isCreator && <span className="mark mark--sealed">you</span>}
            <span
              className="text-[length:var(--t-fine)] text-[var(--ink-4)]"
              title={new Date(Number(node.entry.postedAt) * 1000).toLocaleString()}
            >
              {ago(node.entry.postedAt)}
            </span>
          </div>

          {node.entry.hidden ? (
            <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] italic mt-1">
              Withdrawn by its author.
            </p>
          ) : (
            <p className="text-[length:var(--t-base)] text-[var(--ink)] whitespace-pre-wrap break-words mt-1">
              <Body text={node.body} />
            </p>
          )}

          <div className="flex items-center gap-4 mt-1.5">
            <button
              onClick={() => onReply(node.id)}
              className="text-[length:var(--t-fine)] text-[var(--ink-4)] hover:text-[var(--ink)] transition-colors flex items-center gap-1.5"
            >
              <FaReply className="text-[10px]" /> Reply
            </button>
            <button
              onClick={() => {
                // Carries the tab as well as the comment, so following the
                // link opens the discussion rather than the default view.
                const url = new URL(window.location.href);
                url.searchParams.set("tab", "comments");
                url.hash = `c${node.id}`;
                navigator.clipboard?.writeText(url.toString());
              }}
              className="text-[length:var(--t-fine)] text-[var(--ink-4)] hover:text-[var(--ink)] transition-colors flex items-center gap-1.5"
              aria-label="Copy a link to this comment"
            >
              <FaLink className="text-[10px]" /> Link
            </button>
            {mine && !node.entry.hidden && (
              <button
                onClick={() => onWithdraw(node.id)}
                disabled={busy}
                className="text-[length:var(--t-fine)] text-[var(--ink-4)] hover:text-[var(--falu)] transition-colors flex items-center gap-1.5 disabled:opacity-40"
              >
                <FaTimes className="text-[10px]" /> Withdraw
              </button>
            )}
          </div>
        </div>
      </div>

      {/* One level of indent, with a connector rule. Deeper threads keep the
          same indent rather than marching off the right edge. */}
      {node.children.length > 0 && (
        <ul className="mt-3 space-y-3 pl-3.5 ml-3.5 border-l border-[var(--rule)]">
          {node.children.map((child) => (
            <li key={child.id}>
              <Entry
                node={child}
                you={you}
                creator={creator}
                busy={busy}
                linked={linked}
                onReply={onReply}
                onWithdraw={onWithdraw}
                depth={Math.min(depth + 1, 1)}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FaPlus, FaLockOpen, FaLock, FaArrowLeft } from "react-icons/fa";
import { Card } from "./Card";
import { ActionButton } from "./ActionButton";
import { StyledInput } from "./StyledIntput";
import { useBoards, useBoardBySlug, type Board } from "../hooks/useBoards";
import { useBoardFeed } from "../hooks/useBoardFeed"; const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Index of every publisher environment on this chain, plus the create form. */
export const Boards = () => { const b = useBoards(); const [open, setOpen] = useState(false); const [form, setForm] = useState({ slug: "", name: "", description: "", minPartnerPercent: "", open: true,
  }); if (!b.available) { return (
      <Notice title="Not on this network" body={`No board registry is deployed on chain ${b.chainId}.`}
      />
    );
  } const slugTaken = b.boards.some(
    (x) => x.slug.toLowerCase() === form.slug.trim().toLowerCase(),
  ); const ready = b.isConnected && form.slug.trim().length > 0 && form.name.trim().length > 0 && !slugTaken; return (
    <>
      <Card title="Publisher desks">
        <p className="text-[var(--ink-2)] text-[length:var(--t-base)] mb-4">
          A desk is a surface you run. Raises published through it route a share of what they raise to you, and the terms are enforced on-chain when a raise registers — not left to whoever built the client.
        </p>
        <ActionButton onClick={() => setOpen((v) => !v)} disabled={!b.isConnected}>
          <FaPlus /> {open ? "Cancel" : "Open a desk"}
        </ActionButton>
        {!b.isConnected && (
          <p className="text-[length:var(--t-fine)] text-[var(--ochre)] mt-3">
            Connect a wallet to open one.
          </p>
        )}
      </Card>

      {open && (
        <Card title="Open a desk">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Handle" hint="Lowercase, used in the URL. Permanent.">
              <StyledInput value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="aurora-desk"
              />
            </Field>
            <Field label="Display name">
              <StyledInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Aurora Desk"
              />
            </Field>
            <Field label="What you back" >
              <StyledInput value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Infra projects, pre-revenue"
              />
            </Field>
            <Field label="Your minimum share %" hint="Every raise here must route at least this to you."
            >
              <StyledInput value={form.minPartnerPercent} onChange={(e) => setForm({ ...form, minPartnerPercent: e.target.value })} placeholder="5" type="number"
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 mt-4 text-[length:var(--t-base)] text-[var(--ink-2)]">
            <input type="checkbox" checked={form.open} onChange={(e) => setForm({ ...form, open: e.target.checked })} className="accent-blue-500"
            />
            Anyone may publish here. Uncheck to keep it to yourself.
          </label>

          {slugTaken && form.slug.trim() && (
            <p className="text-[length:var(--t-fine)] text-[var(--falu)] mt-3">
              That handle is already taken.
            </p>
          )}

          <div className="mt-5 flex items-center gap-4 flex-wrap">
            <ActionButton onClick={async () => { const ok = await b.create(form); if (ok) { setForm({ slug: "", name: "", description: "", minPartnerPercent: "", open: true }); setOpen(false);
                }
              }} disabled={!ready || b.busy}
            >
              {b.busy ? "Publishing…" : "Publish desk"}
            </ActionButton>
            {b.status && <p className="text-[length:var(--t-fine)] text-[var(--ink-2)]">{b.status}</p>}
          </div>
        </Card>
      )}

      <Card title={`All desks${b.boards.length ? ` (${b.boards.length})` : ""}`}>
        {b.boards.length === 0 ? (
          <p className="text-[length:var(--t-base)] text-[var(--ink-3)]">
            None yet. The first one sets the tone.
          </p>
        ) : (
          <ul className="space-y-2">
            {b.boards.map((board) => (
              <li key={board.slug}>
                <BoardRow board={board} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}; const BoardRow = ({ board }: { board: Board }) => (
  <Link to={`/desk/${board.slug}`} className="flex items-center gap-3 p-3 border border-[var(--rule)] hover:border-[var(--rule)] transition-colors"
  >
    <span className="w-9 h-9 bg-[var(--fjord-wash)] border border-[var(--rule)] grid place-items-center text-[length:var(--t-fine)] font-bold shrink-0 uppercase">
      {board.slug.slice(0, 2)}
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-[length:var(--t-base)] font-bold text-[var(--ink)] truncate">
        {board.name}
      </span>
      <span className="block text-[length:var(--t-fine)] text-[var(--ink-3)] truncate">
        /{board.slug} · run by {short(board.owner)}
      </span>
    </span>
    <span className="text-right shrink-0">
      <span className="block text-[length:var(--t-fine)] text-[var(--ink-2)]">
        {board.minPartnerBps / 100}% min
      </span>
      <span className="block text-[length:var(--t-fine)] text-[var(--ink-3)] flex items-center gap-1 justify-end">
        {board.open ? <FaLockOpen /> : <FaLock />} {board.open ? "open" : "invite only"}
      </span>
    </span>
  </Link>
);

/** One desk: its terms, and the raises published through it. */
export const BoardDetail = () => { const { slug } = useParams<{ slug: string }>(); const { board, notFound } = useBoardBySlug(slug); const feed = useBoardFeed(board?.id); if (notFound) { return <Notice title="No such desk" body={`Nothing is registered at /${slug}.`} />;
  } if (!board) return <Notice title="Loading…" body="Reading the board registry." />; return (
    <>
      <Link to="/desks" className="inline-flex items-center gap-2 text-[length:var(--t-fine)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors mb-5"
      >
        <FaArrowLeft className="text-[length:var(--t-fine)]" /> All desks
      </Link>

      <Card title={board.name}>
        <p className="text-[length:var(--t-base)] text-[var(--ink-2)]">
          {board.description || "No description was given for this desk."}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <Stat label="Handle" value={`/${board.slug}`} />
          <Stat label="Operator" value={short(board.owner)} />
          <Stat label="Minimum share" value={`${board.minPartnerBps / 100}%`} />
          <Stat label="Access" value={board.open ? "Open" : "Invite only"} />
        </div>
      </Card>

      <Card title={`Raises here${feed.total ? ` (${feed.total})` : ""}`}>
        {feed.rows.length === 0 ? (
          <p className="text-[length:var(--t-base)] text-[var(--ink-3)]">
            Nothing published through this desk yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {feed.rows.map((r) => (
              <li key={r.ido}>
                <Link to={`/raise/${r.ido}`} className="flex items-center gap-3 p-3 border border-[var(--rule)] hover:border-[var(--rule)] transition-colors"
                >
                  <span className="w-8 h-8 rounded bg-[var(--fjord-wash)] border border-[var(--rule)] grid place-items-center text-[length:var(--t-fine)] font-bold shrink-0">
                    {r.symbol.slice(0, 4)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[length:var(--t-base)] text-[var(--ink)] font-bold truncate">
                      {r.name}
                    </span>
                    <span className="block text-[length:var(--t-fine)] text-[var(--ink-3)] truncate">
                      {r.description || "No summary"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}; const Field = ({ label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode;
}) => (
  <label className="block">
    <span className="block text-[length:var(--t-base)] text-[var(--ink-2)] mb-1.5">{label}</span>
    {children}
    {hint && <span className="block text-[length:var(--t-fine)] text-[var(--ink-3)] mt-1">{hint}</span>}
  </label>
); const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-[var(--sheet)] border border-[var(--rule)] p-3">
    <p className="text-[length:var(--t-fine)] uppercase tracking-wider text-[var(--ink-3)]">{label}</p>
    <p className="text-[length:var(--t-base)] font-bold text-[var(--ink)] break-all">{value}</p>
  </div>
); const Notice = ({ title, body }: { title: string; body: string }) => (
  <div className="border border-dashed border-[var(--rule)] p-10 text-center">
    <p className="text-[var(--ink)] font-bold">{title}</p>
    <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-2">{body}</p>
  </div>
);

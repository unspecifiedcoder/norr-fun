import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FaPlus, FaLockOpen, FaLock, FaArrowLeft, FaColumns } from "react-icons/fa";
import { Panel, Chip } from "./ui/Panel";
import { Avatar } from "./ui/Avatar";
import { ActionButton } from "./ActionButton";
import { StyledInput } from "./StyledIntput";
import { useBoards, useBoardBySlug, type Board } from "../hooks/useBoards";
import { useBoardFeed } from "../hooks/useBoardFeed";
import { useRegistryFeed } from "../hooks/useRegistryFeed";
import { short, ago } from "./ui/format";

/**
 * The desk index.
 *
 * A desk is infrastructure someone else runs: raises published through it
 * route a share of what they raise to its operator, and the terms are checked
 * on chain when a raise registers rather than left to whoever built the
 * client. That is the claim the page has to make legible, so every card
 * states the minimum share and whether it is open before anything else.
 */
export const Boards = () => {
  const b = useBoards();
  const feed = useRegistryFeed("newest", 100);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    slug: "",
    name: "",
    description: "",
    minPartnerPercent: "",
    open: true,
  });

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of feed.rows) {
      const key = r.launch.boardId.toString();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [feed.rows]);

  if (!b.available) {
    return (
      <Notice
        title="Not on this network"
        body={`No desk registry is deployed on chain ${b.chainId}.`}
      />
    );
  }

  const slugTaken = b.boards.some(
    (x) => x.slug.toLowerCase() === form.slug.trim().toLowerCase(),
  );
  const ready =
    b.isConnected && form.slug.trim().length > 0 && form.name.trim().length > 0 && !slugTaken;

  return (
    <div className="max-w-6xl">
      <header className="flex items-start justify-between gap-6 flex-wrap mb-5">
        <div>
          <h1 className="lead">Desks</h1>
          <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-1.5 max-w-2xl">
            A desk is a surface you run. Raises published through it route a
            share of what they raise to you, and the terms are enforced on chain
            when a raise registers.
          </p>
        </div>
        <ActionButton onClick={() => setOpen((v) => !v)} disabled={!b.isConnected}>
          <FaPlus /> {open ? "Cancel" : "Open a desk"}
        </ActionButton>
      </header>

      {!b.isConnected && (
        <p className="text-[length:var(--t-fine)] text-[var(--ochre)] mb-4">
          Connect a wallet to open one. Browsing costs nothing.
        </p>
      )}

      {open && (
        <Panel title="Open a desk" hud className="mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Handle" hint="Lowercase, used in the URL. Permanent.">
              <StyledInput
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="aurora-desk"
              />
            </Field>
            <Field label="Display name">
              <StyledInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Aurora Desk"
              />
            </Field>
            <Field label="What you back">
              <StyledInput
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Infra projects, pre-revenue"
              />
            </Field>
            <Field
              label="Your minimum share %"
              hint="Every raise here must route at least this to you."
            >
              <StyledInput
                value={form.minPartnerPercent}
                onChange={(e) => setForm({ ...form, minPartnerPercent: e.target.value })}
                placeholder="5"
                type="number"
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 mt-4 text-[length:var(--t-fine)] text-[var(--ink-2)]">
            <input
              type="checkbox"
              checked={form.open}
              onChange={(e) => setForm({ ...form, open: e.target.checked })}
              className="accent-[var(--falu)]"
            />
            Anyone may publish here. Uncheck to keep it to yourself.
          </label>

          {slugTaken && form.slug.trim() && (
            <p className="text-[length:var(--t-fine)] text-[var(--falu)] mt-3">
              That handle is already taken.
            </p>
          )}

          <div className="mt-4 flex items-center gap-4 flex-wrap">
            <ActionButton
              onClick={async () => {
                const ok = await b.create(form);
                if (ok) {
                  setForm({
                    slug: "",
                    name: "",
                    description: "",
                    minPartnerPercent: "",
                    open: true,
                  });
                  setOpen(false);
                }
              }}
              disabled={!ready || b.busy}
            >
              {b.busy ? "Publishing…" : "Publish desk"}
            </ActionButton>
            {b.status && (
              <p className="text-[length:var(--t-fine)] text-[var(--ink-2)]">{b.status}</p>
            )}
          </div>
        </Panel>
      )}

      {b.boards.length === 0 ? (
        <Notice title="No desks yet" body="The first one sets the tone." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
          {b.boards.map((board) => (
            <DeskCard
              key={board.slug}
              board={board}
              raises={counts.get(board.id.toString()) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DeskCard = ({ board, raises }: { board: Board; raises: number }) => (
  <Link to={`/desk/${board.slug}`} className="card-link hud p-3.5 block">
    <div className="flex items-start gap-3">
      <Avatar seed={board.slug} fallback={board.slug.slice(0, 2)} size={40} />
      <div className="min-w-0 flex-1">
        <h2 className="font-bold text-[var(--ink)] truncate">{board.name}</h2>
        <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] truncate">
          /{board.slug} · run by {short(board.owner)}
        </p>
      </div>
      <span className={`mark ${board.open ? "mark--live" : "mark--sealed"} shrink-0`}>
        {board.open ? <FaLockOpen className="text-[9px]" /> : <FaLock className="text-[9px]" />}
        {board.open ? "open" : "invite"}
      </span>
    </div>

    <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-2.5 clamp-2 min-h-[2.4em]">
      {board.description || "No description was given for this desk."}
    </p>

    <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-[var(--rule)] text-[length:var(--t-fine)] text-[var(--ink-3)]">
      <span className="tabular">
        <span className="text-[var(--falu)] font-bold">{board.minPartnerBps / 100}%</span> minimum
        share
      </span>
      <span className="tabular flex items-center gap-1.5">
        <FaColumns className="text-[10px]" /> {raises} {raises === 1 ? "raise" : "raises"}
      </span>
      <span className="ml-auto text-[var(--ink-4)]">
        opened {ago(Number(board.createdAt))} ago
      </span>
    </div>
  </Link>
);

/** One desk: its terms, and the raises published through it. */
export const BoardDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const { board, notFound } = useBoardBySlug(slug);
  const feed = useBoardFeed(board?.id);

  if (notFound) {
    return <Notice title="No such desk" body={`Nothing is registered at /${slug}.`} />;
  }
  if (!board) return <Notice title="Loading…" body="Reading the board registry." />;

  return (
    <div className="max-w-6xl">
      <Link
        to="/desks"
        className="inline-flex items-center gap-2 text-[length:var(--t-fine)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors mb-4"
      >
        <FaArrowLeft className="text-[length:var(--t-fine)]" /> All desks
      </Link>

      <Panel hud className="mb-4">
        <div className="flex items-start gap-4 flex-wrap">
          <Avatar seed={board.slug} fallback={board.slug.slice(0, 2)} size={56} />
          <div className="min-w-0 flex-1">
            <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">/{board.slug}</p>
            <h1 className="lead mt-0.5">{board.name}</h1>
            <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-2 max-w-2xl">
              {board.description || "No description was given for this desk."}
            </p>
          </div>
          <span className={`mark ${board.open ? "mark--live" : "mark--sealed"} shrink-0`}>
            {board.open ? "open to all" : "invite only"}
          </span>
        </div>

        <div className="flex gap-1.5 flex-wrap mt-4 pt-3 border-t border-[var(--rule)]">
          <Chip k="Operator" v={short(board.owner)} />
          <Chip k="Minimum share" v={`${board.minPartnerBps / 100}%`} tone="accent" />
          <Chip k="Raises" v={String(feed.total ?? feed.rows.length)} />
          <Chip k="Opened" v={new Date(Number(board.createdAt) * 1000).toLocaleDateString()} />
        </div>
      </Panel>

      <Panel title={`Raises here${feed.rows.length ? ` · ${feed.rows.length}` : ""}`} flush>
        {feed.rows.length === 0 ? (
          <p className="text-[length:var(--t-base)] text-[var(--ink-3)] p-4">
            Nothing published through this desk yet.
          </p>
        ) : (
          <ul>
            {feed.rows.map((r) => (
              <li key={r.ido}>
                <Link
                  to={`/raise/${r.ido}`}
                  className="flex items-center gap-3 px-3.5 py-3 border-b border-[var(--rule)] last:border-0 hover:bg-[var(--sheet-raised)] transition-colors"
                >
                  <Avatar
                    src={r.logoURI || undefined}
                    seed={r.ido}
                    fallback={r.symbol}
                    size={32}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[length:var(--t-base)] text-[var(--ink)] font-bold truncate">
                      {r.name}{" "}
                      <span className="text-[length:var(--t-fine)] text-[var(--ink-3)] font-normal">
                        {r.symbol}
                      </span>
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
      </Panel>
    </div>
  );
};

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <label className="block">
    <span className="block text-[length:var(--t-fine)] text-[var(--ink-2)] mb-1.5">{label}</span>
    {children}
    {hint && (
      <span className="block text-[length:var(--t-fine)] text-[var(--ink-4)] mt-1">{hint}</span>
    )}
  </label>
);

const Notice = ({ title, body }: { title: string; body: string }) => (
  <div className="border border-dashed border-[var(--rule)] rounded-[var(--r-panel)] p-12 text-center">
    <p className="text-[var(--ink)] font-bold">{title}</p>
    <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-2">{body}</p>
  </div>
);

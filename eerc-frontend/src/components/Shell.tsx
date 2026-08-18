import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  FaPaperPlane, FaPlus, FaStream, FaUser, FaColumns,
  FaHandHoldingUsd, FaBell, FaCog, FaSearch, FaBars, FaTimes, FaWallet,
  FaLock, FaLockOpen, FaBolt, FaCircle,
} from "react-icons/fa";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useBlockNumber, useChainId } from "wagmi";
import { Logo } from "./Logo";
import { NodeStatus } from "./NodeStatus";
import { Avatar } from "./ui/Avatar";
import { useProtocolStats } from "../hooks/useProtocolStats";
import { usePreferences } from "../hooks/usePreferences";
import { useBoards } from "../hooks/useBoards";
import { useActivity } from "../hooks/useActivity";
import { Live } from "./ui/Live";

/**
 * Application shell.
 *
 * A rail, not a tab strip: eleven destinations wrap onto two rows in a
 * horizontal strip and the page reads as a demo; in a rail they fit one per
 * line at any width and the content area keeps the full viewport.
 *
 * The rail carries three things a nav normally does not — search, the desk
 * index, and live protocol figures — because on an operator surface the
 * left edge is the cheapest place to put state a reader wants continuously
 * rather than by navigating to it.
 */

const PRIMARY = [
  { to: "/", label: "Raises", icon: <FaStream />, end: true },
  { to: "/desks", label: "Desks", icon: <FaColumns />, end: false },
  { to: "/activity", label: "Activity", icon: <FaBell />, end: false },
];

const PERSONAL = [
  { to: "/portfolio", label: "Portfolio", icon: <FaWallet />, end: false },
  { to: "/owed", label: "Owed to you", icon: <FaHandHoldingUsd />, end: false },
  { to: "/me", label: "Your profile", icon: <FaUser />, end: false },
  { to: "/private", label: "Private transfer", icon: <FaPaperPlane />, end: false },
];

type DeskSort = "newest" | "name" | "share";

const DESK_SORTS: { key: DeskSort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "name", label: "A–Z" },
  { key: "share", label: "Top share" },
];

export const Shell = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { prefs } = usePreferences();

  /**
   * Display preferences are set on the document, not threaded through every
   * component: they are properties of the whole sheet, and a class on the
   * root is the only way to change one without touching a hundred files.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.density = prefs.density;
    root.dataset.contrast = prefs.highContrast ? "high" : "normal";
  }, [prefs.density, prefs.highContrast]);

  // A drawer that survives navigation traps the reader behind their own menu.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row font-mono text-[var(--ink)]">
      {/* Keyboard users land on the rail on every navigation otherwise, and
          the rail is eleven links deep before the content starts. */}
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      {/* ---- mobile bar ---- */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-2.5 border-b border-[var(--rule)] bg-[var(--sheet)]">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="w-8 h-8 grid place-items-center border border-[var(--rule)] text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
        >
          {open ? <FaTimes /> : <FaBars />}
        </button>
        <NavLink to="/" aria-label="norr.fun home">
          <Logo size="1.375rem" />
        </NavLink>
        <span className="ml-auto">
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="avatar" />
        </span>
      </div>

      <Rail open={open} />
      <BottomNav />

      {/* ---- content ---- */}
      <div className="flex-1 min-w-0 flex flex-col">
        <NodeStatus />
        <TopBar />
        {/* Keyed on the path so a route change replays the settle: content
            arrives rather than snapping into place. 180ms, and nothing at all
            under prefers-reduced-motion. */}
        <main
          id="content"
          key={location.pathname}
          className="flex-1 px-4 sm:px-6 py-6 w-full max-w-[1600px] settle"
        >
          {children}
        </main>
        <StatusBar />
      </div>
    </div>
  );
};

/**
 * Mobile navigation.
 *
 * The drawer is fine for the long tail, but on a phone the four things
 * someone actually moves between should be one thumb away rather than two
 * taps behind a menu. Hidden entirely at desktop width, where the rail
 * already does this job.
 */
const BottomNav = () => (
  <nav
    className="lg:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-4 border-t border-[var(--rule)] bg-[var(--sheet)]"
    aria-label="Primary"
  >
    {[
      { to: "/", label: "Raises", icon: <FaStream />, end: true },
      { to: "/portfolio", label: "Portfolio", icon: <FaWallet />, end: false },
      { to: "/start", label: "Start", icon: <FaPlus />, end: false },
      { to: "/activity", label: "Activity", icon: <FaBell />, end: false },
    ].map((t) => (
      <NavLink
        key={t.to}
        to={t.to}
        end={t.end}
        className={({ isActive }) =>
          `flex flex-col items-center gap-1 py-2 text-[length:var(--t-fine)] transition-colors ${
            isActive ? "text-[var(--falu)]" : "text-[var(--ink-3)]"
          }`
        }
      >
        <span className="text-[13px]">{t.icon}</span>
        {t.label}
      </NavLink>
    ))}
  </nav>
);

/* ------------------------------------------------------------------ rail */

const Rail = ({ open }: { open: boolean }) => {
  const stats = useProtocolStats();
  const boards = useBoards();
  const [deskSort, setDeskSort] = useState<DeskSort>("newest");

  const desks = useMemo(() => {
    const rows = [...boards.boards];
    if (deskSort === "name") return rows.sort((a, b) => a.name.localeCompare(b.name));
    if (deskSort === "share") return rows.sort((a, b) => b.minPartnerBps - a.minPartnerBps);
    return rows.sort((a, b) => Number(b.createdAt - a.createdAt));
  }, [boards.boards, deskSort]);

  return (
    <aside
      className={`${open ? "flex" : "hidden"} lg:flex lg:w-[248px] lg:shrink-0 lg:h-screen lg:sticky lg:top-0 border-b lg:border-b-0 lg:border-r border-[var(--rule)] bg-[var(--sheet)] flex-col`}
    >
      <div className="px-4 pt-4 pb-3 hidden lg:block">
        <NavLink to="/" aria-label="norr.fun home" className="inline-block">
          <Logo size="1.75rem" />
        </NavLink>
        <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-1.5 tracking-wide">
          contribute privately · claim publicly
        </p>
      </div>

      <div className="px-3 pb-3">
        <SearchBox />
      </div>

      {/* The three things a creator comes here to do, ranked above navigation. */}
      <div className="px-3 flex flex-col gap-1">
        <Action to="/start" icon={<FaPlus />} label="Start a raise" primary />
        <Action to="/desks" icon={<FaColumns />} label="Open a desk" />
        <Action to="/owed" icon={<FaHandHoldingUsd />} label="Collect what's owed" />
      </div>

      <nav className="px-3 mt-4 flex flex-col gap-0.5">
        <Group items={PRIMARY} />
        <p className="label px-3 pt-4 pb-1.5">Yours</p>
        <Group items={PERSONAL} />
      </nav>

      {/* Desks live in the rail rather than behind a click: a publisher desk is
          a place you switch to, and an index you have to navigate to is an
          index nobody reads. */}
      <div className="mt-4 flex-1 min-h-0 flex flex-col border-t border-[var(--rule)]">
        <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
          <p className="label">Desks</p>
          <select
            value={deskSort}
            onChange={(e) => setDeskSort(e.target.value as DeskSort)}
            aria-label="Sort desks"
            className="bg-transparent text-[length:var(--t-fine)] text-[var(--ink-3)] outline-none cursor-pointer hover:text-[var(--ink)] transition-colors"
          >
            {DESK_SORTS.map((s) => (
              <option key={s.key} value={s.key} className="bg-[var(--sheet)]">
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-y-auto px-2 pb-2 flex-1 min-h-0">
          {desks.length === 0 ? (
            <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] px-2 py-1.5">
              {boards.available ? "None open yet." : `No desk registry on chain ${boards.chainId}.`}
            </p>
          ) : (
            desks.map((d) => (
              <NavLink
                key={d.slug}
                to={`/desk/${d.slug}`}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-2 py-1.5 transition-colors ${
                    isActive
                      ? "bg-[var(--snow-sunk)] text-[var(--ink)]"
                      : "text-[var(--ink-2)] hover:bg-[var(--snow-sunk)] hover:text-[var(--ink)]"
                  }`
                }
                title={`${d.name} — ${d.minPartnerBps / 100}% minimum share`}
              >
                <Avatar seed={d.slug} fallback={d.slug.slice(0, 2)} size={22} />
                <span className="text-[length:var(--t-fine)] truncate flex-1">{d.name}</span>
                <span className="text-[length:var(--t-fine)] text-[var(--ink-4)] shrink-0">
                  {d.open ? <FaLockOpen /> : <FaLock />}
                </span>
              </NavLink>
            ))
          )}
        </div>
      </div>

      {/* Live protocol figures, so the rail carries information and not just links. */}
      <div className="hidden lg:block px-4 py-3 border-t border-[var(--rule)]">
        <dl className="space-y-1 text-[length:var(--t-fine)]">
          <Figure label="Raises" value={String(stats.raises)} numeric={stats.raises} />
          <Figure label="Accepting" value={String(stats.open)} numeric={stats.open} accent />
          <Figure label="Desks" value={String(stats.desks)} numeric={stats.desks} />
          <Figure
            label="Raised"
            value={stats.raised > 0n ? `${stats.compact(stats.raised)} ${stats.symbol}` : "—"}
          />
        </dl>
      </div>

      <div className="px-3 py-2.5 border-t border-[var(--rule)] flex items-center gap-1">
        <Dock to="/settings" icon={<FaCog />} label="Settings" />
        <Dock to="/private" icon={<FaPaperPlane />} label="Private transfer" />
        <Dock to="/activity" icon={<FaBell />} label="Activity" />
        <span className="ml-auto text-[length:var(--t-fine)] text-[var(--ink-4)]">v1</span>
      </div>
    </aside>
  );
};

/**
 * Global search.
 *
 * Writes to the URL rather than to local state so a search is shareable and
 * survives a reload, and so the feed — which owns the matching — stays the
 * single place that decides what a query means.
 */
const SearchBox = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  // "/" focuses search, the convention every dense surface shares. Ignored
  // while the reader is already typing somewhere else.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el as HTMLElement | null)?.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/");
      }}
      className="relative"
    >
      <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[length:var(--t-fine)] text-[var(--ink-4)] pointer-events-none" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search raises, desks…"
        aria-label="Search raises and desks"
        className="w-full bg-[var(--snow-sunk)] border border-[var(--rule)] rounded-[var(--r-control)] pl-7 pr-8 py-1.5 text-[length:var(--t-fine)] text-[var(--ink)] placeholder:text-[var(--ink-4)] outline-none focus:border-[var(--ink-4)] transition-colors"
      />
      <span className="kbd absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">/</span>
    </form>
  );
};

const TopBar = () => {
  const activity = useActivity(false);
  const unseen = activity.items.length;

  return (
    <header className="hidden lg:flex sticky top-0 z-20 border-b border-[var(--rule)] bg-[var(--snow)] px-6 py-2.5 items-center justify-end gap-3">
      <NavLink
        to="/activity"
        aria-label={`Activity${unseen ? `, ${unseen} entries` : ""}`}
        className="relative w-8 h-8 grid place-items-center border border-[var(--rule)] rounded-[var(--r-control)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-[var(--rule-strong)] transition-colors"
      >
        <FaBell className="text-[length:var(--t-fine)]" />
        {unseen > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 grid place-items-center bg-[var(--falu)] text-[var(--snow)] text-[10px] font-bold rounded-full tabular">
            {unseen > 99 ? "99+" : unseen}
          </span>
        )}
      </NavLink>
      <ConnectButton showBalance={false} />
    </header>
  );
};

/**
 * Status bar.
 *
 * The chain, the head block and the privacy contract this product is built
 * on, held at the bottom edge. A launch platform's most important claim is
 * what stays sealed, so it is stated on every screen rather than on an
 * about page.
 */
const StatusBar = () => {
  const chainId = useChainId();
  const { data: block } = useBlockNumber({ watch: true });

  /**
   * How long since the head moved.
   *
   * A block number alone cannot be told apart from a block number that
   * stopped: both are just a figure. The elapsed time next to it makes a
   * stalled chain legible seconds before the node-down banner escalates, and
   * on a real network it is the difference between "quiet" and "broken".
   */
  const [seenAt, setSeenAt] = useState(() => Date.now());
  const [age, setAge] = useState(0);

  useEffect(() => {
    if (block === undefined) return;
    setSeenAt(Date.now());
  }, [block]);

  useEffect(() => {
    const timer = setInterval(() => setAge(Math.floor((Date.now() - seenAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [seenAt]);

  return (
    <footer className="mt-auto border-t border-[var(--rule)] bg-[var(--sheet)] px-4 sm:px-6 py-2 pb-16 lg:pb-2 flex items-center gap-x-5 gap-y-1 flex-wrap text-[length:var(--t-fine)] text-[var(--ink-3)]">
      <span className="flex items-center gap-1.5">
        <FaCircle className="text-[7px] text-[var(--gain)]" aria-hidden="true" />
        chain {chainId}
      </span>
      <span className="tabular" title={`Head last moved ${age}s ago`}>
        block {block ? block.toString() : "—"}
        {block !== undefined && age > 20 && (
          <span style={{ color: age > 60 ? "var(--ochre)" : "var(--ink-4)" }}> · {age}s ago</span>
        )}
      </span>
      <span className="flex items-center gap-1.5">
        <FaLock className="text-[10px]" aria-hidden="true" />
        contributions sealed
      </span>
      <span className="flex items-center gap-1.5">
        <FaBolt className="text-[10px]" aria-hidden="true" />
        splits, claims and trades public
      </span>
      <span className="ml-auto text-[var(--ink-4)]">norr.fun</span>
    </footer>
  );
};

/* ------------------------------------------------------------- fragments */

const Action = ({
  to,
  icon,
  label,
  primary = false,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) => (
  <NavLink
    to={to}
    className={`flex items-center gap-2.5 px-3 py-2 text-[length:var(--t-base)] border rounded-[var(--r-control)] transition-colors whitespace-nowrap ${
      primary
        ? "bg-[var(--falu)] border-[var(--falu)] text-[var(--snow)] font-bold hover:bg-[var(--falu-bright)] hover:border-[var(--falu-bright)] cta-emissive"
        : "bg-transparent border-[var(--rule)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-[var(--rule-strong)]"
    }`}
  >
    <span className="text-[length:var(--t-fine)] w-3.5 grid place-items-center">{icon}</span>
    {label}
  </NavLink>
);

const Group = ({
  items,
}: {
  items: { to: string; label: string; icon: React.ReactNode; end: boolean }[];
}) => (
  <>
    {items.map((t) => (
      <NavLink
        key={t.to}
        to={t.to}
        end={t.end}
        className={({ isActive }) =>
          `flex items-center gap-2.5 px-3 py-1.5 text-[length:var(--t-base)] border-l-2 transition-colors whitespace-nowrap ${
            isActive
              ? "bg-[var(--snow-sunk)] border-[var(--falu)] text-[var(--ink)] font-bold"
              : "border-transparent text-[var(--ink-3)] hover:bg-[var(--snow-sunk)] hover:text-[var(--ink)]"
          }`
        }
      >
        <span className="text-[length:var(--t-fine)] w-3.5 grid place-items-center">{t.icon}</span>
        {t.label}
      </NavLink>
    ))}
  </>
);

const Dock = ({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) => (
  <NavLink
    to={to}
    aria-label={label}
    title={label}
    className={({ isActive }) =>
      `w-7 h-7 grid place-items-center border rounded-[var(--r-control)] text-[length:var(--t-fine)] transition-colors ${
        isActive
          ? "border-[var(--rule-strong)] text-[var(--ink)]"
          : "border-[var(--rule)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-[var(--rule-strong)]"
      }`
    }
  >
    {icon}
  </NavLink>
);

const Figure = ({
  label,
  value,
  accent = false,
  numeric,
}: {
  label: string;
  value: string;
  accent?: boolean;
  /** When the figure is a plain count, roll it so a change is noticed. */
  numeric?: number;
}) => (
  <div className="flex justify-between gap-2">
    <dt className="text-[var(--ink-3)]">{label}</dt>
    <dd
      className="font-bold tabular"
      style={{ color: accent ? "var(--falu)" : "var(--ink-2)" }}
    >
      {numeric !== undefined ? (
        <Live value={numeric} format={(n) => String(Math.round(n))} />
      ) : (
        value
      )}
    </dd>
  </div>
);

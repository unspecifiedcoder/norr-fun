import { NavLink } from "react-router-dom";
import {
  FaPaperPlane, FaPlus, FaStream, FaUser, FaColumns,
  FaHandHoldingUsd, FaBell, FaCog,
} from "react-icons/fa";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Logo } from "./Logo";
import { useProtocolStats } from "../hooks/useProtocolStats";

/**
 * Application shell.
 *
 * Replaces a centred card that floated in empty space. Eight destinations wrap
 * onto two rows in a horizontal strip and the page reads as a demo; in a rail
 * they fit one per line at any width, and the content area gets the full
 * viewport instead of a fixed column with a void beneath it.
 */ const PRIMARY = [
  { to: "/", label: "Raises", icon: <FaStream />, end: true },
  { to: "/desks", label: "Desks", icon: <FaColumns />, end: false },
  { to: "/activity", label: "Activity", icon: <FaBell />, end: false },
]; const PERSONAL = [
  { to: "/owed", label: "Owed to you", icon: <FaHandHoldingUsd />, end: false },
  { to: "/me", label: "Your profile", icon: <FaUser />, end: false },
  { to: "/private", label: "Private transfer", icon: <FaPaperPlane />, end: false },
  { to: "/settings", label: "Settings", icon: <FaCog />, end: false },
]; export const Shell = ({ children }: { children: React.ReactNode }) => { const stats = useProtocolStats(); return (
    <div className="min-h-screen flex flex-col lg:flex-row font-mono text-[var(--ink)]">
      {/* ---- rail ---- */}
      <aside className="lg:w-60 lg:shrink-0 lg:h-screen lg:sticky lg:top-0 border-b lg:border-b-0 lg:border-r border-[var(--rule)] bg-[var(--sheet)] flex flex-col">
        <div className="p-5">
          <NavLink to="/" aria-label="norr.fun home" className="inline-block">
            <Logo size="var(--t-lead)" />
          </NavLink>
          <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-2 tracking-wide"> contribute privately · claim publicly
          </p>
        </div>

        <nav className="px-3 flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
          <NavLink to="/start" className="flex items-center gap-2.5 px-3 py-2.5 mb-1 text-[length:var(--t-base)] font-bold bg-[var(--fjord-wash)] border border-[var(--rule)] text-[var(--ink)] hover:border-[var(--rule)] transition-colors whitespace-nowrap"
          >
            <FaPlus className="text-[length:var(--t-fine)]" /> Start a raise
          </NavLink>

          <Group items={PRIMARY} />
          <p className="hidden lg:block text-[length:var(--t-fine)] uppercase tracking-wider text-[var(--ink-3)] px-3 pt-4 pb-1">
            Yours
          </p>
          <Group items={PERSONAL} />
        </nav>

        {/* Live protocol figures, so the rail carries information rather than just links. */}
        <div className="mt-auto hidden lg:block p-4 border-t border-[var(--rule)]">
          <p className="text-[length:var(--t-fine)] uppercase tracking-wider text-[var(--ink-3)] mb-2">
            On chain {stats.chainId}
          </p>
          <dl className="space-y-1.5 text-[length:var(--t-fine)]">
            <Figure label="Raises" value={String(stats.raises)} />
            <Figure label="Accepting" value={String(stats.open)} />
            <Figure label="Desks" value={String(stats.desks)} />
            <Figure label="Raised" value={stats.raised > 0n ? `${stats.compact(stats.raised)} ${stats.symbol}` : "—"}
            />
          </dl>
        </div>
      </aside>

      {/* ---- content ---- */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 border-b border-[var(--rule)] bg-[var(--snow)] px-5 py-3 flex items-center justify-end gap-4">
          <ConnectButton />
        </header>

        <main className="flex-1 px-5 py-6 max-w-6xl w-full">{children}</main>

        <footer className="px-5 py-4 border-t border-[var(--rule)] text-[length:var(--t-fine)] text-[var(--ink-3)]">
          Contribution amounts stay sealed. Payout splits, claims and trades are public and verifiable on chain.
        </footer>
      </div>
    </div>
  );
}; const Group = ({ items,
}: { items: { to: string; label: string; icon: React.ReactNode; end: boolean }[];
}) => (
  <>
    {items.map((t) => (
      <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) =>
          `flex items-center gap-2.5 px-3 py-2 text-[length:var(--t-base)] transition-colors whitespace-nowrap ${ isActive
              ? "bg-[var(--snow-sunk)] text-[var(--ink)] font-bold"
              : "text-[var(--ink-3)] hover:bg-[var(--snow-sunk)] hover:text-[var(--ink)]"
          }`
        }
      >
        <span className="text-[length:var(--t-fine)] w-3.5">{t.icon}</span>
        {t.label}
      </NavLink>
    ))}
  </>
); const Figure = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-2">
    <dt className="text-[var(--ink-3)]">{label}</dt>
    <dd className="text-[var(--ink-2)] font-bold">{value}</dd>
  </div>
);

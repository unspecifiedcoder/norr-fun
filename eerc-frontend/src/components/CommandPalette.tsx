import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSearch, FaStream, FaColumns, FaBell, FaHandHoldingUsd, FaUser,
  FaPaperPlane, FaCog, FaPlus, FaBolt, FaLock, FaArrowRight,
} from "react-icons/fa";
import { useRegistryFeed } from "../hooks/useRegistryFeed";
import { useBoards } from "../hooks/useBoards";
import { Avatar } from "./ui/Avatar";
import { short } from "./ui/format";

/**
 * One key to everything.
 *
 * A surface this dense is navigable in two ways: a rail you read, and a
 * search you type. The rail is for the destinations you already know about;
 * this is for the raise whose ticker you remember and whose address you do
 * not, and for the action three clicks deep that you would rather just name.
 *
 * Everything it offers is real: raises and desks come from the registry, and
 * every command maps to a route that exists.
 */

type Item = {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  to: string;
  group: string;
  keywords?: string;
};

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const feed = useRegistryFeed("newest", 100);
  const { boards } = useBoards();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      // Focus after paint, or the input is not in the document yet.
      requestAnimationFrame(() => input.current?.focus());
    }
  }, [open]);

  const items: Item[] = useMemo(() => {
    const commands: Item[] = [
      { id: "c-start", label: "Start a raise", icon: <FaPlus />, to: "/start", group: "Actions", keywords: "create launch new deploy" },
      { id: "c-instant", label: "Instant raise", hint: "three fields", icon: <FaBolt />, to: "/start/instant", group: "Actions", keywords: "quick fast" },
      { id: "c-desk", label: "Open a desk", icon: <FaColumns />, to: "/desks", group: "Actions", keywords: "board publisher" },
      { id: "c-private", label: "Private balance", hint: "convert, send sealed", icon: <FaLock />, to: "/private", group: "Actions", keywords: "eerc encrypted deposit withdraw" },
      { id: "n-feed", label: "Raises", icon: <FaStream />, to: "/", group: "Go to" },
      { id: "n-desks", label: "Desks", icon: <FaColumns />, to: "/desks", group: "Go to" },
      { id: "n-activity", label: "Activity", icon: <FaBell />, to: "/activity", group: "Go to" },
      { id: "n-owed", label: "Owed to you", icon: <FaHandHoldingUsd />, to: "/owed", group: "Go to" },
      { id: "n-me", label: "Your profile", icon: <FaUser />, to: "/me", group: "Go to" },
      { id: "n-transfer", label: "Private transfer", icon: <FaPaperPlane />, to: "/private", group: "Go to" },
      { id: "n-settings", label: "Settings", icon: <FaCog />, to: "/settings", group: "Go to" },
    ];

    const raises: Item[] = feed.rows.map((r) => ({
      id: `r-${r.launch.ido}`,
      label: r.launch.name,
      hint: `${r.launch.symbol} · ${short(r.launch.creator)}`,
      icon: <Avatar src={r.launch.logoURI || undefined} seed={r.launch.ido} fallback={r.launch.symbol} size={18} />,
      to: `/raise/${r.launch.ido}`,
      group: "Raises",
      keywords: `${r.launch.symbol} ${r.launch.description} ${r.launch.ido} ${r.launch.creator}`,
    }));

    const desks: Item[] = boards.map((b) => ({
      id: `d-${b.slug}`,
      label: b.name,
      hint: `/${b.slug} · ${b.minPartnerBps / 100}% minimum`,
      icon: <Avatar seed={b.slug} fallback={b.slug.slice(0, 2)} size={18} />,
      to: `/desk/${b.slug}`,
      group: "Desks",
      keywords: b.slug,
    }));

    return [...commands, ...raises, ...desks];
  }, [feed.rows, boards]);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) =>
      `${i.label} ${i.hint ?? ""} ${i.keywords ?? ""}`.toLowerCase().includes(needle),
    );
  }, [items, q]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, matches.length - 1)));
  }, [matches.length]);

  if (!open) return null;

  const choose = (item: Item) => {
    setOpen(false);
    navigate(item.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % Math.max(1, matches.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + matches.length) % Math.max(1, matches.length));
    } else if (e.key === "Enter" && matches[cursor]) {
      e.preventDefault();
      choose(matches[cursor]);
    }
  };

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4"
      style={{ background: "rgba(5,6,7,0.72)" }}
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="panel w-full max-w-xl settle"
        style={{ background: "var(--sheet)", borderColor: "var(--rule-strong)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-[var(--rule)]">
          <FaSearch className="text-[length:var(--t-fine)] text-[var(--ink-4)] shrink-0" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search raises, desks, or type a command"
            aria-label="Search raises, desks and commands"
            className="flex-1 bg-transparent outline-none text-[length:var(--t-base)] text-[var(--ink)] placeholder:text-[var(--ink-4)]"
          />
          <span className="kbd shrink-0">esc</span>
        </div>

        <div className="max-h-[52vh] overflow-y-auto">
          {matches.length === 0 ? (
            <p className="px-3.5 py-6 text-[length:var(--t-fine)] text-[var(--ink-3)] text-center">
              Nothing matches “{q.trim()}”.
            </p>
          ) : (
            matches.map((item, i) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              return (
                <div key={item.id}>
                  {header && <p className="label px-3.5 pt-3 pb-1.5">{header}</p>}
                  <button
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => choose(item)}
                    aria-selected={i === cursor}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors"
                    style={{
                      background: i === cursor ? "var(--sheet-raised)" : "transparent",
                      boxShadow: i === cursor ? "inset 2px 0 0 var(--falu)" : undefined,
                    }}
                  >
                    <span className="w-[18px] grid place-items-center text-[length:var(--t-fine)] text-[var(--ink-3)] shrink-0">
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[length:var(--t-fine)] text-[var(--ink)] truncate">
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="block text-[length:var(--t-fine)] text-[var(--ink-4)] truncate">
                          {item.hint}
                        </span>
                      )}
                    </span>
                    {i === cursor && (
                      <FaArrowRight className="text-[9px] text-[var(--falu)] shrink-0" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 px-3.5 py-2 border-t border-[var(--rule)] text-[length:var(--t-fine)] text-[var(--ink-4)]">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> move</span>
          <span><span className="kbd">↵</span> open</span>
          <span className="ml-auto tabular">{matches.length} results</span>
        </div>
      </div>
    </div>
  );
};

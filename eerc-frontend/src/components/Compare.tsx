import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FaTimes, FaBalanceScale } from "react-icons/fa";
import { Panel, Empty } from "./ui/Panel";
import { Avatar } from "./ui/Avatar";
import { useRegistryFeed } from "../hooks/useRegistryFeed";
import { compact, short, since } from "./ui/format";

/**
 * Two or three raises, side by side.
 *
 * A feed answers "what exists"; this answers "which of these". The rows are
 * the figures a reader actually weighs one launch against another on —
 * raised, settled, recipients, phase — and every one is the same contract
 * read the launch page uses, so a comparison cannot say something the raise
 * itself does not.
 *
 * Capped at three. A fourth column stops being a comparison and starts being
 * a worse version of the feed.
 */
const MAX = 3;
const STORE = "norr.compare.v1";

/**
 * The comparison set survives navigation.
 *
 * Holding it only in the query string meant picking two raises in the feed
 * and then clicking Compare in the rail arrived with an empty page — the
 * selection lived in the URL you just left. It is a working set, so it is
 * kept in this browser, and `?ids=` still overrides it so a comparison stays
 * shareable as a link.
 */
const readSet = (): string[] => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE) ?? "[]") as string[];
    return Array.isArray(raw) ? raw.slice(0, MAX) : [];
  } catch {
    return [];
  }
};

const writeSet = (ids: string[]) => {
  try {
    if (ids.length) window.localStorage.setItem(STORE, JSON.stringify(ids));
    else window.localStorage.removeItem(STORE);
  } catch {
    /* the set simply does not outlive the tab */
  }
  window.dispatchEvent(new Event("norr:compare"));
};

export const Compare = () => {
  const [params, setParams] = useSearchParams();
  const feed = useRegistryFeed("newest", 100);

  // A shared link wins; otherwise the working set this browser is holding.
  const fromUrl = (params.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX);

  const [stored, setStored] = useState<string[]>(readSet);
  useEffect(() => {
    const sync = () => setStored(readSet());
    window.addEventListener("norr:compare", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("norr:compare", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const ids = fromUrl.length ? fromUrl : stored;

  // A shared set becomes this browser's working set, so removing from it
  // behaves the same either way.
  useEffect(() => {
    if (fromUrl.length) writeSet(fromUrl);
  }, [params.get("ids")]);

  const chosen = ids
    .map((id) => feed.rows.find((r) => r.launch.ido.toLowerCase() === id.toLowerCase()))
    .filter((r): r is NonNullable<typeof r> => !!r);

  const drop = (ido: string) => {
    const remaining = ids.filter((i) => i.toLowerCase() !== ido.toLowerCase());
    writeSet(remaining);
    const next = new URLSearchParams(params);
    if (remaining.length) next.set("ids", remaining.join(","));
    else next.delete("ids");
    setParams(next, { replace: true });
  };

  if (chosen.length === 0) {
    return (
      <div className="max-w-4xl">
        <header className="mb-5">
          <h1 className="lead">Compare</h1>
          <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-1.5 max-w-2xl">
            Put two or three raises next to each other on the figures that
            decide between them.
          </p>
        </header>
        <Empty
          icon={<FaBalanceScale />}
          title="Nothing to compare yet"
          body="Add a raise from its card in the feed, or from the compare control on any launch page. Up to three at a time."
          action={
            <Link
              to="/"
              className="px-4 py-2 border border-[var(--rule)] rounded-[var(--r-control)] text-[length:var(--t-fine)] uppercase tracking-[0.09em] text-[var(--ink)] hover:border-[var(--ink)] transition-colors"
            >
              Browse raises
            </Link>
          }
        />
      </div>
    );
  }

  const rows: { label: string; value: (r: (typeof chosen)[number]) => string }[] = [
    { label: "Ticker", value: (r) => r.launch.symbol },
    { label: "Raised", value: (r) => `${compact(Number(r.format(r.raised)))} ${r.assetSymbol}` },
    { label: "Paid out", value: (r) => `${compact(Number(r.format(r.distributed)))} ${r.assetSymbol}` },
    {
      label: "Settled",
      value: (r) =>
        r.raised > 0n ? `${(Number((r.distributed * 10000n) / r.raised) / 100).toFixed(0)}%` : "—",
    },
    { label: "Recipients", value: (r) => String(r.splitCount) },
    { label: "Phase", value: (r) => (r.finalized ? "Tally published" : "Accepting") },
    { label: "Splits", value: (r) => (r.locked ? "Frozen" : "Editable") },
    { label: "Opened", value: (r) => since(Number(r.launch.createdAt)) },
    { label: "Creator", value: (r) => short(r.launch.creator) },
  ];

  return (
    <div className="max-w-5xl">
      <header className="mb-5">
        <h1 className="lead">Compare</h1>
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-1.5">
          {chosen.length} of {MAX} — every figure read from the same contracts
          the launch pages use.
        </p>
      </header>

      <Panel flush>
        <div className="overflow-x-auto">
          <table className="w-full text-[length:var(--t-fine)]">
            <thead>
              <tr className="border-b border-[var(--rule)]">
                <th className="label font-medium px-3 py-2 text-left w-28">Figure</th>
                {chosen.map((r) => (
                  <th key={r.launch.ido} className="px-3 py-2 text-left">
                    <span className="flex items-center gap-2">
                      <Avatar
                        src={r.launch.logoURI || undefined}
                        seed={r.launch.ido}
                        fallback={r.launch.symbol}
                        size={22}
                      />
                      <Link
                        to={`/raise/${r.launch.ido}`}
                        className="text-[var(--ink)] font-bold truncate hover:text-[var(--falu)] transition-colors"
                      >
                        {r.launch.name}
                      </Link>
                      <button
                        onClick={() => drop(r.launch.ido)}
                        aria-label={`Remove ${r.launch.name} from the comparison`}
                        className="text-[var(--ink-4)] hover:text-[var(--falu)] transition-colors ml-auto"
                      >
                        <FaTimes className="text-[9px]" />
                      </button>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-[var(--rule)] last:border-0">
                  <th scope="row" className="label font-medium px-3 py-2 text-left align-top">
                    {row.label}
                  </th>
                  {chosen.map((r) => (
                    <td key={r.launch.ido} className="px-3 py-2 tabular text-[var(--ink)]">
                      {row.value(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
};

/** The control that adds a raise to the comparison, used on feed cards. */
export const CompareToggle = ({ ido }: { ido: string }) => {
  const [ids, setIds] = useState<string[]>(readSet);

  useEffect(() => {
    const sync = () => setIds(readSet());
    window.addEventListener("norr:compare", sync);
    return () => window.removeEventListener("norr:compare", sync);
  }, []);

  const inSet = ids.some((i) => i.toLowerCase() === ido.toLowerCase());

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        writeSet(
          inSet
            ? ids.filter((i) => i.toLowerCase() !== ido.toLowerCase())
            : [...ids, ido].slice(0, MAX),
        );
      }}
      aria-label={inSet ? "Remove from comparison" : "Add to comparison"}
      title={inSet ? "Remove from comparison" : "Add to comparison"}
      className="transition-colors"
      style={{ color: inSet ? "var(--falu)" : "var(--ink-4)" }}
    >
      <FaBalanceScale className="text-[length:var(--t-fine)]" />
    </button>
  );
};

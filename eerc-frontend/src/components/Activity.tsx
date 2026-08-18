import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaCoins, FaArrowDown, FaGift, FaComment, FaUserPlus, FaRocket, FaSync,
} from "react-icons/fa";
import { Panel } from "./ui/Panel";
import { Segmented } from "./ui/Controls";
import { ActionButton } from "./ActionButton";
import { useActivity, type ActivityItem } from "../hooks/useActivity";
import { usePreferences } from "../hooks/usePreferences";

const ICONS: Record<ActivityItem["kind"], React.ReactNode> = {
  released: <FaCoins />,
  deposited: <FaArrowDown />,
  claimed: <FaGift />,
  comment: <FaComment />,
  followed: <FaUserPlus />,
  registered: <FaRocket />,
};

/** Money moving is the accent; everything else sits in ink. */
const TONES: Record<ActivityItem["kind"], string> = {
  released: "var(--falu)",
  deposited: "var(--falu)",
  claimed: "var(--gain)",
  comment: "var(--ink-3)",
  followed: "var(--ink-3)",
  registered: "var(--ochre)",
};

/**
 * Protocol activity, reconstructed from contract logs.
 *
 * Rebuilt from logs rather than served from an index, so it needs no backend
 * and nothing can appear here that did not happen on chain. Defaults to this
 * wallet, which is useless before you have any history — hence the toggle.
 */
export const Activity = () => {
  const { prefs } = usePreferences();
  const [mine, setMine] = useState(prefs.activityScope === "mine");
  const a = useActivity(mine);

  if (!a.hasRegistry) {
    return <Empty title="Nothing to read" body={`No registry on chain ${a.chainId}.`} />;
  }

  return (
    <div className="max-w-4xl">
      <header className="flex items-start justify-between gap-4 flex-wrap mb-5">
        <div>
          <h1 className="lead">Activity</h1>
          <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-1.5 max-w-xl">
            Rebuilt from contract logs, so it needs no server and nothing can
            appear here that did not happen on chain.
          </p>
        </div>
        <ActionButton onClick={a.reload} disabled={a.loading} tone="quiet">
          <FaSync /> {a.loading ? "Reading…" : "Refresh"}
        </ActionButton>
      </header>

      <Panel
        flush
        title={
          <Segmented
            options={[
              { value: "mine" as const, label: "Yours" },
              { value: "all" as const, label: "Everyone" },
            ]}
            value={mine ? "mine" : "all"}
            onChange={(v) => setMine(v === "mine")}
            label="Activity scope"
            accent
          />
        }
        aside={
          <span className="text-[length:var(--t-fine)] text-[var(--ink-3)] tabular">
            {a.items.length} entries
          </span>
        }
      >
        {/* With no wallet there is no address to scope the logs to, so what
            is actually on screen is everyone's activity. Saying "connect a
            wallet" while showing protocol-wide rows would misattribute every
            line to the reader. */}
        {mine && !a.isConnected && (
          <p className="text-[length:var(--t-fine)] text-[var(--ochre)] px-3.5 py-2.5 border-b border-[var(--rule)]">
            No wallet connected — showing everyone's activity.
          </p>
        )}

        {a.error && (
          <p className="text-[length:var(--t-fine)] text-[var(--falu)] p-3.5">{a.error}</p>
        )}

        {a.items.length === 0 ? (
          <p className="text-[length:var(--t-base)] text-[var(--ink-3)] p-4">
            {a.loading ? "Reading the chain…" : "Nothing recorded yet."}
          </p>
        ) : (
          <ul>
            {a.items.map((item, i) => (
              <li key={`${item.txHash}-${i}`}>
                <Row item={item} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

const Row = ({ item }: { item: ActivityItem }) => {
  const body = (
    <>
      <span
        className="w-6 h-6 grid place-items-center border border-[var(--rule)] rounded-[var(--r-control)] text-[10px] shrink-0"
        style={{ color: TONES[item.kind] }}
      >
        {ICONS[item.kind]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[length:var(--t-fine)] text-[var(--ink)] truncate">
          {item.summary}
        </span>
      </span>
      <span className="text-[length:var(--t-fine)] text-[var(--ink-4)] tabular shrink-0">
        #{item.blockNumber.toString()}
      </span>
    </>
  );

  const cls =
    "flex items-center gap-3 px-3.5 py-2.5 border-b border-[var(--rule)] last:border-0 transition-colors";

  return item.href ? (
    <Link to={item.href} className={`${cls} hover:bg-[var(--sheet-raised)]`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
};

const Empty = ({ title, body }: { title: string; body: string }) => (
  <div className="border border-dashed border-[var(--rule)] rounded-[var(--r-panel)] p-12 text-center">
    <p className="text-[var(--ink)] font-bold">{title}</p>
    <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-2">{body}</p>
  </div>
);

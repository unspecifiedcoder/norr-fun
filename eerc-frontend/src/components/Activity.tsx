import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaCoins, FaArrowDown, FaGift, FaComment, FaUserPlus, FaRocket, FaSync,
} from "react-icons/fa";
import { Card } from "./Card";
import { ActionButton } from "./ActionButton";
import { useActivity, type ActivityItem } from "../hooks/useActivity";
import { usePreferences } from "../hooks/usePreferences"; const ICONS: Record<ActivityItem["kind"], React.ReactNode> = { released: <FaCoins />, deposited: <FaArrowDown />, claimed: <FaGift />, comment: <FaComment />, followed: <FaUserPlus />, registered: <FaRocket />,
}; const TONES: Record<ActivityItem["kind"], string> = { released: "text-[var(--lichen)]", deposited: "text-[var(--fjord)]", claimed: "text-[var(--fjord)]", comment: "text-[var(--ink-2)]", followed: "text-[var(--fjord)]", registered: "text-[var(--ochre)]",
};

/**
 * Protocol activity, reconstructed from contract logs.
 *
 * Defaults to this wallet's own activity; the toggle widens it to everything
 * on the protocol, which is what makes it useful before you have any history.
 */
export const Activity = () => { const { prefs } = usePreferences(); const [mine, setMine] = useState(prefs.activityScope === "mine"); const a = useActivity(mine); if (!a.hasRegistry) { return (
      <Empty title="Nothing to read" body={`No registry on chain ${a.chainId}.`} />
    );
  } return (
    <Card title="Activity">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <p className="text-[var(--ink-2)] text-[length:var(--t-base)] max-w-lg">
          Rebuilt from contract logs, so it needs no server and nothing can appear here that did not happen on chain.
        </p>
        <ActionButton onClick={a.reload} disabled={a.loading}>
          <FaSync /> {a.loading ? "Reading…" : "Refresh"}
        </ActionButton>
      </div>

      <div className="flex gap-1 mb-5">
        {[
          { key: true, label: "Yours" },
          { key: false, label: "Everyone" },
        ].map((t) => (
          <button key={String(t.key)} onClick={() => setMine(t.key)} className={`px-3 py-1.5 text-[length:var(--t-fine)] border transition-colors ${ mine === t.key
                ? "border-[var(--rule)] bg-[var(--snow-sunk)] text-[var(--ink)]"
                : "border-[var(--rule)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-[var(--rule)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mine && !a.isConnected && (
        <p className="text-[length:var(--t-fine)] text-[var(--ochre)] mb-4">
          Connect a wallet, or switch to Everyone.
        </p>
      )}

      {a.error && <p className="text-[length:var(--t-fine)] text-[var(--falu)] mb-4">{a.error}</p>}

      {a.items.length === 0 ? (
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)]">
          {a.loading ? "Reading the chain…" : "Nothing recorded yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {a.items.map((item, i) => (
            <li key={`${item.txHash}-${i}`}>
              <Row item={item} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}; const Row = ({ item }: { item: ActivityItem }) => { const body = (
    <>
      <span className={`text-[length:var(--t-fine)] shrink-0 ${TONES[item.kind]}`}>{ICONS[item.kind]}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[length:var(--t-base)] text-[var(--ink)] truncate">{item.summary}</span>
        <span className="block text-[length:var(--t-fine)] text-[var(--ink-3)] font-mono"> block {item.blockNumber.toString()}
        </span>
      </span>
    </>
  ); return item.href ? (
    <Link to={item.href} className="flex items-center gap-3 p-3 border border-[var(--rule)] hover:border-[var(--rule)] transition-colors"
    >
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 p-3 border border-[var(--rule)]">
      {body}
    </div>
  );
}; const Empty = ({ title, body }: { title: string; body: string }) => (
  <div className="border border-dashed border-[var(--rule)] p-10 text-center">
    <p className="text-[var(--ink)] font-bold">{title}</p>
    <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-2">{body}</p>
  </div>
);

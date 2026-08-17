import { useState } from "react";
import { Link } from "react-router-dom";
import {
  FaCoins, FaArrowDown, FaGift, FaComment, FaUserPlus, FaRocket, FaSync,
} from "react-icons/fa";
import { Card } from "./Card";
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

const TONES: Record<ActivityItem["kind"], string> = {
  released: "text-emerald-400",
  deposited: "text-blue-400",
  claimed: "text-violet-400",
  comment: "text-gray-400",
  followed: "text-cyan-400",
  registered: "text-amber-400",
};

/**
 * Protocol activity, reconstructed from contract logs.
 *
 * Defaults to this wallet's own activity; the toggle widens it to everything
 * on the protocol, which is what makes it useful before you have any history.
 */
export const Activity = () => {
  const { prefs } = usePreferences();
  const [mine, setMine] = useState(prefs.activityScope === "mine");
  const a = useActivity(mine);

  if (!a.hasRegistry) {
    return (
      <Empty title="Nothing to read" body={`No registry on chain ${a.chainId}.`} />
    );
  }

  return (
    <Card title="Activity">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <p className="text-gray-400 text-sm max-w-lg">
          Rebuilt from contract logs, so it needs no server and nothing can
          appear here that did not happen on chain.
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
          <button
            key={String(t.key)}
            onClick={() => setMine(t.key)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              mine === t.key
                ? "border-gray-500 bg-white/10 text-white"
                : "border-gray-700 text-gray-500 hover:text-gray-200 hover:border-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mine && !a.isConnected && (
        <p className="text-xs text-amber-400 mb-4">
          Connect a wallet, or switch to Everyone.
        </p>
      )}

      {a.error && <p className="text-xs text-rose-400 mb-4">{a.error}</p>}

      {a.items.length === 0 ? (
        <p className="text-sm text-gray-500">
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
};

const Row = ({ item }: { item: ActivityItem }) => {
  const body = (
    <>
      <span className={`text-xs shrink-0 ${TONES[item.kind]}`}>{ICONS[item.kind]}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-gray-200 truncate">{item.summary}</span>
        <span className="block text-[10px] text-gray-600 font-mono">
          block {item.blockNumber.toString()}
        </span>
      </span>
    </>
  );

  return item.href ? (
    <Link
      to={item.href}
      className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
    >
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-700">
      {body}
    </div>
  );
};

const Empty = ({ title, body }: { title: string; body: string }) => (
  <div className="border border-dashed border-gray-700 rounded-xl p-10 text-center">
    <p className="text-gray-200 font-bold">{title}</p>
    <p className="text-sm text-gray-500 mt-2">{body}</p>
  </div>
);

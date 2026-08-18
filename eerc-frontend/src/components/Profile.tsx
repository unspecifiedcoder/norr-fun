import { Link, useParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { Card } from "./Card";
import { useRegistryFeed } from "../hooks/useRegistryFeed";
import { useSocial } from "../hooks/useSocial";
import { ActionButton } from "./ActionButton";
import { FaUserPlus, FaUserCheck } from "react-icons/fa"; const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * What one address has done on the protocol: raises they started, and
 * allocations they are owed across every raise.
 *
 * Holdings of a raise are deliberately absent -- contributions are encrypted,
 * so no third party can enumerate who put in what. Fee allocations are public
 * by nature, because recipients have to be able to verify their own share.
 */
export const Profile = () => { const { address: routeAddress } = useParams<{ address: string }>(); const { address: connected } = useAccount(); const who = routeAddress ?? connected; const feed = useRegistryFeed("newest", 100); const social = useSocial({ account: routeAddress ?? connected }); if (!who) { return (
      <Notice title="No address" body="Connect a wallet or open a profile by address." />
    );
  } const lower = who.toLowerCase(); const created = feed.rows.filter((r) => r.launch.creator.toLowerCase() === lower); return (
    <>
      <Card title="Profile">
        <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] uppercase tracking-wider mb-1">Address</p>
        <p className="font-mono text-[length:var(--t-base)] text-[var(--ink)] break-all">{who}</p>
        {connected?.toLowerCase() === lower && (
          <p className="text-[length:var(--t-fine)] text-[var(--lichen)] mt-2">This is you.</p>
        )}
        {social.canFollow && (
          <div className="mt-4">
            <ActionButton onClick={social.toggleFollow} disabled={social.busy}>
              {social.isFollowing ? <FaUserCheck /> : <FaUserPlus />}
              {social.isFollowing ? "Following" : "Follow"}
            </ActionButton>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          <Stat label="Followers" value={String(social.followers)} />
          <Stat label="Following" value={String(social.following)} />
          <Stat label="Raises started" value={String(created.length)} />
          <Stat label="Total raised across them" value={ created.length
                ? `${created
                    .reduce((sum, r) => sum + Number(r.format(r.raised)), 0)
                    .toLocaleString()} ${created[0].assetSymbol}`
                : "—"
            }
          />
        </div>
      </Card>

      <Card title="Raises they started">
        {created.length === 0 ? (
          <p className="text-[length:var(--t-base)] text-[var(--ink-3)]">Nothing yet.</p>
        ) : (
          <ul className="space-y-2">
            {created.map((r) => (
              <li key={r.launch.ido}>
                <Link to={`/raise/${r.launch.ido}`} className="flex items-center gap-3 p-3 border border-[var(--rule)] hover:border-[var(--rule)] transition-colors"
                >
                  <span className="w-8 h-8 rounded bg-[var(--fjord-wash)] border border-[var(--rule)] grid place-items-center text-[length:var(--t-fine)] font-bold shrink-0">
                    {r.launch.symbol.slice(0, 4)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[length:var(--t-base)] text-[var(--ink)] font-bold truncate">
                      {r.launch.name}
                    </span>
                    <span className="block text-[length:var(--t-fine)] text-[var(--ink-3)]"> vault {short(r.launch.feeRouter)}
                    </span>
                  </span>
                  <span className="text-[length:var(--t-fine)] text-[var(--ink-2)] shrink-0">
                    {Number(r.format(r.raised)).toLocaleString()} {r.assetSymbol}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}; const Stat = ({ label, value }: { label: string; value: string }) => (
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

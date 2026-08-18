import { Link, useParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { FaUserPlus, FaUserCheck, FaCopy } from "react-icons/fa";
import { Panel, Figure } from "./ui/Panel";
import { Avatar } from "./ui/Avatar";
import { ActionButton } from "./ActionButton";
import { useRegistryFeed } from "../hooks/useRegistryFeed";
import { useSocial } from "../hooks/useSocial";
import { short, compact, since } from "./ui/format";

/**
 * What one address has done on the protocol.
 *
 * Holdings are deliberately absent. Contributions are encrypted, so no third
 * party can enumerate who put in what — and a profile that quietly listed
 * them would be advertising a leak. Raises started and fees owed are public
 * by nature: recipients have to be able to verify their own share.
 */
export const Profile = () => {
  const { address: routeAddress } = useParams<{ address: string }>();
  const { address: connected } = useAccount();
  const who = routeAddress ?? connected;
  const feed = useRegistryFeed("newest", 100);
  const social = useSocial({ account: who });

  if (!who) {
    return <Notice title="No address" body="Connect a wallet or open a profile by address." />;
  }

  const lower = who.toLowerCase();
  const created = feed.rows.filter((r) => r.launch.creator.toLowerCase() === lower);
  const isYou = connected?.toLowerCase() === lower;

  /**
   * What this creator's launches have actually done.
   *
   * A profile that only counts raises rewards volume; these are the figures
   * that separate a creator who shipped something from one who deployed a lot
   * of empty contracts — how much was raised, how much of it has reached its
   * recipients, and how many rounds are still open.
   */
  const dashboard = {
    raised: created.reduce((sum, r) => sum + r.raised, 0n),
    distributed: created.reduce((sum, r) => sum + r.distributed, 0n),
    open: created.filter((r) => !r.finalized).length,
    tallied: created.filter((r) => r.finalized).length,
    frozen: created.filter((r) => r.locked).length,
    recipients: created.reduce((sum, r) => sum + r.splitCount, 0),
    symbol: created[0]?.assetSymbol ?? "",
  };
  const settledPct =
    dashboard.raised > 0n
      ? Number((dashboard.distributed * 10_000n) / dashboard.raised) / 100
      : 0;

  return (
    <div className="max-w-5xl">
      <Panel hud className="mb-4">
        <div className="flex items-start gap-4 flex-wrap">
          <Avatar seed={who} fallback={who.slice(2, 6)} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[length:var(--t-lead)] font-bold tracking-[-0.03em] text-[var(--ink)] leading-none">
                {short(who, 8, 6)}
              </h1>
              {isYou && <span className="mark mark--live">you</span>}
              <button
                onClick={() => navigator.clipboard?.writeText(who)}
                aria-label="Copy address"
                className="text-[var(--ink-4)] hover:text-[var(--ink)] transition-colors"
              >
                <FaCopy className="text-[10px]" />
              </button>
            </div>
            <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] break-all mt-1.5">
              {who}
            </p>
          </div>

          {social.canFollow && (
            <ActionButton
              onClick={social.toggleFollow}
              disabled={social.busy}
              tone={social.isFollowing ? "quiet" : "primary"}
            >
              {social.isFollowing ? <FaUserCheck /> : <FaUserPlus />}
              {social.isFollowing ? "Following" : "Follow"}
            </ActionButton>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
        <Figure label="Followers" value={String(social.followers)} />
        <Figure label="Following" value={String(social.following)} />
        <Figure label="Raises started" value={String(created.length)} />
        <Figure
          label="Raised across them"
          value={
            created.length
              ? `${compact(created.reduce((sum, r) => sum + Number(r.format(r.raised)), 0))} ${created[0].assetSymbol}`
              : "—"
          }
          tone="accent"
        />
      </div>

      {created.length > 0 && (
        <Panel title="As a creator" className="mb-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            <Figure
              label="Raised across all"
              value={`${compact(Number(dashboard.raised) / 1e18)} ${dashboard.symbol}`}
              tone="accent"
            />
            <Figure
              label="Reached recipients"
              value={`${compact(Number(dashboard.distributed) / 1e18)} ${dashboard.symbol}`}
              sub={dashboard.raised > 0n ? `${settledPct.toFixed(0)}% of what was raised` : undefined}
            />
            <Figure
              label="Rounds"
              value={`${dashboard.tallied} tallied`}
              sub={dashboard.open > 0 ? `${dashboard.open} still open` : "none open"}
            />
            <Figure
              label="People paid"
              value={String(dashboard.recipients)}
              sub={dashboard.frozen > 0 ? `${dashboard.frozen} with frozen splits` : undefined}
            />
          </div>
        </Panel>
      )}

      <Panel title={`Raises started${created.length ? ` · ${created.length}` : ""}`} flush>
        {created.length === 0 ? (
          <p className="text-[length:var(--t-base)] text-[var(--ink-3)] p-4">Nothing yet.</p>
        ) : (
          <ul>
            {created.map((r) => (
              <li key={r.launch.ido}>
                <Link
                  to={`/raise/${r.launch.ido}`}
                  className="flex items-center gap-3 px-3.5 py-3 border-b border-[var(--rule)] last:border-0 hover:bg-[var(--sheet-raised)] transition-colors"
                >
                  <Avatar
                    src={r.launch.logoURI || undefined}
                    seed={r.launch.ido}
                    fallback={r.launch.symbol}
                    size={32}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[length:var(--t-base)] text-[var(--ink)] font-bold truncate">
                      {r.launch.name}{" "}
                      <span className="text-[length:var(--t-fine)] text-[var(--ink-3)] font-normal">
                        {r.launch.symbol}
                      </span>
                    </span>
                    <span className="block text-[length:var(--t-fine)] text-[var(--ink-3)]">
                      opened {since(Number(r.launch.createdAt))} · vault{" "}
                      {short(r.launch.feeRouter)}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-[length:var(--t-fine)] text-[var(--ink)] tabular font-bold">
                      {compact(Number(r.format(r.raised)))} {r.assetSymbol}
                    </span>
                    <span className="block text-[length:var(--t-fine)] text-[var(--ink-4)]">
                      {r.finalized ? "tallied" : "accepting"}
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

const Notice = ({ title, body }: { title: string; body: string }) => (
  <div className="border border-dashed border-[var(--rule)] rounded-[var(--r-panel)] p-12 text-center">
    <p className="text-[var(--ink)] font-bold">{title}</p>
    <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-2">{body}</p>
  </div>
);

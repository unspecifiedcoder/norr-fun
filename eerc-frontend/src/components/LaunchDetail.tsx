import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import {
  FaArrowLeft, FaCopy, FaLock, FaFlagCheckered, FaComments, FaUsers,
  FaExchangeAlt, FaCoins, FaBullhorn, FaCheck,
} from "react-icons/fa";
import { erc20Abi } from "../contracts/abis";
import { useLaunchByIdo } from "../hooks/useLaunchByIdo";
import { useIdo } from "../hooks/useIdo";
import { useMarket } from "../hooks/useMarket";
import { useComments } from "../hooks/useComments";
import { useBoards } from "../hooks/useBoards";
import { useSocial } from "../hooks/useSocial";
import { slugForChain } from "../lib/chains";
import { Panel, Chip } from "./ui/Panel";
import { Tabs, Meter } from "./ui/Controls";
import { Avatar } from "./ui/Avatar";
import { CopyButton } from "./ui/Live";
import { short, compact, price as fmtPrice, pct } from "./ui/format";
import { MarketChart, TradePanel, TradesTable, GraduationRail } from "./Market";
import { FeeBuilder } from "./FeeBuilder";
import { IdoClaim } from "./IdoClaim";
import { Discussion } from "./Discussion";
import { Holders } from "./Holders";
import { Promote } from "./Promote";
import { Contribute } from "./Contribute";
import { ProofVerifier } from "./ProofVerifier";
import { PrivacyLedger } from "./PrivacyLedger";
import { getMarket } from "../hooks/useMarket";

type Tab = "trades" | "comments" | "holders" | "split" | "promote" | "privacy";

/**
 * Everything about one launch, resolved from the sale address in the URL.
 *
 * Two phases share this page and neither is allowed to borrow the other's
 * figures. The sealed round has a tally, recipients and a settlement state
 * but no price; the curve that trades the distributed token has a price, a
 * tape and a graduation target but no view into what anyone contributed.
 * The header shows whichever exists, and says which it is showing.
 */
export const LaunchDetail = () => {
  const { ido } = useParams<{ ido: string }>();
  const { launch, splits, loading, notFound, hasRegistry, chainId } = useLaunchByIdo(ido);
  const m = useMarket(ido);
  const comments = useComments(ido);
  const { boards } = useBoards();
  const social = useSocial({ subject: ido });
  const sale = useIdo(
    launch ? { ido: launch.ido, projectToken: launch.projectToken } : undefined,
  );
  const [tab, setTab] = useState<Tab>("trades");

  const { data: supplyRaw } = useReadContract({
    address: launch?.projectToken as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: "totalSupply",
    query: { enabled: !!launch?.projectToken },
  });
  const supply = supplyRaw ? Number(formatUnits(supplyRaw as bigint, 18)) : 0;

  if (!hasRegistry) {
    return <Notice title="Wrong network" body={`No registry on chain ${chainId}.`} />;
  }
  if (loading) return <Notice title="Loading…" body="Reading the registry." />;
  if (notFound || !launch) {
    return (
      <Notice
        title="No such raise"
        body="Nothing on this network matches that address. It may live on a different chain."
      />
    );
  }

  const desk = boards.find((b) => b.id === launch.boardId);
  /**
   * A curve quotes a price from its reserves the moment it is deployed, so
   * the header reports that price with no fills behind it rather than
   * claiming the launch has none. What changes with the first fill is the
   * *delta* — until then there is nothing to compare against.
   */
  const traded = m.exists;
  const spot = m.stats.last || Number(formatUnits(m.priceX18, 18));
  const marketCap = supply > 0 ? spot * supply : 0;
  const shareUrl = `${window.location.origin}/${slugForChain(chainId)}/raise/${launch.ido}`;

  const TABS = [
    { value: "trades" as const, label: "Trades", icon: <FaExchangeAlt className="text-[10px]" />, count: m.trades.length },
    { value: "comments" as const, label: "Discussion", icon: <FaComments className="text-[10px]" />, count: comments.total },
    { value: "holders" as const, label: "Holders", icon: <FaUsers className="text-[10px]" /> },
    { value: "split" as const, label: "Payout split", icon: <FaCoins className="text-[10px]" />, count: splits.length },
    { value: "promote" as const, label: "Placement", icon: <FaBullhorn className="text-[10px]" /> },
    { value: "privacy" as const, label: "Privacy", icon: <FaLock className="text-[10px]" /> },
  ];

  return (
    <>
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-[length:var(--t-fine)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors mb-4"
      >
        <FaArrowLeft className="text-[length:var(--t-fine)]" /> All raises
      </Link>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-4 items-start">
        {/* =============================== main column =============================== */}
        <div className="min-w-0 space-y-4">
          {/* ---- hero ---- */}
          <Panel hud>
            <div className="flex items-start gap-4 flex-wrap">
              <Avatar
                src={launch.logoURI || undefined}
                seed={launch.ido}
                fallback={launch.symbol}
                size={56}
                badge="A"
              />

              <div className="min-w-0 flex-1">
                <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">{launch.name}</p>
                <h1 className="lead text-[var(--ink)] mt-0.5">
                  {launch.symbol} <span className="text-[var(--ink-4)]">/</span>{" "}
                  {m.baseSymbol || "SEALED"}
                </h1>
                {launch.description && (
                  <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-2 max-w-2xl">
                    {launch.description}
                  </p>
                )}
              </div>

              {/* The one figure a reader looks for first, wherever it exists. */}
              <div className="text-right shrink-0">
                {traded ? (
                  <>
                    {m.stats.fills > 1 ? (
                      <p
                        className="text-[length:var(--t-fine)] font-bold tabular"
                        style={{ color: m.stats.change >= 0 ? "var(--gain)" : "var(--loss)" }}
                      >
                        {pct(m.stats.change)}{" "}
                        <span className="text-[var(--ink-3)] font-normal uppercase tracking-[0.1em]">
                          {m.stats.changeWindow === "24h" ? "24h" : "since open"}
                        </span>
                      </p>
                    ) : (
                      <p className="label">Opening price</p>
                    )}
                    <p className="text-[length:var(--t-lead)] font-bold tabular emissive text-[var(--ink)] leading-none mt-1">
                      {fmtPrice(spot)}
                    </p>
                    <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-1">
                      {m.baseSymbol} per {m.tokenSymbol || launch.symbol}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="label">Sealed round</p>
                    <p className="text-[length:var(--t-lead)] font-bold tabular emissive text-[var(--ink)] leading-none mt-1">
                      {compact(Number(formatUnits(m.baseReserve, 18)) || 0)}
                    </p>
                    <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-1">
                      no public price yet
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* ---- provenance strip ---- */}
            <div className="flex items-center gap-x-5 gap-y-1.5 flex-wrap mt-4 pt-3 border-t border-[var(--rule)]">
              <Meta label="Sale" value={short(launch.ido)} copy={launch.ido} />
              <Meta label="Token" value={short(launch.projectToken)} copy={launch.projectToken} />
              <Meta label="Vault" value={short(launch.feeRouter)} copy={launch.feeRouter} />
              <Meta label="By" value={short(launch.creator)} to={`/u/${launch.creator}`} />
              {desk && <Meta label="Desk" value={`/${desk.slug}`} to={`/desk/${desk.slug}`} />}
              <Meta
                label="Opened"
                value={new Date(Number(launch.createdAt) * 1000).toLocaleDateString()}
              />
              <Meta label="Share" value="copy link" copy={shareUrl} />
            </div>

            {/* ---- channel readout ---- */}
            <div className="flex gap-1.5 flex-wrap mt-3">
              {traded && (
                <>
                  <Chip k="Market cap" v={marketCap > 0 ? compact(marketCap) : "—"} />
                  <Chip
                    k="Liquidity"
                    v={`${compact(Number(m.format(m.baseReserve)))} ${m.baseSymbol}`}
                  />
                  <Chip k="Volume" v={compact(Number(m.format(m.stats.volumeBase)))} />
                  <Chip k="Fills" v={String(m.stats.fills)} />
                  {m.stats.ath > 0 && (
                    <Chip
                      k="From ath"
                      v={`${m.stats.fromAth.toFixed(1)}%`}
                      tone={m.stats.fromAth < 0 ? "loss" : "gain"}
                    />
                  )}
                </>
              )}
              <Chip k="Recipients" v={String(splits.length)} />
              <Chip k="Comments" v={String(comments.total)} />
              {social.available && <Chip k="Saved by" v={String(social.saves)} />}
              <Chip k="Supply" v={supply > 0 ? compact(supply) : "—"} />
            </div>
          </Panel>

          {/* ---- chart ---- */}
          {m.exists ? (
            <MarketChart m={m} supply={supply} />
          ) : (
            <Panel title="Price">
              <p className="text-[length:var(--t-base)] text-[var(--ink-3)]">
                This launch has no public market yet. A sealed round settles
                first — its contribution amounts stay private — and the
                distributed token trades openly once a curve is opened for it.
              </p>
            </Panel>
          )}

          {/* ---- tabs ---- */}
          <div>
            <Tabs tabs={TABS} value={tab} onChange={setTab} label="Launch detail" />
            <div className="mt-4">
              {tab === "trades" && (
                <Panel flush>
                  <TradesTable m={m} />
                </Panel>
              )}
              {tab === "comments" && <Discussion subject={launch.ido} creator={launch.creator} />}
              {tab === "holders" && (
                <Holders
                  token={launch.projectToken}
                  exclude={[
                    launch.ido,
                    launch.feeRouter,
                    getMarket(chainId, launch.ido) ?? "",
                  ].filter(Boolean)}
                />
              )}
              {tab === "split" && (
                <FeeBuilder
                  target={{
                    feeRouter: launch.feeRouter,
                    contributionAsset: launch.contributionAsset,
                    splits,
                  }}
                />
              )}
              {tab === "promote" && <Promote sale={launch.ido} />}
              {tab === "privacy" && (
                <div className="space-y-4">
                  <PrivacyLedger />
                  <ProofVerifier ido={launch.ido} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* =============================== side rail =============================== */}
        <div className="space-y-4 xl:sticky xl:top-[4.25rem]">
          <Panel
            title="Progress"
            hud
            aside={
              m.graduated ? (
                <span className="mark mark--settled">
                  <FaFlagCheckered className="text-[9px]" /> graduated
                </span>
              ) : m.exists ? (
                <span className="mark mark--live">on curve</span>
              ) : (
                <span className="mark mark--held">sealed</span>
              )
            }
          >
            {m.exists ? (
              <>
                {/* The one celebratory beat this product earns: a curve that
                    reached its target is finished, and the panel says so as a
                    stamp rather than a line of text. */}
                {m.graduated && (
                  <p
                    className="mb-3 py-2 text-center uppercase tracking-[0.3em] font-bold border settle"
                    style={{
                      color: "var(--gain)",
                      borderColor: "var(--gain)",
                      background: "var(--gain-wash)",
                    }}
                  >
                    graduated
                  </p>
                )}
                <GraduationRail m={m} />
                <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-2.5">
                  {m.graduated
                    ? "Reserves were released to the payout split and trading on this curve is closed."
                    : `${m.progressPct.toFixed(1)}% of the way to graduation. At the target the curve releases its reserves into the split and closes.`}
                </p>
              </>
            ) : (
              <>
                <Meter
                  value={100}
                  max={100}
                  left={<span className="label">Round</span>}
                  right={<span className="label">Sealed</span>}
                />
                <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-2.5 flex items-start gap-2">
                  <FaLock className="mt-0.5 shrink-0 text-[var(--falu)]" />
                  Contributions are encrypted end to end. The tally, the split
                  and every claim are public and verifiable on chain.
                </p>
              </>
            )}
          </Panel>

          {/* Contribution comes before trading in the rail because it comes
              before it in the launch's life: the sealed round settles first,
              and only then does the distributed token trade. */}
          <Contribute vault={launch.creator} finalized={sale.finalized} />

          {m.exists && <TradePanel m={m} />}

          <IdoClaim target={{ ido: launch.ido, projectToken: launch.projectToken }} />

          {social.available && social.isConnected && (
            <button
              onClick={social.toggleSave}
              disabled={social.busy}
              className="w-full px-4 py-2 border border-[var(--rule)] rounded-[var(--r-control)] text-[length:var(--t-fine)] uppercase tracking-[0.09em] text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-[var(--rule-strong)] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {social.isSaved ? <FaCheck /> : null}
              {social.isSaved ? "On your watchlist" : "Save to watchlist"}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

/* ------------------------------------------------------------- fragments */

const Meta = ({
  label,
  value,
  copy,
  to,
}: {
  label: string;
  value: string;
  copy?: string;
  to?: string;
}) => (
  <span className="flex items-baseline gap-1.5 min-w-0">
    <span className="label">{label}</span>
    {to ? (
      <Link
        to={to}
        className="text-[length:var(--t-fine)] text-[var(--ink)] hover:text-[var(--falu)] transition-colors truncate"
      >
        {value}
      </Link>
    ) : (
      <span className="text-[length:var(--t-fine)] text-[var(--ink)] truncate">{value}</span>
    )}
    {copy && (
      <CopyButton
        value={copy}
        label={label}
        className="text-[var(--ink-4)] hover:text-[var(--ink)] transition-colors shrink-0"
      >
        <FaCopy className="text-[10px]" />
      </CopyButton>
    )}
  </span>
);

const Notice = ({ title, body }: { title: string; body: string }) => (
  <div className="border border-dashed border-[var(--rule)] rounded-[var(--r-panel)] p-12 text-center">
    <p className="text-[var(--ink)] font-bold">{title}</p>
    <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-2">{body}</p>
    <Link
      to="/"
      className="inline-block mt-5 text-[length:var(--t-fine)] text-[var(--falu)] hover:text-[var(--falu-bright)] transition-colors"
    >
      Back to all raises
    </Link>
  </div>
);

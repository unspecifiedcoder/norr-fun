import { Link, useParams } from "react-router-dom";
import { FaArrowLeft, FaCopy } from "react-icons/fa";
import { Card } from "./Card";
import { FeeBuilder } from "./FeeBuilder";
import { IdoClaim } from "./IdoClaim";
import { Discussion } from "./Discussion";
import { Market } from "./Market";
import { useLaunchByIdo } from "../hooks/useLaunchByIdo";

const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-6)}`;

/**
 * Everything about one launch, resolved from the sale address in the URL.
 *
 * There is deliberately no price chart, trade history or holder list here.
 * A sealed contribution round has no continuous price and no public per-trade
 * record, and the holder set is private by design -- rendering any of those
 * would mean inventing data the protocol does not produce.
 */
export const LaunchDetail = () => {
  const { ido } = useParams<{ ido: string }>();
  const { launch, splits, loading, notFound, hasRegistry, chainId } = useLaunchByIdo(ido);

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

  const target = {
    feeRouter: launch.feeRouter,
    contributionAsset: launch.contributionAsset,
    splits,
  };

  return (
    <>
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-gray-200 transition-colors mb-5"
      >
        <FaArrowLeft className="text-[10px]" /> All raises
      </Link>

      <Card title={launch.name}>
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/25 to-fuchsia-500/25 border border-gray-600 grid place-items-center shrink-0 text-sm font-bold">
            {launch.symbol.slice(0, 4)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-gray-400 text-sm">
              {launch.description || "No summary was provided for this raise."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-4">
              <Row label="Ticker" value={launch.symbol} />
              <Row label="Started by" value={short(launch.creator)} copy={launch.creator} />
              <Row label="Sale contract" value={short(launch.ido)} copy={launch.ido} />
              <Row label="Payout vault" value={short(launch.feeRouter)} copy={launch.feeRouter} />
              <Row label="Token" value={short(launch.projectToken)} copy={launch.projectToken} />
              <Row
                label="Opened"
                value={new Date(Number(launch.createdAt) * 1000).toLocaleDateString()}
              />
            </div>
          </div>
        </div>
      </Card>

      <Market sale={launch.ido} />
      <FeeBuilder target={target} />
      <IdoClaim target={{ ido: launch.ido, projectToken: launch.projectToken }} />
      <Discussion subject={launch.ido} />
    </>
  );
};

const Row = ({ label, value, copy }: { label: string; value: string; copy?: string }) => (
  <div className="flex items-baseline gap-2 min-w-0">
    <span className="text-[10px] uppercase tracking-wider text-gray-500 w-24 shrink-0">
      {label}
    </span>
    <span className="text-xs text-gray-200 font-mono truncate">{value}</span>
    {copy && (
      <button
        onClick={() => navigator.clipboard?.writeText(copy)}
        aria-label={`Copy ${label}`}
        className="text-gray-600 hover:text-gray-300 transition-colors shrink-0"
      >
        <FaCopy className="text-[10px]" />
      </button>
    )}
  </div>
);

const Notice = ({ title, body }: { title: string; body: string }) => (
  <div className="border border-dashed border-gray-700 rounded-xl p-10 text-center">
    <p className="text-gray-200 font-bold">{title}</p>
    <p className="text-sm text-gray-500 mt-2">{body}</p>
    <Link
      to="/"
      className="inline-block mt-5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
    >
      Back to all raises
    </Link>
  </div>
);

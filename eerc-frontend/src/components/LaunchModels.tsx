import { Link, useNavigate } from "react-router-dom";
import {
  FaBolt, FaArrowLeft, FaBook, FaLock,
  FaArrowRight, FaCheck,
} from "react-icons/fa";
import { useAccount } from "wagmi";
import { Panel } from "./ui/Panel";
import { usePromotion } from "../hooks/usePromotion";

/**
 * The launch model chooser.
 *
 * Three routes exist because they commit to genuinely different things, and
 * the differences are stated up front rather than discovered three signatures
 * in: an instant raise takes the defaults and ships, a full raise opens the
 * split editor before anything is deployed, and a desk is infrastructure
 * other people launch through.
 *
 * Nothing here is a paywall. Every model deploys the same contracts with the
 * same rules; what differs is how much of the shape you set by hand.
 */

const MODELS = [
  {
    to: "/start/instant",
    tag: "Standard",
    title: "Instant raise",
    lead: "Name it, ticker it, ship it.",
    points: [
      "Everything raised routes to you",
      "Four signatures, about a minute",
    ],
    foot: "The most common path",
    accent: false,
  },
  {
    to: "/start/raise",
    tag: "Full control",
    title: "Split raise",
    lead: "Set who earns before you deploy.",
    points: [
      "Up to eight recipients, enforced on chain",
      "Publish under a desk and meet its terms",
    ],
    foot: "For teams and partnered launches",
    accent: true,
  },
  {
    to: "/desks",
    tag: "Advanced",
    title: "Open a desk",
    lead: "Run a surface others launch through.",
    points: [
      "Set a minimum share of every raise",
      "Open to all, or invite only",
    ],
    foot: "For platforms, funds and KOLs",
    accent: false,
  },
];

export const LaunchModels = () => {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const promo = usePromotion();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[length:var(--t-fine)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
        >
          <FaArrowLeft /> Back
        </Link>
        <a
          href="https://github.com/"
          onClick={(e) => e.preventDefault()}
          title="Documentation ships with the repository"
          className="inline-flex items-center gap-2 px-3 py-1.5 border border-[var(--rule)] rounded-[var(--r-control)] text-[length:var(--t-fine)] text-[var(--ink-3)] hover:text-[var(--ink)] hover:border-[var(--rule-strong)] transition-colors"
        >
          <FaBook className="text-[10px]" /> How a raise works
        </a>
      </div>

      <header className="text-center mb-8">
        <h1 className="lead">Select a launch model</h1>
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-2 max-w-xl mx-auto">
          A raise, a split raise, or the desk other people raise through — all
          on the same contracts.
        </p>
      </header>

      {/* The recommended path, raised above the three by reversal rather than
          by a bigger card: rank without a second layout. */}
      <button
        onClick={() => navigate("/start/instant")}
        className="w-full flex items-center gap-4 px-4 py-3.5 mb-4 border rounded-[var(--r-panel)] text-left transition-colors bg-[var(--falu-wash)] border-[var(--falu-deep)] hover:border-[var(--falu)]"
      >
        <span className="w-9 h-9 grid place-items-center border border-[var(--falu)] rounded-[var(--r-control)] text-[var(--falu)] shrink-0">
          <FaBolt />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[length:var(--t-base)] font-bold text-[var(--ink)]">
            Instant launch
          </span>
          <span className="block text-[length:var(--t-fine)] text-[var(--ink-2)]">
            Recommended — live in under a minute with three fields.
          </span>
        </span>
        <FaArrowRight className="text-[var(--falu)] shrink-0" />
      </button>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {MODELS.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="card-link hud p-4 flex flex-col"
            style={m.accent ? { borderColor: "var(--falu-deep)" } : undefined}
          >
            <span className="mark mark--sealed self-start">{m.tag}</span>
            <h2 className="text-[length:var(--t-base)] font-bold text-[var(--ink)] mt-3">
              {m.title}
            </h2>
            <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-1">{m.lead}</p>
            <ul className="mt-3 space-y-1.5 flex-1">
              {m.points.map((p) => (
                <li
                  key={p}
                  className="text-[length:var(--t-fine)] text-[var(--ink-3)] flex items-start gap-2"
                >
                  <FaCheck className="text-[9px] text-[var(--falu)] mt-1 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
            <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-3 pt-3 border-t border-[var(--rule)]">
              {m.foot}
            </p>
          </Link>
        ))}
      </div>

      {/* The one feature that is this product's own, stated once, here. */}
      <Panel
        className="mt-4"
        title={
          <span className="flex items-center gap-2">
            <span className="text-[length:var(--t-base)] font-bold text-[var(--ink)]">
              Payout split
            </span>
            <span className="mark mark--live">signature</span>
          </span>
        }
        aside={
          <span className="text-[length:var(--t-fine)] text-[var(--ink-3)] uppercase tracking-[0.12em] hidden sm:block">
            included in every model
          </span>
        }
      >
        <p className="text-[length:var(--t-fine)] text-[var(--ink-2)]">
          Every raise routes through a fee router that holds the split as
          contract state: up to eight recipients, shares totalling exactly
          100%, each one withdrawing their own. It cannot be changed after the
          split is frozen, and the registry rejects a raise whose split does
          not meet its desk's terms.
        </p>
      </Panel>

      <Panel
        className="mt-4"
        title={
          <span className="flex items-center gap-2">
            <FaLock className="text-[var(--falu)] text-[10px]" />
            <span className="text-[length:var(--t-base)] font-bold text-[var(--ink)]">
              What stays private
            </span>
          </span>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="label mb-1.5">Sealed</p>
            <p className="text-[length:var(--t-fine)] text-[var(--ink-2)]">
              What each backer contributes, held as an encrypted balance. No
              wallet's position is readable from the chain.
            </p>
          </div>
          <div>
            <p className="label mb-1.5">Public and verifiable</p>
            <p className="text-[length:var(--t-fine)] text-[var(--ink-2)]">
              The payout split, the tally, every claim, and every trade once
              the distributed token opens a market.
            </p>
          </div>
        </div>
      </Panel>

      {promo.available && promo.tiers.length > 0 && (
        <Panel
          className="mt-4"
          title="Feed placement"
          aside={
            <span className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
              buy after you ship
            </span>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {promo.tiers.map((t) => (
              <div key={t.id} className="panel panel__body">
                <p className="text-[length:var(--t-base)] font-bold text-[var(--ink)]">
                  {t.name}
                </p>
                <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-0.5">
                  {t.duration > 0n
                    ? `Runs ${Number(t.duration) / 86400} days`
                    : "No placement — the default"}
                </p>
                <p className="text-[length:var(--t-base)] text-[var(--ink)] tabular mt-2 pt-2 border-t border-[var(--rule)]">
                  {t.price === 0n ? "Free" : `${promo.formatPrice(t.price)} ETH`}
                </p>
              </div>
            ))}
          </div>
          <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-3">
            Placement moves where a raise appears in the feed and nothing else.
            Promoted entries are labelled, and slots expire.
          </p>
        </Panel>
      )}

      {!isConnected && (
        <p className="text-[length:var(--t-fine)] text-[var(--ochre)] mt-4 text-center">
          Connect a wallet to deploy. Reading the models costs nothing.
        </p>
      )}
    </div>
  );
};

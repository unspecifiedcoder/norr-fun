import { FaLock, FaCoins, FaArrowDown } from "react-icons/fa";
import { Panel, Figure } from "./ui/Panel";
import { Donut, type Slice } from "./ui/Donut";
import { ActionButton } from "./ActionButton";
import { StyledInput } from "./StyledIntput";
import { useFeeRouter, type SplitRow, type FeeRouterTarget } from "../hooks/useFeeRouter";
import { short, compact } from "./ui/format";

const CATEGORY_COLORS: Record<string, string> = {
  Creator: "var(--cat-creator)",
  Partner: "var(--cat-partner)",
  Rewards: "var(--cat-rewards)",
  Marketing: "var(--cat-marketing)",
  Buyback: "var(--cat-buyback)",
  Liquidity: "var(--cat-liquidity)",
  Treasury: "var(--cat-treasury)",
  Custom: "var(--cat-custom)",
};

/**
 * Where a raise's proceeds go.
 *
 * The allocation bar is the point of the panel: eight pigments that separate
 * at four pixels wide and survive greyscale, so the shape of the split is
 * read before any figure is. Everything under it is the same information at
 * full precision, per recipient, with the release each one can pull.
 */
export const FeeBuilder = ({ target }: { target?: FeeRouterTarget } = {}) => {
  const fr = useFeeRouter(target);

  if (!fr.available) {
    return (
      <Panel title="Payout split">
        <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
          No launch is deployed on chain {fr.chainId}.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Payout split"
      aside={
        fr.locked ? (
          <span className="mark mark--settled">
            <FaLock className="text-[9px]" /> frozen
          </span>
        ) : (
          <span className="mark mark--held">editable</span>
        )
      }
    >
      <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mb-4">
        Where raised {fr.symbol} goes. Shares are enforced by the contract and
        total exactly 100%; each recipient withdraws their own.
      </p>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <Figure label="Raised" value={`${compact(Number(fr.format(fr.totalReceived)))} ${fr.symbol}`} />
        <Figure
          label="Distributed"
          value={`${compact(Number(fr.format(fr.totalReleased)))} ${fr.symbol}`}
        />
        <Figure
          label="Unclaimed"
          value={`${compact(Number(fr.format(fr.pending)))} ${fr.symbol}`}
          tone="accent"
        />
      </div>

      {/* The same allocation twice, deliberately: the bar shows order and
          the ring shows proportion, and a reader checking whether one party
          takes most of a raise sees it faster as an arc. */}
      {fr.rows.length > 1 && (
        <div className="mb-4">
          <Donut
            slices={fr.rows.map((row) => ({
              label: row.label || row.category,
              value: row.bps,
              color: CATEGORY_COLORS[row.category] ?? "var(--cat-custom)",
            })) as Slice[]}
            centre="100%"
            caption="Payout split"
          />
        </div>
      )}

      <div className="flex h-2.5 rounded-[var(--r-control)] overflow-hidden mb-4 bg-[var(--snow-sunk)] border border-[var(--rule)]">
        {fr.rows.map((row) => (
          <div
            key={`${row.recipient}-${row.category}`}
            style={{
              width: `${row.bps / 100}%`,
              background: CATEGORY_COLORS[row.category] ?? "var(--cat-custom)",
            }}
            title={`${row.label} — ${row.bps / 100}%`}
          />
        ))}
      </div>

      <ul className="space-y-2 mb-4">
        {fr.rows.map((row) => (
          <li key={`${row.recipient}-${row.category}`}>
            <SplitRowView
              row={row}
              symbol={fr.symbol}
              format={fr.format}
              busy={fr.busy}
              connected={fr.isConnected}
              onRelease={() => fr.release(row.recipient)}
            />
          </li>
        ))}
      </ul>

      <div className="border-t border-[var(--rule)] pt-4">
        <span className="label block mb-1.5">Route proceeds into the split</span>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <StyledInput
            value={fr.depositAmount}
            onChange={(e) => fr.setDepositAmount(e.target.value)}
            placeholder={`Amount in ${fr.symbol || "tokens"}`}
          />
          <ActionButton
            onClick={fr.deposit}
            disabled={fr.busy || !fr.isConnected || !fr.depositAmount}
          >
            <FaArrowDown /> Deposit
          </ActionButton>
        </div>

        {fr.isOwner && !fr.locked && (
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] max-w-md">
              Freezing these allocations is permanent, so contributors can verify
              the economics cannot be rewritten afterwards.
            </p>
            <ActionButton onClick={fr.lock} disabled={fr.busy} tone="quiet">
              <FaLock /> Freeze splits
            </ActionButton>
          </div>
        )}

        {fr.locked && (
          <p className="mt-3 text-[length:var(--t-fine)] text-[var(--gain)] flex items-center gap-2">
            <FaLock /> Splits are frozen and permanently immutable.
          </p>
        )}

        {!fr.isConnected && (
          <p className="mt-3 text-[length:var(--t-fine)] text-[var(--ochre)]">
            Connect a wallet to deposit or release.
          </p>
        )}

        {fr.status && (
          <p className="mt-3 text-[length:var(--t-fine)] text-[var(--ink-2)] break-words">
            {fr.status}
          </p>
        )}
      </div>
    </Panel>
  );
};

const SplitRowView = ({
  row,
  symbol,
  format,
  busy,
  connected,
  onRelease,
}: {
  row: SplitRow;
  symbol: string;
  format: (v: bigint) => string;
  busy: boolean;
  connected: boolean;
  onRelease: () => void;
}) => (
  <div className="panel panel--sunk p-3 flex flex-col sm:flex-row sm:items-center gap-3">
    <span
      className="w-1 self-stretch min-h-[2rem] shrink-0"
      style={{ background: CATEGORY_COLORS[row.category] ?? "var(--cat-custom)" }}
      aria-hidden="true"
    />
    <div className="min-w-0 flex-1">
      <p className="text-[length:var(--t-fine)] font-bold text-[var(--ink)]">
        {row.label}{" "}
        <span className="text-[var(--ink-3)] font-normal tabular">{row.bps / 100}%</span>
      </p>
      <p className="text-[length:var(--t-fine)] text-[var(--ink-4)]">{short(row.recipient)}</p>
    </div>
    <div className="text-left sm:text-right shrink-0">
      <p className="label">claimable</p>
      <p
        className="text-[length:var(--t-fine)] font-bold tabular"
        style={{ color: row.releasable > 0n ? "var(--gain)" : "var(--ink-4)" }}
      >
        {compact(Number(format(row.releasable)))} {symbol}
      </p>
      {row.released > 0n && (
        <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] tabular">
          {compact(Number(format(row.released)))} taken
        </p>
      )}
    </div>
    <ActionButton
      onClick={onRelease}
      disabled={busy || !connected || row.releasable === 0n}
      tone="quiet"
    >
      <FaCoins /> Release
    </ActionButton>
  </div>
);

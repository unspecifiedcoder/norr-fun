import { FaLock, FaCoins, FaArrowDown } from "react-icons/fa";
import { Card } from "./Card";
import { ActionButton } from "./ActionButton";
import { StyledInput } from "./StyledIntput";
import { useFeeRouter, type SplitRow, type FeeRouterTarget } from "../hooks/useFeeRouter";

const CATEGORY_COLORS: Record<string, string> = {
  Creator: "bg-blue-500",
  Partner: "bg-indigo-500",
  Rewards: "bg-emerald-500",
  Marketing: "bg-amber-500",
  Buyback: "bg-rose-500",
  Liquidity: "bg-cyan-500",
  Treasury: "bg-violet-500",
  Custom: "bg-gray-500",
};

const short = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

export const FeeBuilder = ({ target }: { target?: FeeRouterTarget } = {}) => {
  const fr = useFeeRouter(target);

  if (!fr.available) {
    return (
      <Card title="Fee Builder">
        <p className="text-gray-400 text-sm">
          No launch deployed on chain{" "}
          <span className="text-indigo-400 font-bold">{fr.chainId}</span>.
        </p>
        <p className="text-gray-500 text-xs mt-2">
          Deploy one with{" "}
          <code className="text-gray-300">
            npx hardhat run scripts/ido/05_deploy_fee_router.ts --network localhost
          </code>
        </p>
      </Card>
    );
  }

  return (
    <Card title="Fee Builder">
      <p className="text-gray-400 text-sm mb-5">
        Programmable routing of raised{" "}
        <span className="text-indigo-400 font-bold">{fr.symbol}</span> across
        recipients. Allocations are enforced on-chain and must total 100%.
      </p>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Raised" value={fr.format(fr.totalReceived)} symbol={fr.symbol} />
        <Stat label="Distributed" value={fr.format(fr.totalReleased)} symbol={fr.symbol} />
        <Stat label="Unclaimed" value={fr.format(fr.pending)} symbol={fr.symbol} />
      </div>

      {/* Allocation bar */}
      <div className="flex h-2 rounded-full overflow-hidden mb-5 bg-gray-800">
        {fr.rows.map((row) => (
          <div
            key={`${row.recipient}-${row.category}`}
            className={CATEGORY_COLORS[row.category] ?? "bg-gray-500"}
            style={{ width: `${row.bps / 100}%` }}
            title={`${row.label} — ${row.bps / 100}%`}
          />
        ))}
      </div>

      {/* Split rows */}
      <div className="space-y-3 mb-6">
        {fr.rows.map((row) => (
          <SplitRowView
            key={`${row.recipient}-${row.category}`}
            row={row}
            symbol={fr.symbol}
            format={fr.format}
            busy={fr.busy}
            connected={fr.isConnected}
            onRelease={() => fr.release(row.recipient)}
          />
        ))}
      </div>

      {/* Deposit */}
      <div className="border-t border-gray-700 pt-5">
        <label className="block text-sm text-gray-300 mb-2">
          Route proceeds into the split
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
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
            <p className="text-xs text-gray-500 max-w-md">
              Locking freezes these allocations permanently, so contributors can
              verify the economics cannot be rewritten. This cannot be undone.
            </p>
            <ActionButton onClick={fr.lock} disabled={fr.busy}>
              <FaLock /> Lock splits
            </ActionButton>
          </div>
        )}

        {fr.locked && (
          <p className="mt-4 text-xs text-emerald-400 flex items-center gap-2">
            <FaLock /> Splits are locked and permanently immutable.
          </p>
        )}

        {!fr.isConnected && (
          <p className="mt-3 text-xs text-amber-400">
            Connect a wallet to deposit or release.
          </p>
        )}

        {fr.status && (
          <p className="mt-3 text-xs text-gray-300 break-words font-mono">
            {fr.status}
          </p>
        )}
      </div>
    </Card>
  );
};

const Stat = ({
  label,
  value,
  symbol,
}: {
  label: string;
  value: string;
  symbol: string;
}) => (
  <div className="bg-black bg-opacity-40 border border-gray-700 rounded-lg p-3">
    <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
    <p className="text-base font-bold text-gray-100 break-all">{value}</p>
    <p className="text-[10px] text-gray-500">{symbol}</p>
  </div>
);

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
  <div className="bg-black bg-opacity-30 border border-gray-700 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${
        CATEGORY_COLORS[row.category] ?? "bg-gray-500"
      }`}
    />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold text-gray-100">
        {row.label}{" "}
        <span className="text-gray-500 font-normal">{row.bps / 100}%</span>
      </p>
      <p className="text-xs text-gray-500 font-mono">{short(row.recipient)}</p>
    </div>
    <div className="text-left sm:text-right shrink-0">
      <p className="text-xs text-gray-500">claimable</p>
      <p className="text-sm font-bold text-emerald-400 break-all">
        {format(row.releasable)} {symbol}
      </p>
      {row.released > 0n && (
        <p className="text-[10px] text-gray-500">
          claimed {format(row.released)}
        </p>
      )}
    </div>
    <ActionButton
      onClick={onRelease}
      disabled={busy || !connected || row.releasable === 0n}
    >
      <FaCoins /> Release
    </ActionButton>
  </div>
);

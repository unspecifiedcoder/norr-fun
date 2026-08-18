import { FaLock, FaCoins, FaArrowDown } from "react-icons/fa";
import { Card } from "./Card";
import { ActionButton } from "./ActionButton";
import { StyledInput } from "./StyledIntput";
import { useFeeRouter, type SplitRow, type FeeRouterTarget } from "../hooks/useFeeRouter"; const CATEGORY_COLORS: Record<string, string> = {
  Creator: "bg-[var(--cat-creator)]",
  Partner: "bg-[var(--cat-partner)]",
  Rewards: "bg-[var(--cat-rewards)]",
  Marketing: "bg-[var(--cat-marketing)]",
  Buyback: "bg-[var(--cat-buyback)]",
  Liquidity: "bg-[var(--cat-liquidity)]",
  Treasury: "bg-[var(--cat-treasury)]",
  Custom: "bg-[var(--cat-custom)]",
}; const short = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`; export const FeeBuilder = ({ target }: { target?: FeeRouterTarget } = {}) => { const fr = useFeeRouter(target); if (!fr.available) { return (
      <Card title="Payout split">
        <p className="text-[var(--ink-2)] text-[length:var(--t-base)]">
          No launch deployed on chain{" "}
          <span className="text-[var(--fjord)] font-bold">{fr.chainId}</span>.
        </p>
        <p className="text-[var(--ink-3)] text-[length:var(--t-fine)] mt-2">
          Deploy one with{" "}
          <code className="text-[var(--ink-2)]"> npx hardhat run scripts/ido/05_deploy_fee_router.ts --network localhost
          </code>
        </p>
      </Card>
    );
  } return (
    <Card title="Payout split">
      <p className="text-[var(--ink-2)] text-[length:var(--t-base)] mb-5">
        Where raised{" "}
        <span className="text-[var(--fjord)] font-bold">{fr.symbol}</span> goes.
        Shares are enforced by the contract and have to total 100%; each recipient withdraws their own.
      </p>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Stat label="Raised" value={fr.format(fr.totalReceived)} symbol={fr.symbol} />
        <Stat label="Distributed" value={fr.format(fr.totalReleased)} symbol={fr.symbol} />
        <Stat label="Unclaimed" value={fr.format(fr.pending)} symbol={fr.symbol} />
      </div>

      {/* Allocation bar */}
      <div className="flex h-2 rounded-full overflow-hidden mb-5 bg-[var(--snow-sunk)]">
        {fr.rows.map((row) => (
          <div key={`${row.recipient}-${row.category}`} className={CATEGORY_COLORS[row.category] ?? "bg-[var(--cat-custom)]"} style={{ width: `${row.bps / 100}%` }} title={`${row.label} — ${row.bps / 100}%`}
          />
        ))}
      </div>

      {/* Split rows */}
      <div className="space-y-3 mb-6">
        {fr.rows.map((row) => (
          <SplitRowView key={`${row.recipient}-${row.category}`} row={row} symbol={fr.symbol} format={fr.format} busy={fr.busy} connected={fr.isConnected} onRelease={() => fr.release(row.recipient)}
          />
        ))}
      </div>

      {/* Deposit */}
      <div className="border-t border-[var(--rule)] pt-5">
        <label className="block text-[length:var(--t-base)] text-[var(--ink-2)] mb-2">
          Route proceeds into the split
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <StyledInput value={fr.depositAmount} onChange={(e) => fr.setDepositAmount(e.target.value)} placeholder={`Amount in ${fr.symbol || "tokens"}`}
          />
          <ActionButton onClick={fr.deposit} disabled={fr.busy || !fr.isConnected || !fr.depositAmount}
          >
            <FaArrowDown /> Deposit
          </ActionButton>
        </div>

        {fr.isOwner && !fr.locked && (
          <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] max-w-md">
              Locking freezes these allocations permanently, so contributors can verify the economics cannot be rewritten. This cannot be undone.
            </p>
            <ActionButton onClick={fr.lock} disabled={fr.busy}>
              <FaLock /> Lock splits
            </ActionButton>
          </div>
        )}

        {fr.locked && (
          <p className="mt-4 text-[length:var(--t-fine)] text-[var(--lichen)] flex items-center gap-2">
            <FaLock /> Splits are locked and permanently immutable.
          </p>
        )}

        {!fr.isConnected && (
          <p className="mt-3 text-[length:var(--t-fine)] text-[var(--ochre)]">
            Connect a wallet to deposit or release.
          </p>
        )}

        {fr.status && (
          <p className="mt-3 text-[length:var(--t-fine)] text-[var(--ink-2)] break-words font-mono">
            {fr.status}
          </p>
        )}
      </div>
    </Card>
  );
}; const Stat = ({ label, value, symbol,
}: { label: string; value: string; symbol: string;
}) => (
  <div className="bg-[var(--sheet)] border border-[var(--rule)] p-3">
    <p className="text-[length:var(--t-fine)] uppercase tracking-wider text-[var(--ink-3)]">{label}</p>
    <p className="text-[length:var(--t-base)] font-bold text-[var(--ink)] break-all">{value}</p>
    <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">{symbol}</p>
  </div>
); const SplitRowView = ({ row, symbol, format, busy, connected, onRelease,
}: { row: SplitRow; symbol: string; format: (v: bigint) => string; busy: boolean; connected: boolean; onRelease: () => void;
}) => (
  <div className="bg-[var(--sheet)] border border-[var(--rule)] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
    <span className={`w-2 h-2 rounded-full shrink-0 ${
        CATEGORY_COLORS[row.category] ?? "bg-[var(--cat-custom)]"
      }`}
    />
    <div className="min-w-0 flex-1">
      <p className="text-[length:var(--t-base)] font-bold text-[var(--ink)]">
        {row.label}{" "}
        <span className="text-[var(--ink-3)] font-normal">{row.bps / 100}%</span>
      </p>
      <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] font-mono">{short(row.recipient)}</p>
    </div>
    <div className="text-left sm:text-right shrink-0">
      <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">claimable</p>
      <p className="text-[length:var(--t-base)] font-bold text-[var(--lichen)] break-all">
        {format(row.releasable)} {symbol}
      </p>
      {row.released > 0n && (
        <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]"> claimed {format(row.released)}
        </p>
      )}
    </div>
    <ActionButton onClick={onRelease} disabled={busy || !connected || row.releasable === 0n}
    >
      <FaCoins /> Release
    </ActionButton>
  </div>
);

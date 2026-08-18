import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { usePublicClient, useChainId } from "wagmi";
import { parseAbiItem, formatUnits } from "viem";
import { Card } from "./Card"; const TRANSFER = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);
const ZERO = "0x0000000000000000000000000000000000000000";
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`; type Holder = { address: string; balance: bigint; share: number };

/**
 * Holders of the public token, reconstructed by replaying Transfer logs.
 *
 * This is the *distributed* token, not the sealed round. Contribution amounts
 * stay private in the eERC layer; once tokens are claimed and trading opens
 * they are an ordinary public ERC20, and its holder set is already visible to
 * anyone reading the chain. Surfacing it here reveals nothing that was private.
 *
 * Replaying logs avoids an indexer, which is fine at this scale and stated
 * rather than hidden.
 */
export const Holders = ({ token, exclude = [],
}: { token: string;
  /** Contract addresses to omit — a curve's inventory is not a holder. */ exclude?: string[];
}) => { const publicClient = usePublicClient(); const chainId = useChainId(); const [holders, setHolders] = useState<Holder[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const load = useCallback(async () => { if (!publicClient || !token) return; setLoading(true); setError(""); try { const logs = await publicClient.getLogs({ address: token as `0x${string}`, event: TRANSFER, fromBlock: 0n,
      }); const balances = new Map<string, bigint>(); for (const l of logs) { const a = (l as unknown as { args: { from: string; to: string; value: bigint } }).args; if (a.from !== ZERO) { balances.set(a.from, (balances.get(a.from) ?? 0n) - a.value);
        } if (a.to !== ZERO) { balances.set(a.to, (balances.get(a.to) ?? 0n) + a.value);
        }
      } const skip = new Set([...exclude, ZERO].map((s) => s.toLowerCase())); const rows = [...balances.entries()]
        .filter(([addr, bal]) => bal > 0n && !skip.has(addr.toLowerCase()))
        .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0)); const circulating = rows.reduce((sum, [, b]) => sum + b, 0n); setHolders( rows.map(([address, balance]) => ({ address, balance, share: circulating > 0n ? Number((balance * 10_000n) / circulating) / 100 : 0,
        })),
      );
    } catch (err) { const e = err as { shortMessage?: string; message?: string }; setError(e.shortMessage ?? e.message ?? String(err));
    } finally { setLoading(false);
    }
  }, [publicClient, token, exclude, chainId]); useEffect(() => { void load();
  }, [load]); return (
    <Card title={`Holders${holders.length ? ` (${holders.length})` : ""}`}>
      <p className="text-[var(--ink-2)] text-[length:var(--t-base)] mb-4">
        Reconstructed from token transfers. This is the distributed token — what each wallet contributed during the sealed round stays private.
      </p>

      {error && <p className="text-[length:var(--t-fine)] text-[var(--falu)] mb-3">{error}</p>}

      {holders.length === 0 ? (
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)]">
          {loading ? "Replaying transfers…" : "No holders yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {holders.slice(0, 20).map((h, i) => (
            <li key={h.address} className="flex items-center gap-3 p-3 border border-[var(--rule)] text-[length:var(--t-fine)]"
            >
              <span className="text-[var(--ink-3)] w-5 shrink-0">{i + 1}</span>
              <Link to={`/u/${h.address}`} className="font-mono text-[var(--ink-2)] hover:text-[var(--ink)] transition-colors"
              >
                {short(h.address)}
              </Link>
              <span className="ml-auto text-[var(--ink)]">
                {Number(formatUnits(h.balance, 18)).toLocaleString()}
              </span>
              <span className="text-[var(--ink-3)] w-14 text-right">{h.share.toFixed(2)}%</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

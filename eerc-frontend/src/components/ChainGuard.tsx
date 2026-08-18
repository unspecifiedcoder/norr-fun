import { useEffect } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useChainId } from "wagmi";
import { avalancheFuji, hardhat } from "wagmi/chains";

/** URL slug -> chain id. Slugs are stable; ids are the wire value. */
export const CHAIN_SLUGS: Record<string, number> = { fuji: avalancheFuji.id, local: hardhat.id,
}; export const slugForChain = (id: number): string =>
  Object.entries(CHAIN_SLUGS).find(([, v]) => v === id)?.[0] ?? String(id);

/**
 * Wraps a chain-scoped route so a shared link carries its network.
 *
 * Without this, a link resolves against whatever chain the recipient's wallet
 * happens to be on, and they silently see the wrong data — or an empty page —
 * with no indication why. Rather than switch their wallet behind their back,
 * this states the mismatch and leaves the choice to them.
 */
export const ChainGuard = ({ children }: { children: React.ReactNode }) => { const { chain } = useParams<{ chain: string }>(); const current = useChainId(); const location = useLocation(); const wanted = chain ? CHAIN_SLUGS[chain.toLowerCase()] : undefined; useEffect(() => { if (chain && wanted === undefined) {
      // Unknown slug: nothing to guard against, fall through to the app.
    }
  }, [chain, wanted]); if (chain && wanted === undefined) { return <Navigate to={location.pathname.replace(`/${chain}`, "")} replace />;
  } if (wanted !== undefined && wanted !== current) { return (
      <div className="border border-dashed border-[var(--ochre)] p-10 text-center">
        <p className="text-[var(--ochre)] font-bold">This link is for another network</p>
        <p className="text-[length:var(--t-base)] text-[var(--ink-2)] mt-2 max-w-md mx-auto">
          It points at <span className="text-[var(--ink)]">{chain}</span>, but your wallet is on chain {current}. Switch networks to open it — nothing here will change your wallet for you.
        </p>
      </div>
    );
  } return <>{children}</>;
};

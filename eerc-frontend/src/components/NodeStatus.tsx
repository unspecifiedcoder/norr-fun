import { useEffect, useState } from "react";
import { useChainId, usePublicClient } from "wagmi";
import { FaExclamationTriangle } from "react-icons/fa";

/**
 * Says so when the chain stops answering.
 *
 * Everything on this surface is read from a node. When that node goes away —
 * the local one was stopped, an RPC is rate-limiting — every figure quietly
 * freezes at its last value and the app looks fine while showing history.
 * That is the worst failure mode a financial interface can have, so it is
 * detected and stated.
 *
 * The probe is the cheapest call there is, and it only escalates to a banner
 * after two consecutive misses so a single dropped packet does not cry wolf.
 */
export const NodeStatus = () => {
  const client = usePublicClient();
  const chainId = useChainId();
  const [misses, setMisses] = useState(0);

  useEffect(() => {
    if (!client) return;
    let alive = true;

    const probe = async () => {
      try {
        // cacheTime: 0 is the whole point. viem caches getBlockNumber for the
        // chain's block time by default, so a cached hit answers instantly
        // without touching the network -- and a probe that never leaves the
        // browser can never notice the node is gone. This was silently true
        // until a node actually died and the banner stayed hidden.
        await client.getBlockNumber({ cacheTime: 0 });
        if (alive) setMisses(0);
      } catch {
        if (alive) setMisses((m) => m + 1);
      }
    };

    void probe();
    const timer = setInterval(probe, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [client]);

  if (misses < 2) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-2.5 px-4 sm:px-6 py-2 border-b text-[length:var(--t-fine)]"
      style={{ background: "var(--falu-wash)", borderColor: "var(--falu-deep)", color: "var(--falu-bright)" }}
    >
      <FaExclamationTriangle className="shrink-0" />
      <span>
        No answer from the node on chain {chainId}. Figures on this page are the
        last ones read and are not updating.
      </span>
      <span className="ml-auto text-[var(--ink-3)] tabular">{misses} failed checks</span>
    </div>
  );
};

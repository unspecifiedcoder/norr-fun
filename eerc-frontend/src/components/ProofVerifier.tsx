import { useMemo, useState } from "react";
import { keccak256, encodePacked, isAddress, getAddress, formatUnits } from "viem";
import { useChainId, useReadContract } from "wagmi";
import { FaCheck, FaTimes, FaShieldAlt, FaLevelDownAlt } from "react-icons/fa";
import { idoAbi } from "../contracts/abis";
import proofData from "../deployments/proofs-31337.json";
import { Panel } from "./ui/Panel";
import { StyledInput } from "./StyledIntput";
import { short } from "./ui/format";

type Entry = { allocationWei: string; proof: string[] };
type Published = { root: string; proofs: Record<string, Entry> };

const PUBLISHED: Record<number, Published> = {
  31337: proofData as Published,
};

/**
 * Verify an allocation without trusting anyone.
 *
 * This is the claim the whole product rests on: after the sealed round, the
 * operator publishes a Merkle root and from that point nobody has to take
 * their arithmetic on faith. Saying that in a pitch is easy. This makes it
 * checkable in the browser, in front of the person asking.
 *
 * Every step is recomputed here rather than read from anywhere:
 *
 *   leaf   = keccak256(abi.encodePacked(address, allocation))
 *   parent = keccak256(sorted(left, right))
 *
 * — the same rules IDO._leaf and IDO._verify use on chain — and the root that
 * falls out is compared against `merkleRoot()` read live from the sale
 * contract. A mismatch is reported as loudly as a match, because a verifier
 * that only ever says yes is decoration.
 */
export const ProofVerifier = ({ ido }: { ido: string }) => {
  const chainId = useChainId();
  const [who, setWho] = useState("");

  const { data: onChainRoot } = useReadContract({
    address: ido as `0x${string}`,
    abi: idoAbi,
    functionName: "merkleRoot",
    query: { enabled: !!ido },
  });

  const published = PUBLISHED[chainId];

  const result = useMemo(() => {
    if (!published || !onChainRoot) return null;
    const input = who.trim();
    if (!input) return null;
    if (!isAddress(input)) return { state: "invalid" as const };

    const key = Object.keys(published.proofs).find(
      (k) => k.toLowerCase() === input.toLowerCase(),
    );
    if (!key) return { state: "absent" as const };

    const entry = published.proofs[key];
    const allocation = BigInt(entry.allocationWei);

    // leaf = keccak256(abi.encodePacked(address, uint256))
    const leaf = keccak256(
      encodePacked(["address", "uint256"], [getAddress(key), allocation]),
    );

    // Walk the proof, hashing sorted pairs, exactly as the contract does.
    const steps: { sibling: string; result: string; order: "leaf-first" | "sibling-first" }[] = [];
    let node = leaf as `0x${string}`;
    for (const sibling of entry.proof) {
      const s = sibling as `0x${string}`;
      const leafFirst = node.toLowerCase() <= s.toLowerCase();
      node = keccak256(
        encodePacked(["bytes32", "bytes32"], leafFirst ? [node, s] : [s, node]),
      );
      steps.push({ sibling: s, result: node, order: leafFirst ? "leaf-first" : "sibling-first" });
    }

    const chainRoot = (onChainRoot as string).toLowerCase();
    return {
      state: node.toLowerCase() === chainRoot ? ("match" as const) : ("mismatch" as const),
      leaf,
      steps,
      computed: node,
      chainRoot,
      allocation,
    };
  }, [who, published, onChainRoot]);

  if (!published) return null;

  return (
    <Panel
      title="Verify an allocation"
      hud
      aside={
        <span className="text-[length:var(--t-fine)] text-[var(--ink-3)] uppercase tracking-[0.12em] hidden sm:block">
          recomputed in this browser
        </span>
      }
    >
      <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mb-3">
        Paste any address. The leaf and every parent hash are recomputed here
        with the same rules the contract uses, and the resulting root is
        compared against the one read live from the sale.
      </p>

      <StyledInput
        value={who}
        onChange={(e) => setWho(e.target.value)}
        placeholder="0x… address to check"
      />

      <dl className="mt-3 text-[length:var(--t-fine)] space-y-1">
        <Row label="Root on chain" value={onChainRoot ? short(onChainRoot as string, 10, 8) : "reading…"} />
        <Row label="Entries published" value={String(Object.keys(published.proofs).length)} />
      </dl>

      {result?.state === "invalid" && (
        <p className="text-[length:var(--t-fine)] text-[var(--ochre)] mt-3">
          That is not a valid address.
        </p>
      )}

      {result?.state === "absent" && (
        <p className="text-[length:var(--t-fine)] text-[var(--ink-3)] mt-3">
          No entry for that address in the published tally. It contributed
          nothing, or it is not part of this raise.
        </p>
      )}

      {(result?.state === "match" || result?.state === "mismatch") && (
        <div className="mt-3">
          <p
            className="flex items-center gap-2 text-[length:var(--t-base)] font-bold"
            style={{ color: result.state === "match" ? "var(--gain)" : "var(--falu)" }}
          >
            {result.state === "match" ? <FaCheck /> : <FaTimes />}
            {result.state === "match"
              ? "Verified against the on-chain root"
              : "Does not match the on-chain root"}
          </p>
          <p className="text-[length:var(--t-fine)] text-[var(--ink-2)] mt-1 tabular">
            allocation {formatUnits(result.allocation, 18)} tokens
          </p>

          {/* The work itself, shown rather than asserted. */}
          <ol className="mt-3 space-y-1.5">
            <li className="text-[length:var(--t-fine)]">
              <span className="label">leaf</span>{" "}
              <span className="text-[var(--ink)] break-all">{result.leaf}</span>
            </li>
            {result.steps.map((s, i) => (
              <li key={i} className="text-[length:var(--t-fine)] flex items-start gap-2">
                <FaLevelDownAlt className="text-[9px] text-[var(--ink-4)] mt-1 shrink-0" />
                <span className="min-w-0">
                  <span className="label">
                    hash {s.order === "leaf-first" ? "node‖sibling" : "sibling‖node"}
                  </span>{" "}
                  <span className="text-[var(--ink-3)] break-all">{short(s.sibling, 10, 8)}</span>
                  <span className="block text-[var(--ink)] break-all">{s.result}</span>
                </span>
              </li>
            ))}
          </ol>

          <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-3 flex items-start gap-2">
            <FaShieldAlt className="mt-0.5 shrink-0" />
            {result.state === "match"
              ? "The operator cannot alter this allocation without changing the root, and the root is already on chain."
              : "The published proof does not reproduce the root the contract holds. Do not claim against it."}
          </p>
        </div>
      )}
    </Panel>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-[var(--ink-3)]">{label}</dt>
    <dd className="text-[var(--ink)] tabular">{value}</dd>
  </div>
);

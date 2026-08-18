import { useMemo } from "react";
import { useChainId, useReadContracts } from "wagmi";
import { promotionAbi } from "../contracts/abis";
import { getRegistry } from "../contracts/config";

/**
 * Which of these raises currently hold a paid feed slot.
 *
 * The feed claims promoted entries are labelled, and a claim like that has to
 * be true on the surface that makes it -- an unlabelled promoted feed is just
 * a feed that sells its ranking quietly.
 *
 * Read as one multicall over the page rather than a hook per card, and the
 * expiry is compared against the clock on every render so a lapsed slot stops
 * being labelled without anything having to invalidate it.
 */
export function usePromoted(subjects: string[]) {
  const chainId = useChainId();
  const contract = getRegistry(chainId)?.promotion as `0x${string}` | undefined;

  const { data } = useReadContracts({
    contracts: contract
      ? subjects.map((s) => ({
          address: contract,
          abi: promotionAbi,
          functionName: "promotedUntil" as const,
          args: [s as `0x${string}`],
        }))
      : [],
    query: { enabled: !!contract && subjects.length > 0 },
  });

  return useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const until = new Map<string, number>();
    subjects.forEach((s, i) => {
      const value = Number((data?.[i]?.result as bigint | undefined) ?? 0n);
      if (value > now) until.set(s.toLowerCase(), value);
    });
    return {
      available: !!contract,
      /** True while the slot is still running. */
      isPromoted: (subject: string) => until.has(subject.toLowerCase()),
      until: (subject: string) => until.get(subject.toLowerCase()),
      count: until.size,
    };
  }, [data, subjects, contract]);
}

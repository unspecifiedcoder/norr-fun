import { useMemo } from "react";
import { useAccount, useChainId, useReadContracts } from "wagmi";
import { socialGraphAbi } from "../contracts/abis";
import { getRegistry } from "../contracts/config";

/**
 * Which of these creators the connected wallet follows.
 *
 * SocialGraph stores follows as a mapping and exposes counts, not a list, so
 * there is no set to enumerate. Asking `follows(me, creator)` once per
 * distinct creator on the page answers the same question in one multicall —
 * and it stays correct as the graph changes, which a cached list would not.
 *
 * Distinct creators, not raises: a creator with six launches is one read.
 */
export function useFollowedCreators(creators: string[]) {
  const chainId = useChainId();
  const { address } = useAccount();
  const social = getRegistry(chainId)?.social as `0x${string}` | undefined;

  const unique = useMemo(
    () => [...new Set(creators.map((c) => c.toLowerCase()))],
    [creators],
  );

  const { data } = useReadContracts({
    contracts:
      social && address
        ? unique.map((creator) => ({
            address: social,
            abi: socialGraphAbi,
            functionName: "follows" as const,
            args: [address, creator as `0x${string}`],
          }))
        : [],
    query: { enabled: !!social && !!address && unique.length > 0 },
  });

  return useMemo(() => {
    const followed = new Set<string>();
    unique.forEach((creator, i) => {
      if (data?.[i]?.result === true) followed.add(creator);
    });
    return {
      available: !!social && !!address,
      count: followed.size,
      isFollowed: (creator: string) => followed.has(creator.toLowerCase()),
    };
  }, [data, unique, social, address]);
}

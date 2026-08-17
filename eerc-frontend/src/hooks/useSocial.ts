import { useCallback, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { socialGraphAbi } from "../contracts/abis";
import { getRegistry } from "../contracts/config";

/**
 * Follows and saved raises for the connected wallet.
 *
 * Both live on chain so they follow the wallet rather than the browser: the
 * same watchlist appears on another device, and a follower count is verifiable
 * instead of asserted by a server.
 */
export function useSocial(target?: { account?: string; subject?: string }) {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const social = getRegistry(chainId)?.social as `0x${string}` | undefined;

  const me = (address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const account = target?.account as `0x${string}` | undefined;
  const subject = target?.subject as `0x${string}` | undefined;

  // Built imperatively: spreading conditional `as const` tuples defeats
  // wagmi's inference and collapses the element type to `never`.
  const calls: {
    address: `0x${string}`;
    abi: typeof socialGraphAbi;
    functionName: string;
    args: readonly `0x${string}`[];
  }[] = [];

  if (social && account) {
    calls.push(
      { address: social, abi: socialGraphAbi, functionName: "followerCount", args: [account] },
      { address: social, abi: socialGraphAbi, functionName: "followingCount", args: [account] },
      { address: social, abi: socialGraphAbi, functionName: "follows", args: [me, account] },
    );
  }
  if (social && subject) {
    calls.push(
      { address: social, abi: socialGraphAbi, functionName: "saved", args: [me, subject] },
      { address: social, abi: socialGraphAbi, functionName: "saveCount", args: [subject] },
    );
  }

  const { data: rawData, refetch } = useReadContracts({
    contracts: calls as never,
    query: { enabled: !!social && (!!account || !!subject) },
  });

  // `contracts` is cast, so the result type is too; read positionally.
  const data = rawData as ({ result?: unknown } | undefined)[] | undefined;
  const offset = account ? 3 : 0;
  const followers = account ? ((data?.[0]?.result as bigint | undefined) ?? 0n) : 0n;
  const following = account ? ((data?.[1]?.result as bigint | undefined) ?? 0n) : 0n;
  const isFollowing = account ? ((data?.[2]?.result as boolean | undefined) ?? false) : false;
  const isSaved = subject ? ((data?.[offset]?.result as boolean | undefined) ?? false) : false;
  const saves = subject ? ((data?.[offset + 1]?.result as bigint | undefined) ?? 0n) : 0n;

  const [busy, setBusy] = useState(false);

  const send = useCallback(
    async (fn: "follow" | "unfollow" | "save" | "unsave", arg: string) => {
      if (!social || !publicClient) return;
      setBusy(true);
      try {
        const hash = await writeContractAsync({
          address: social,
          abi: socialGraphAbi,
          functionName: fn,
          args: [arg as `0x${string}`],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        await refetch();
      } finally {
        setBusy(false);
      }
    },
    [social, publicClient, writeContractAsync, refetch],
  );

  return {
    available: !!social,
    isConnected,
    address,
    followers: Number(followers),
    following: Number(following),
    isFollowing,
    isSaved,
    saves: Number(saves),
    busy,
    /** Following yourself is meaningless, so the control hides rather than errors. */
    canFollow: !!account && isConnected && account.toLowerCase() !== me.toLowerCase(),
    toggleFollow: () => account && send(isFollowing ? "unfollow" : "follow", account),
    toggleSave: () => subject && send(isSaved ? "unsave" : "save", subject),
  };
}

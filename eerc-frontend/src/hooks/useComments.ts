import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { launchCommentsAbi } from "../contracts/abis";
import { getRegistry } from "../contracts/config";
import { useToast } from "../components/toast-context";

export type CommentEntry = {
  author: string;
  postedAt: bigint;
  hidden: boolean;
  body: string;
};

export const MAX_COMMENT_LENGTH = 1000;

/**
 * Discussion on one raise, stored on chain.
 *
 * Authorship is signed rather than asserted, so the UI can attribute a comment
 * without trusting a server. Posting costs gas, which the composer states
 * plainly rather than surprising the reader at signature time.
 */
export function useComments(subject?: string) {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const toast = useToast();
  const registry = getRegistry(chainId);
  const contract = registry?.comments as `0x${string}` | undefined;

  const { data, refetch } = useReadContract({
    address: contract,
    abi: launchCommentsAbi,
    functionName: "page",
    args: [(subject ?? "0x0") as `0x${string}`, 0n, 50n],
    query: { enabled: !!contract && !!subject },
  });

  const [items, total] = (data as [CommentEntry[], bigint] | undefined) ?? [[], 0n];

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const tooLong = draft.length > MAX_COMMENT_LENGTH;
  const canPost = isConnected && draft.trim().length > 0 && !tooLong && !busy;

  /**
   * Post the draft, or an explicit body.
   *
   * The override exists because a reply has to prepend its threading marker
   * *to the text being posted*. Setting draft state and calling post() in the
   * same tick posts the pre-marker draft -- React has not re-rendered, so the
   * closure still holds the old value, and the reply silently lands as a
   * top-level comment. Passing the body through makes that impossible.
   */
  const post = useCallback(async (bodyOverride?: string) => {
    const body = (bodyOverride ?? draft).trim();
    if (!contract || !publicClient || !subject || busy || !isConnected) return;
    if (body.length === 0 || body.length > MAX_COMMENT_LENGTH) return;
    setBusy(true);
    setStatus("");
    try {
      setStatus("Posting…");
      const postId = toast.push({ kind: "pending", title: "Posting comment" });
      const hash = await writeContractAsync({
        address: contract,
        abi: launchCommentsAbi,
        functionName: "post",
        args: [subject as `0x${string}`, body],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      toast.settle(postId, { kind: "done", title: "Comment posted", hash });
      setDraft("");
      setStatus("");
      await refetch();
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string };
      setStatus(`Could not post: ${e.shortMessage ?? e.message ?? String(err)}`);
    } finally {
      setBusy(false);
    }
  }, [contract, publicClient, subject, draft, busy, isConnected, writeContractAsync, refetch]);

  /**
   * Withdraw your own comment. The entry stays in place so later indices keep
   * resolving; only the body is cleared.
   */
  const withdraw = useCallback(
    async (indexFromNewest: number) => {
      if (!contract || !publicClient || !subject) return;
      // page() returns newest-first, so map back to the stored index.
      const storedIndex = Number(total) - 1 - indexFromNewest;
      setBusy(true);
      setStatus("");
      try {
        const hash = await writeContractAsync({
          address: contract,
          abi: launchCommentsAbi,
          functionName: "hide",
          args: [subject as `0x${string}`, BigInt(storedIndex)],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        await refetch();
      } catch (err) {
        const e = err as { shortMessage?: string; message?: string };
        setStatus(`Could not withdraw: ${e.shortMessage ?? e.message ?? String(err)}`);
      } finally {
        setBusy(false);
      }
    },
    [contract, publicClient, subject, total, writeContractAsync, refetch],
  );

  const comments = useMemo(() => items ?? [], [items]);

  return {
    comments,
    total: Number(total),
    available: !!contract,
    address,
    isConnected,
    draft,
    setDraft,
    tooLong,
    canPost,
    post,
    withdraw,
    busy,
    status,
  };
}

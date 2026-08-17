import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { boardRegistryAbi } from "../contracts/abis";
import { getRegistry } from "../contracts/config";

export type Board = {
  id: bigint;
  owner: string;
  slug: string;
  name: string;
  description: string;
  minPartnerBps: number;
  open: boolean;
  createdAt: bigint;
};

/** Boards on the current chain, plus creation. */
export function useBoards() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const registry = getRegistry(chainId);
  const boardsAddress = registry?.boards as `0x${string}` | undefined;

  const { data, refetch } = useReadContract({
    address: boardsAddress,
    abi: boardRegistryAbi,
    functionName: "all",
    query: { enabled: !!boardsAddress },
  });

  const boards: Board[] = useMemo(() => {
    const [items, ids] =
      (data as [Omit<Board, "id">[], bigint[]] | undefined) ?? [[], []];
    return items.map((b, i) => ({
      ...b,
      minPartnerBps: Number(b.minPartnerBps),
      id: ids[i],
    }));
  }, [data]);

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const create = useCallback(
    async (input: {
      slug: string;
      name: string;
      description: string;
      minPartnerPercent: string;
      open: boolean;
    }) => {
      if (!boardsAddress || !publicClient) return false;
      setBusy(true);
      setStatus("");
      try {
        const pct = Number.parseFloat(input.minPartnerPercent || "0");
        const bps = Number.isFinite(pct) ? Math.round(pct * 100) : 0;

        setStatus("Publishing board…");
        const hash = await writeContractAsync({
          address: boardsAddress,
          abi: boardRegistryAbi,
          functionName: "create",
          args: [
            input.slug.trim().toLowerCase(),
            input.name.trim(),
            input.description.trim(),
            bps,
            input.open,
          ],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        setStatus("Board is live.");
        await refetch();
        return true;
      } catch (err) {
        const e = err as { shortMessage?: string; message?: string };
        setStatus(`Could not publish: ${e.shortMessage ?? e.message ?? String(err)}`);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [boardsAddress, publicClient, writeContractAsync, refetch],
  );

  return {
    boards,
    available: !!boardsAddress,
    chainId,
    address,
    isConnected,
    create,
    busy,
    status,
    refetch,
  };
}

/** One board, resolved from its slug as it appears in the URL. */
export function useBoardBySlug(slug?: string) {
  const { boards, available, chainId } = useBoards();
  const board = useMemo(
    () =>
      slug
        ? boards.find((b) => b.slug.toLowerCase() === slug.toLowerCase())
        : undefined,
    [boards, slug],
  );
  return { board, boards, available, chainId, notFound: available && !!slug && !board };
}

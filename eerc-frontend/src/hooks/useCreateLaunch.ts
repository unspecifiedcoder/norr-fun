import { useCallback, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits } from "viem";
import {
  feeRouterAbi,
  idoAbi,
  launchRegistryAbi,
  projectTokenAbi,
} from "../contracts/abis";
import {
  feeRouterBytecode,
  idoBytecode,
  projectTokenBytecode,
} from "../contracts/bytecode";
import { getLaunch, getRegistry } from "../contracts/config";

export const CATEGORIES = [
  "Creator",
  "Partner",
  "Rewards",
  "Marketing",
  "Buyback",
  "Liquidity",
  "Treasury",
  "Custom",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type SplitDraft = {
  id: string;
  recipient: string;
  /** Percent, as typed. Converted to basis points on submit. */
  percent: string;
  category: Category;
  label: string;
};

export type LaunchDraft = {
  name: string;
  symbol: string;
  supply: string;
  description: string;
  splits: SplitDraft[];
};

export type DeployStep = {
  key: string;
  label: string;
  status: "pending" | "active" | "done" | "failed";
  detail?: string;
};

const BPS_TOTAL = 10_000;

let nextId = 0;
export const blankSplit = (category: Category = "Creator"): SplitDraft => ({
  id: `s${nextId++}`,
  recipient: "",
  percent: "",
  category,
  label: "",
});

/**
 * Deploys a complete launch from the browser: project token, fee router, IDO,
 * then an entry in the registry so the launch shows up in the feed.
 *
 * Four sequential transactions rather than a factory contract. A factory would
 * make this one signature, but it also fixes the launch shape in bytecode; while
 * the shape is still moving, deploying the pieces keeps it changeable without a
 * redeploy of shared infrastructure.
 */
export function useCreateLaunch() {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const registry = getRegistry(chainId);
  const existing = getLaunch(chainId);

  const [draft, setDraft] = useState<LaunchDraft>({
    name: "",
    symbol: "",
    supply: "1000000",
    description: "",
    splits: [blankSplit("Creator")],
  });

  const [steps, setSteps] = useState<DeployStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deployed, setDeployed] = useState<{
    projectToken: string;
    feeRouter: string;
    ido: string;
  } | null>(null);

  const update = useCallback(
    <K extends keyof LaunchDraft>(key: K, value: LaunchDraft[K]) =>
      setDraft((d) => ({ ...d, [key]: value })),
    [],
  );

  const setSplit = useCallback((id: string, patch: Partial<SplitDraft>) => {
    setDraft((d) => ({
      ...d,
      splits: d.splits.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }, []);

  const addSplit = useCallback(() => {
    setDraft((d) => ({ ...d, splits: [...d.splits, blankSplit("Partner")] }));
  }, []);

  const removeSplit = useCallback((id: string) => {
    setDraft((d) => ({
      ...d,
      splits: d.splits.length > 1 ? d.splits.filter((s) => s.id !== id) : d.splits,
    }));
  }, []);

  /** Percent strings -> integer basis points, tolerating blanks. */
  const totalBps = useMemo(
    () =>
      draft.splits.reduce((sum, s) => {
        const pct = Number.parseFloat(s.percent);
        return sum + (Number.isFinite(pct) ? Math.round(pct * 100) : 0);
      }, 0),
    [draft.splits],
  );

  const isAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v.trim());

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!draft.name.trim()) list.push("name");
    if (!draft.symbol.trim()) list.push("symbol");
    if (!(Number(draft.supply) > 0)) list.push("supply");
    if (draft.splits.some((s) => !isAddress(s.recipient))) list.push("recipient address");
    if (draft.splits.some((s) => !s.label.trim())) list.push("allocation label");
    if (totalBps !== BPS_TOTAL) list.push("allocations totalling 100%");
    if (!registry) list.push("a registry on this network");
    if (!existing) list.push("a contribution asset on this network");
    return list;
  }, [draft, totalBps, registry, existing]);

  const ready = problems.length === 0 && isConnected;

  const mark = (key: string, patch: Partial<DeployStep>) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const deploy = useCallback(async () => {
    if (!ready || !walletClient || !publicClient || !registry || !existing || !address) return;

    setBusy(true);
    setError("");
    setDeployed(null);

    const initial: DeployStep[] = [
      { key: "token", label: "Deploy project token", status: "pending" },
      { key: "router", label: "Deploy fee router", status: "pending" },
      { key: "ido", label: "Deploy sale contract", status: "pending" },
      { key: "register", label: "Publish to the feed", status: "pending" },
    ];
    setSteps(initial);

    const deployOne = async (
      key: string,
      abi: readonly unknown[],
      bytecode: `0x${string}`,
      args: readonly unknown[],
    ) => {
      mark(key, { status: "active" });
      const hash = await walletClient.deployContract({
        abi: abi as never,
        bytecode,
        args: args as never,
        account: address as `0x${string}`,
        chain: walletClient.chain,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (!receipt.contractAddress) throw new Error(`${key}: no contract address in receipt`);
      mark(key, { status: "done", detail: receipt.contractAddress });
      return receipt.contractAddress;
    };

    try {
      const supply = parseUnits(draft.supply, 18);

      const projectToken = await deployOne("token", projectTokenAbi, projectTokenBytecode, [
        supply,
      ]);

      const splitStructs = draft.splits.map((s) => ({
        recipient: s.recipient.trim() as `0x${string}`,
        bps: BigInt(Math.round(Number.parseFloat(s.percent) * 100)),
        category: BigInt(CATEGORIES.indexOf(s.category)),
        label: s.label.trim(),
      }));

      const feeRouter = await deployOne("router", feeRouterAbi, feeRouterBytecode, [
        existing.contributionAsset as `0x${string}`,
        address as `0x${string}`,
        splitStructs,
      ]);

      // Open immediately with no end time, so the claim path is reachable as
      // soon as a tally is published.
      const startsAt = BigInt(Math.floor(Date.now() / 1000));
      const ido = await deployOne("ido", idoAbi, idoBytecode, [
        projectToken,
        feeRouter,
        startsAt,
        0n,
      ]);

      mark("register", { status: "active" });
      const regHash = await walletClient.writeContract({
        address: registry.address as `0x${string}`,
        abi: launchRegistryAbi,
        functionName: "register",
        args: [
          projectToken,
          ido,
          feeRouter,
          existing.contributionAsset as `0x${string}`,
          draft.name.trim(),
          draft.symbol.trim(),
          draft.description.trim(),
        ],
        account: address as `0x${string}`,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: regHash });
      mark("register", { status: "done" });

      setDeployed({ projectToken, feeRouter, ido });
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string };
      setError(e.shortMessage ?? e.message ?? String(err));
      setSteps((prev) => {
        const i = prev.findIndex((s) => s.status === "active");
        return i === -1 ? prev : prev.map((s, n) => (n === i ? { ...s, status: "failed" } : s));
      });
    } finally {
      setBusy(false);
    }
  }, [ready, walletClient, publicClient, registry, existing, address, draft]);

  return {
    draft,
    update,
    setSplit,
    addSplit,
    removeSplit,
    totalBps,
    problems,
    ready,
    deploy,
    steps,
    busy,
    error,
    deployed,
    isConnected,
    chainId,
    contributionAsset: existing?.contributionAsset,
    hasRegistry: !!registry,
  };
}

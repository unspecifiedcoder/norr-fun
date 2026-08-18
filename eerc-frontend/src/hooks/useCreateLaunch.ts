import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  /** Image URL for the launch. Supplied by the creator; nothing is hosted here. */
  logoURI: string;
  /** Publisher desk to publish under; 0n for none. */
  boardId: bigint;
  splits: SplitDraft[];
};

export type DeployStep = {
  key: string;
  label: string;
  status: "pending" | "active" | "done" | "failed";
  detail?: string;
};

const BPS_TOTAL = 10_000;

/**
 * Turn a revert into something a person can act on.
 *
 * viem reports a nested custom error as a bare "function reverted", which is
 * useless after three successful signatures -- the reader needs to know which
 * rule they broke and what to change.
 */
const REVERT_HELP: Record<string, string> = {
  BoardShareTooLow:
    "That desk requires a larger share than your split gives it. Raise the desk's allocation and deploy again — the contracts already deployed are reusable.",
  NotAllowedOnBoard:
    "That desk is invite-only and this wallet is not its operator. Pick another desk, or publish on your own.",
  UnknownBoard: "That desk no longer exists on this network.",
  AlreadyRegistered: "This sale contract is already published.",
  BpsMustTotalDenominator: "Allocations must total exactly 100%.",
};

const explain = (err: unknown): string => {
  const raw = JSON.stringify(
    err,
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
  );
  for (const [name, help] of Object.entries(REVERT_HELP)) {
    if (raw.includes(name)) return help;
  }
  const e = err as { shortMessage?: string; message?: string };
  return e.shortMessage ?? e.message ?? String(err);
};

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

  /**
   * The draft survives a reload.
   *
   * Filling this form is several minutes of work -- a name, a supply, a split
   * across several wallets -- and losing it to a refresh, a wallet prompt that
   * navigates away, or a mistyped URL is the kind of small disaster that ends
   * a demo. Held per chain, since a draft's desk and asset only make sense on
   * the network it was written for, and cleared once the raise is deployed.
   *
   * bigint does not survive JSON, so boardId is stored as a string and read
   * back deliberately rather than by a reviver that would have to guess.
   */
  const draftKey = `norr.launch.draft.${chainId}`;

  const [draft, setDraft] = useState<LaunchDraft>(() => {
    const blank: LaunchDraft = {
      name: "",
      symbol: "",
      supply: "1000000",
      description: "",
      logoURI: "",
      boardId: 0n,
      splits: [blankSplit("Creator")],
    };
    if (typeof window === "undefined") return blank;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (!raw) return blank;
      const saved = JSON.parse(raw) as Omit<LaunchDraft, "boardId"> & { boardId: string };
      return {
        ...blank,
        ...saved,
        boardId: BigInt(saved.boardId ?? "0"),
        splits: saved.splits?.length ? saved.splits : blank.splits,
      };
    } catch {
      return blank;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({ ...draft, boardId: draft.boardId.toString() }),
      );
    } catch {
      // A full or blocked store is not worth interrupting the form for.
    }
  }, [draft, draftKey]);

  /**
   * Contracts already deployed by a run that failed later.
   *
   * A four-transaction deploy that fails on the fourth has still spent real
   * gas on the first three, and the revert message already told the creator
   * they were reusable — while nothing actually reused them, so the next
   * attempt silently paid for all four again.
   *
   * Held per chain and cleared once a raise is published or the draft's shape
   * changes in a way that would invalidate them: the token is bound to a
   * supply and the router to a split, so reusing either after those change
   * would deploy a raise that does not match the form.
   */
  const partialKey = `norr.launch.partial.${chainId}`;

  const [partial, setPartial] = useState<Partial<Record<"token" | "router" | "ido", string>>>(() => {
    try {
      return JSON.parse(window.localStorage.getItem(partialKey) ?? "{}");
    } catch {
      return {};
    }
  });

  const rememberPartial = useCallback(
    (next: Partial<Record<"token" | "router" | "ido", string>>) => {
      setPartial(next);
      try {
        if (Object.keys(next).length) {
          window.localStorage.setItem(partialKey, JSON.stringify(next));
        } else {
          window.localStorage.removeItem(partialKey);
        }
      } catch {
        /* without storage a retry simply redeploys, as it did before */
      }
    },
    [partialKey],
  );

  /**
   * Each contract is invalidated by the thing it actually encodes.
   *
   * The token is bound to the supply, the router to the split, and the sale
   * references both by address — so the sale falls with either. Discarding
   * all three whenever anything changed was the safe version of this and also
   * the useless one: the common case is a deploy rejected by a desk's terms,
   * where the fix is the split and the token is still perfectly good.
   */
  const supplyShape = draft.supply;
  const splitShape = draft.splits
    .map((sp) => `${sp.recipient}:${sp.percent}:${sp.category}:${sp.label}`)
    .join(",");
  const lastSupply = useRef(supplyShape);
  const lastSplit = useRef(splitShape);

  useEffect(() => {
    const supplyChanged = lastSupply.current !== supplyShape;
    const splitChanged = lastSplit.current !== splitShape;
    lastSupply.current = supplyShape;
    lastSplit.current = splitShape;
    if (!supplyChanged && !splitChanged) return;
    if (!Object.keys(partial).length) return;

    const next = { ...partial };
    if (supplyChanged) delete next.token;
    if (splitChanged) delete next.router;
    // The sale contract is constructed against the other two.
    if (supplyChanged || splitChanged) delete next.ido;
    rememberPartial(next);
  }, [supplyShape, splitShape, partial, rememberPartial]);

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

    // Reused within one run, so the addresses survive a mid-run failure.
    const reused: Partial<Record<"token" | "router" | "ido", string>> = { ...partial };

    const deployOne = async (
      key: "token" | "router" | "ido",
      abi: readonly unknown[],
      bytecode: `0x${string}`,
      args: readonly unknown[],
    ) => {
      const already = reused[key];
      if (already) {
        mark(key, { status: "done", detail: `${already} (reused)` });
        return already as `0x${string}`;
      }
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
      reused[key] = receipt.contractAddress;
      rememberPartial({ ...reused });
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
          draft.boardId,
          {
            name: draft.name.trim(),
            symbol: draft.symbol.trim(),
            description: draft.description.trim(),
            logoURI: draft.logoURI.trim(),
          },
        ],
        account: address as `0x${string}`,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: regHash });
      mark("register", { status: "done" });

      setDeployed({ projectToken, feeRouter, ido });
      // Shipped: the draft has become a raise, and the partial contracts are
      // no longer partial.
      rememberPartial({});
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* nothing to clean up */
      }
    } catch (err) {
      setError(explain(err));
      setSteps((prev) => {
        const i = prev.findIndex((s) => s.status === "active");
        return i === -1 ? prev : prev.map((s, n) => (n === i ? { ...s, status: "failed" } : s));
      });
    } finally {
      setBusy(false);
    }
  }, [ready, walletClient, publicClient, registry, existing, address, draft, draftKey, partial, rememberPartial]);

  return {
    /** Contracts a previous failed attempt already paid for. */
    resumable: partial,
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

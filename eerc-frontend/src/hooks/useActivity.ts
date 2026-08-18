import { useCallback, useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { parseAbiItem, formatUnits, type Log } from "viem";
import { getRegistry } from "../contracts/config";
import { useRegistryFeed } from "./useRegistryFeed";

export type ActivityItem = {
  kind: "released" | "deposited" | "claimed" | "comment" | "followed" | "registered";
  blockNumber: bigint;
  txHash: string;
  /** Human-readable summary, built from decoded event args. */
  summary: string;
  /** Route to the thing this concerns, when there is one. */
  href?: string;
};

// Declared locally rather than pulled from the full ABIs: getLogs wants a
// single event item, and naming them here documents exactly what is watched.
const EVENTS = {
  released: parseAbiItem("event Released(address indexed recipient, uint256 amount)"),
  deposited: parseAbiItem("event Deposited(address indexed from, uint256 amount, uint256 totalReceived)"),
  claimed: parseAbiItem("event Claimed(address indexed account, uint256 amount)"),
  posted: parseAbiItem("event Posted(address indexed subject, uint256 indexed index, address indexed author)"),
  followed: parseAbiItem("event Followed(address indexed follower, address indexed target)"),
  registered: parseAbiItem("event LaunchRegistered(uint256 indexed id, address indexed creator, address indexed ido, address projectToken, address feeRouter)"),
};

/**
 * Recent protocol activity involving one address, read from contract logs.
 *
 * No indexer and no server: the protocol's own contracts emit everything
 * needed, and a client can scope `getLogs` to a single address. That holds
 * while log volume is small; a busy deployment would want an indexer, and
 * this is the honest version of the feature until then.
 */
export function useActivity(scopeToSelf = true) {
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const registry = getRegistry(chainId);
  const feed = useRegistryFeed("newest", 100);

  /**
   * One scan, shared.
   *
   * This used to be `useState` + `useEffect` per consumer, which meant the
   * notification badge in the shell and the activity page each ran their own
   * multi-contract log scan on every route. They raced, and the badge lost --
   * it reported zero while the page listed seven entries, which is worse than
   * having no badge at all.
   *
   * Held in the query cache instead, keyed by what actually changes the
   * result, so both read the same array and the count cannot disagree with
   * the list it counts.
   */
  const load = useCallback(async (): Promise<ActivityItem[]> => {
    if (!publicClient || !registry) return [];
    {
      const routers = feed.rows.map((r) => r.launch.feeRouter as `0x${string}`);
      const sales = feed.rows.map((r) => r.launch.ido as `0x${string}`);
      const nameOf = (addr: string) =>
        feed.rows.find(
          (r) =>
            r.launch.feeRouter.toLowerCase() === addr.toLowerCase() ||
            r.launch.ido.toLowerCase() === addr.toLowerCase(),
        )?.launch.name ?? "a raise";
      const saleFor = (routerOrSale: string) =>
        feed.rows.find(
          (r) =>
            r.launch.feeRouter.toLowerCase() === routerOrSale.toLowerCase() ||
            r.launch.ido.toLowerCase() === routerOrSale.toLowerCase(),
        )?.launch.ido;

      const me = address as `0x${string}` | undefined;
      const collected: ActivityItem[] = [];

      const push = (
        logs: Log[],
        kind: ActivityItem["kind"],
        summarise: (l: never) => string,
      ) => {
        for (const l of logs) {
          collected.push({
            kind,
            blockNumber: l.blockNumber ?? 0n,
            txHash: l.transactionHash ?? "",
            summary: summarise(l as never),
            href: l.address ? (saleFor(l.address) ? `/raise/${saleFor(l.address)}` : undefined) : undefined,
          });
        }
      };

      const fmt = (v: bigint) => Number(formatUnits(v, 18)).toLocaleString();

      if (routers.length > 0) {
        const [releases, deposits] = await Promise.all([
          publicClient.getLogs({
            address: routers,
            event: EVENTS.released,
            args: scopeToSelf && me ? { recipient: me } : undefined,
            fromBlock: 0n,
          }),
          publicClient.getLogs({
            address: routers,
            event: EVENTS.deposited,
            args: scopeToSelf && me ? { from: me } : undefined,
            fromBlock: 0n,
          }),
        ]);

        push(releases, "released", (l: { address: string; args: { amount: bigint } }) =>
          `Collected ${fmt(l.args.amount)} from ${nameOf(l.address)}`);
        push(deposits, "deposited", (l: { address: string; args: { amount: bigint } }) =>
          `Routed ${fmt(l.args.amount)} into ${nameOf(l.address)}`);
      }

      if (sales.length > 0) {
        const claims = await publicClient.getLogs({
          address: sales,
          event: EVENTS.claimed,
          args: scopeToSelf && me ? { account: me } : undefined,
          fromBlock: 0n,
        });
        push(claims, "claimed", (l: { address: string; args: { amount: bigint } }) =>
          `Claimed ${fmt(l.args.amount)} tokens from ${nameOf(l.address)}`);
      }

      if (registry.comments) {
        const posts = await publicClient.getLogs({
          address: registry.comments as `0x${string}`,
          event: EVENTS.posted,
          args: scopeToSelf && me ? { author: me } : undefined,
          fromBlock: 0n,
        });
        for (const l of posts) {
          const a = (l as unknown as { args: { subject: string } }).args;
          collected.push({
            kind: "comment",
            blockNumber: l.blockNumber ?? 0n,
            txHash: l.transactionHash ?? "",
            summary: `Commented on ${nameOf(a.subject)}`,
            href: `/raise/${a.subject}`,
          });
        }
      }

      if (registry.social) {
        const follows = await publicClient.getLogs({
          address: registry.social as `0x${string}`,
          event: EVENTS.followed,
          args: scopeToSelf && me ? { follower: me } : undefined,
          fromBlock: 0n,
        });
        for (const l of follows) {
          const a = (l as unknown as { args: { target: string } }).args;
          collected.push({
            kind: "followed",
            blockNumber: l.blockNumber ?? 0n,
            txHash: l.transactionHash ?? "",
            summary: `Followed ${a.target.slice(0, 6)}…${a.target.slice(-4)}`,
            href: `/u/${a.target}`,
          });
        }
      }

      const regs = await publicClient.getLogs({
        address: registry.address as `0x${string}`,
        event: EVENTS.registered,
        args: scopeToSelf && me ? { creator: me } : undefined,
        fromBlock: 0n,
      });
      for (const l of regs) {
        const a = (l as unknown as { args: { ido: string } }).args;
        collected.push({
          kind: "registered",
          blockNumber: l.blockNumber ?? 0n,
          txHash: l.transactionHash ?? "",
          summary: `Started ${nameOf(a.ido)}`,
          href: `/raise/${a.ido}`,
        });
      }

      collected.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : b.blockNumber < a.blockNumber ? -1 : 0));
      return collected;
    }
  }, [publicClient, registry, feed.rows, address, scopeToSelf]);

  /**
   * One scan per scope, shared by every consumer.
   *
   * The shell's notification badge and the activity page both read this. When
   * each ran its own scan they raced and disagreed -- the badge reported zero
   * beside a page listing thirteen entries.
   *
   * Deliberately a small module-level cache rather than react-query: this
   * project resolves two copies of that library (its own and the one inside
   * the wallet stack), and a hook bound to the wrong copy throws
   * `observer.getOptimisticResult is not a function` from the shell, taking
   * the whole app down. Twenty lines here cannot pick the wrong instance.
   *
   * The key is what identifies the answer -- chain, scope, address -- and
   * never how many raises happened to be loaded when a consumer mounted.
   * Including that count previously let a scan over zero raises win the cache.
   */
  const key = `${chainId}:${scopeToSelf ? (address ?? "none") : "all"}`;
  const ready = !!publicClient && !!registry && !feed.isLoading;

  const [snapshot, setSnapshot] = useState<Snapshot>(() => read(key));

  useEffect(() => {
    const unsubscribe = subscribe(key, setSnapshot);
    if (ready) void ensure(key, load);
    return unsubscribe;
  }, [key, ready, load]);

  return {
    items: snapshot.items,
    loading: snapshot.loading,
    error: snapshot.error,
    isConnected,
    hasRegistry: !!registry,
    chainId,
    reload: () => refresh(key, load),
  };
}

/* ------------------------------------------------------------------ cache */

type Snapshot = { items: ActivityItem[]; loading: boolean; error: string };

const EMPTY: Snapshot = { items: [], loading: false, error: "" };

const store = new Map<string, Snapshot>();
const listeners = new Map<string, Set<(s: Snapshot) => void>>();
const inflight = new Map<string, Promise<void>>();

const read = (key: string): Snapshot => store.get(key) ?? EMPTY;

const publish = (key: string, next: Snapshot) => {
  store.set(key, next);
  listeners.get(key)?.forEach((fn) => fn(next));
};

const subscribe = (key: string, fn: (s: Snapshot) => void) => {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  fn(read(key));
  return () => {
    listeners.get(key)?.delete(fn);
  };
};

const run = async (key: string, load: () => Promise<ActivityItem[]>) => {
  publish(key, { ...read(key), loading: true, error: "" });
  try {
    publish(key, { items: await load(), loading: false, error: "" });
  } catch (err) {
    const e = err as { shortMessage?: string; message?: string };
    publish(key, {
      ...read(key),
      loading: false,
      error: e.shortMessage ?? e.message ?? String(err),
    });
  } finally {
    inflight.delete(key);
  }
};

/** Scan once per key; concurrent mounts join the scan already running. */
const ensure = (key: string, load: () => Promise<ActivityItem[]>) => {
  if (store.has(key) || inflight.has(key)) return inflight.get(key);
  const p = run(key, load);
  inflight.set(key, p);
  return p;
};

const refresh = (key: string, load: () => Promise<ActivityItem[]>) => {
  if (inflight.has(key)) return inflight.get(key);
  const p = run(key, load);
  inflight.set(key, p);
  return p;
};

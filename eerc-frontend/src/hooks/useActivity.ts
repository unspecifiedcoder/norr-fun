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

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!publicClient || !registry) return;
    setLoading(true);
    setError("");
    try {
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
      setItems(collected);
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string };
      setError(e.shortMessage ?? e.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }, [publicClient, registry, feed.rows, address, scopeToSelf]);

  useEffect(() => {
    if (feed.rows.length > 0 || registry) void load();
    // load() already closes over everything it needs.
  }, [load, feed.rows.length, registry]);

  return { items, loading, error, isConnected, hasRegistry: !!registry, chainId, reload: load };
}

/**
 * Opt-in local development wallet, active only with `?devwallet=1` in dev builds.
 *
 * This is a real EIP-1193 provider: every request is forwarded verbatim to the
 * local Hardhat JSON-RPC endpoint, and transactions are signed by the node using
 * its unlocked accounts. Nothing about contract behaviour is simulated -- it
 * exists purely so a browser session can exercise the app against a local chain
 * without a browser extension installed.
 *
 * It is a no-op in production builds and when the flag is absent.
 */

const DEFAULT_RPC = "http://127.0.0.1:8545";

type RequestArgs = { method: string; params?: unknown[] };

const createDevWallet = (rpcUrl: string) => {
  let requestId = 0;
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  let accounts: string[] = [];
  let chainId = "0x7a69"; // 31337

  const rpc = async (method: string, params: unknown[] = []): Promise<unknown> => {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    });
    if (!response.ok) {
      throw new Error(`RPC ${method} failed: HTTP ${response.status}`);
    }
    const json = await response.json();
    if (json.error) {
      // Surface the node's revert reason with the shape viem expects.
      const err = new Error(json.error.message ?? `RPC ${method} failed`) as Error & {
        code?: number;
        data?: unknown;
      };
      err.code = json.error.code;
      err.data = json.error.data;
      throw err;
    }
    return json.result;
  };

  const provider = {
    isDevWallet: true,
    isMetaMask: true, // some connectors gate features on this flag

    async request({ method, params = [] }: RequestArgs): Promise<unknown> {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts": {
          if (accounts.length === 0) {
            accounts = (await rpc("eth_accounts")) as string[];
          }
          return accounts;
        }
        case "eth_chainId": {
          chainId = (await rpc("eth_chainId")) as string;
          return chainId;
        }
        case "wallet_switchEthereumChain":
          // Single-chain provider; the node is already the requested chain.
          return null;
        case "wallet_requestPermissions":
          return [{ parentCapability: "eth_accounts" }];
        default:
          return rpc(method, params as unknown[]);
      }
    },

    on(event: string, handler: (...args: unknown[]) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
      return provider;
    },

    removeListener(event: string, handler: (...args: unknown[]) => void) {
      listeners.get(event)?.delete(handler);
      return provider;
    },
  };

  return provider;
};

export const installDevWallet = () => {
  if (!import.meta.env.DEV) return;
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  if (params.get("devwallet") !== "1") return;

  const rpcUrl = params.get("rpc") ?? DEFAULT_RPC;
  const provider = createDevWallet(rpcUrl);

  Object.defineProperty(window, "ethereum", {
    value: provider,
    writable: true,
    configurable: true,
  });

  // Announce over EIP-6963 as well, which is how modern connectors discover
  // wallets. Re-announce on request since listeners may attach after load.
  const detail = Object.freeze({
    info: {
      uuid: "0f2d1c4e-6b9a-4c7d-9e3f-devwallet00001",
      name: "Local Dev Node",
      icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiLz4=",
      rdns: "fun.norr.devwallet",
    },
    provider,
  });

  const announce = () =>
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));

  window.addEventListener("eip6963:requestProvider", announce);
  announce();

  console.info(`[dev-wallet] active, forwarding to ${rpcUrl}`);
};

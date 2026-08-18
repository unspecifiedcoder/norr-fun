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

const isHex = (v: unknown): v is string =>
  typeof v === "string" && /^0x[0-9a-fA-F]*$/.test(v);

/**
 * Hex-encode a personal_sign payload.
 *
 * Hardhat's `personal_sign` rejects a non-hex message outright -- "expected a
 * valid hex string" -- while viem passes a plain string straight through for
 * a string message. Every signature-derived flow in this app therefore failed
 * under the dev wallet while working fine against a real extension, which is
 * the worst kind of difference for a development tool to have. Encoding here
 * makes the two behave the same.
 */
const toHexMessage = (value: unknown): string => {
  if (isHex(value)) return value;
  const text = typeof value === "string" ? value : String(value);
  let out = "0x";
  for (const byte of new TextEncoder().encode(text)) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
};

const createDevWallet = (rpcUrl: string, accountIndex: number) => {
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
            const all = (await rpc("eth_accounts")) as string[];
            // Connectors take the first entry as the active account, so rotate
            // the requested index to the front rather than filtering the rest
            // out -- the others stay available for signing.
            const i = Math.min(Math.max(accountIndex, 0), all.length - 1);
            accounts = [all[i], ...all.filter((_, idx) => idx !== i)];
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
        case "personal_sign": {
          // EIP-191 order is [data, address]; the node needs data as hex.
          const [data, account] = params as [unknown, unknown];
          return rpc("personal_sign", [toHexMessage(data), account]);
        }
        case "eth_sign": {
          // The legacy order is the other way round: [address, data].
          const [account, data] = params as [unknown, unknown];
          return rpc("eth_sign", [account, toHexMessage(data)]);
        }
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
  // ?account=N picks which unlocked node account to connect as, so different
  // roles (deployer, contributor) can be exercised without a second browser.
  const accountIndex = Number.parseInt(params.get("account") ?? "0", 10) || 0;
  const provider = createDevWallet(rpcUrl, accountIndex);

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

  console.info(
    `[dev-wallet] active, forwarding to ${rpcUrl} as account #${accountIndex}`,
  );
};

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount, useChainId, usePublicClient, useReadContract, useReadContracts,
  useWalletClient, useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { useEERC as useEERCSDK } from "@avalabs/eerc-sdk";
import { erc20Abi } from "../contracts/abis";
import { getEerc } from "../contracts/config";

/**
 * The sealed-balance layer.
 *
 * This is the mechanism the whole product rests on, and it has a real
 * lifecycle that the interface has to walk a person through rather than
 * assume: derive a decryption key from a signature, register the resulting
 * public key on-chain, convert public tokens into encrypted ones, and only
 * then move value without publishing the amount.
 *
 * Three things this hook insists on:
 *
 * - **The contract address comes from a deployment artifact.** It used to be a
 *   blank text field. A privacy layer nobody can find the address of is a
 *   privacy layer nobody uses.
 * - **Every step reports pending and failed.** These operations generate a
 *   zero-knowledge proof in the browser and can take tens of seconds; a
 *   control that looks idle while proving invites a second click, and a
 *   failure that only reaches `console.error` is a failure the user never
 *   learns about.
 * - **The decryption key is held locally, per wallet and per contract.**
 *   It is derived deterministically from a signature, so it can always be
 *   regenerated — but keeping it means a reload does not force a fresh
 *   signature prompt just to read your own balance.
 */

const CIRCUITS = {
  register: { wasm: "/circuits/register.wasm", zkey: "/circuits/register.zkey" },
  transfer: { wasm: "/circuits/transfer.wasm", zkey: "/circuits/transfer.zkey" },
  mint: { wasm: "/circuits/mint.wasm", zkey: "/circuits/mint.zkey" },
  withdraw: { wasm: "/circuits/withdraw.wasm", zkey: "/circuits/withdraw.zkey" },
  burn: { wasm: "/circuits/burn.wasm", zkey: "/circuits/burn.zkey" },
};

const keyStore = (chainId: number, contract: string, account: string) =>
  `norr.eerc.key.${chainId}.${contract.toLowerCase()}.${account.toLowerCase()}`;

const readKey = (chainId: number, contract?: string, account?: string) => {
  if (!contract || !account || typeof window === "undefined") return undefined;
  return window.localStorage.getItem(keyStore(chainId, contract, account)) ?? undefined;
};

/** Turn a revert or a proof failure into something a person can act on. */
const explain = (err: unknown): string => {
  const e = err as { shortMessage?: string; message?: string };
  const raw = e?.shortMessage ?? e?.message ?? String(err);
  if (/user rejected|denied/i.test(raw)) return "Signature rejected in the wallet.";
  if (/Auditor public key not set/i.test(raw)) {
    return "This deployment has no auditor key set yet. Deposits revert until one is.";
  }
  if (/not registered/i.test(raw)) return "This address is not registered on the encrypted token yet.";
  return raw;
};

export type EercStep = "register" | "key" | "deposit" | "transfer" | "withdraw" | null;

export function useEERC() {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const deployment = getEerc(chainId);
  const contract = deployment?.encryptedERC;

  const [storedKey, setStoredKey] = useState<string | undefined>(() =>
    readKey(chainId, contract, address),
  );

  // A key belongs to one wallet on one contract; switching either must not
  // carry the previous account's key into the new session.
  useEffect(() => {
    setStoredKey(readKey(chainId, contract, address));
  }, [chainId, contract, address]);

  const eerc = useEERCSDK(
    publicClient!,
    walletClient!,
    (contract ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    CIRCUITS,
    storedKey,
  );

  /**
   * A converter deployment wraps one specific ERC20, so the balance hook has
   * to be told which. Calling it bare leaves the SDK with no token address and
   * every deposit fails with "Token address is not set" -- after the proof has
   * already been generated, which is a slow way to learn about a missing
   * argument.
   */
  const balance = eerc.useEncryptedBalance(
    deployment?.isConverter ? (deployment.erc20 as `0x${string}`) : undefined,
  );

  const [busy, setBusy] = useState<EercStep>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  /**
   * How long the last proof actually took.
   *
   * These operations spend twenty to sixty seconds generating a zero-knowledge
   * proof in the browser. Without a number attached, that silence reads as a
   * hang; with one, it reads as work — and it is the most concrete evidence
   * on the surface that real cryptography is running rather than a mock.
   */
  const [lastProofMs, setLastProofMs] = useState<number | null>(null);

  /**
   * The convertible token, read from the chain rather than the artifact.
   *
   * The deployment file records the *encrypted* token's decimals, which are
   * not the ERC20's -- reading them from the artifact scaled every deposit by
   * the wrong power of ten. Everything else in this app reads its figures from
   * contracts for exactly this reason.
   */
  const token = deployment?.erc20 as `0x${string}` | undefined;

  const { data: tokenMeta } = useReadContracts({
    contracts: token
      ? [
          { address: token, abi: erc20Abi, functionName: "decimals" as const },
          { address: token, abi: erc20Abi, functionName: "symbol" as const },
        ]
      : [],
    query: { enabled: !!token },
  });

  const { data: publicBalance, refetch: refetchPublic } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [(address ?? "0x0000000000000000000000000000000000000000") as `0x${string}`],
    query: { enabled: !!token && !!address },
  });

  const tokenDecimals = (tokenMeta?.[0]?.result as number | undefined) ?? 18;
  const tokenSymbol = (tokenMeta?.[1]?.result as string | undefined) ?? deployment?.symbol ?? "";

  /**
   * The two sides of a converter keep different precision, and which one an
   * amount belongs to depends on the operation.
   *
   * A deposit is denominated in the public ERC20 (eighteen places here); a
   * transfer or a withdrawal is denominated in the encrypted token (two).
   * Scaling a transfer by the ERC20's decimals asks to move a hundred
   * thousand billion base units and the contract rejects it as an invalid
   * amount -- which is exactly what happened before this distinction existed.
   */
  const encryptedDecimals = Number(balance.decimals ?? 2n);

  const run = useCallback(
    async <T,>(step: EercStep, pending: string, fn: () => Promise<T>): Promise<T | undefined> => {
      setBusy(step);
      setError("");
      setStatus(pending);
      const started = performance.now();
      try {
        const result = await fn();
        setStatus("");
        setLastProofMs(Math.round(performance.now() - started));
        return result;
      } catch (err) {
        setStatus("");
        setError(explain(err));
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  /**
   * Derive the decryption key.
   *
   * Deterministic from a wallet signature, so the same wallet always recovers
   * the same key and nothing is lost by clearing it.
   */
  const generateKey = useCallback(
    () =>
      run("key", "Sign to derive your decryption key…", async () => {
        const key = await eerc.generateDecryptionKey();
        if (contract && address) {
          window.localStorage.setItem(keyStore(chainId, contract, address), key);
        }
        setStoredKey(key);
        return key;
      }),
    [run, eerc, contract, address, chainId],
  );

  const register = useCallback(
    () =>
      run("register", "Proving and registering your public key…", async () => {
        const result = await eerc.register();
        if (result?.key && contract && address) {
          window.localStorage.setItem(keyStore(chainId, contract, address), result.key);
          setStoredKey(result.key);
        }
        eerc.refetchEercUser();
        return result;
      }),
    [run, eerc, contract, address, chainId],
  );

  /**
   * Convert public tokens into an encrypted balance.
   *
   * The approval is ours to make. The SDK checks the allowance and refuses
   * with "Insufficient approval amount!" rather than requesting one, so a
   * deposit from a wallet that had never approved this contract failed with a
   * message about an allowance the interface had given no way to grant.
   *
   * Approved for exactly the amount being deposited rather than an unbounded
   * allowance: this contract keeps custody of real value, and an infinite
   * approval left behind by a one-off deposit is a standing risk the user
   * never agreed to.
   */
  const deposit = useCallback(
    async (amount: string) => {
      if (!deployment || !publicClient || !address || !token) return;
      return run("deposit", "Converting public tokens into encrypted ones…", async () => {
        const value = parseUnits(amount, tokenDecimals);

        const allowance = (await publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, deployment.encryptedERC as `0x${string}`],
        })) as bigint;

        if (allowance < value) {
          setStatus("Approving the encrypted token to take the deposit…");
          const hash = await writeContractAsync({
            address: token,
            abi: erc20Abi,
            functionName: "approve",
            args: [deployment.encryptedERC as `0x${string}`, value],
          });
          await publicClient.waitForTransactionReceipt({ hash });
        }

        setStatus("Proving the deposit…");
        const result = await balance.deposit(value);
        await Promise.all([refetchPublic(), balance.refetchBalance()]);
        return result;
      });
    },
    [
      run, balance, deployment, tokenDecimals, refetchPublic, publicClient,
      address, token, writeContractAsync,
    ],
  );

  /**
   * Move an encrypted balance.
   *
   * The recipient must already be registered — the transfer proof is built
   * against their public key — so that is checked before a proof is generated
   * rather than after the wallet prompt.
   */
  const transfer = useCallback(
    async (to: string, amount: string) => {
      if (!deployment) return;
      return run("transfer", "Generating the transfer proof…", async () => {
        const check = await eerc.isAddressRegistered(to as `0x${string}`);
        if (!check.isRegistered) {
          throw new Error(
            "That address is not registered on the encrypted token, so no transfer proof can be built for it.",
          );
        }
        const value = parseUnits(amount, encryptedDecimals);
        // No message argument. The SDK switches to a five-argument
        // `transfer(..., string)` when one is supplied, and this deployment's
        // EncryptedERC only declares the four-argument form -- so a message
        // silently selected a function that does not exist and the
        // transaction reverted with an unrecognised selector.
        const result = await balance.privateTransfer(to, value);
        await balance.refetchBalance();
        return result;
      });
    },
    [run, eerc, balance, deployment, encryptedDecimals],
  );

  const withdraw = useCallback(
    async (amount: string) => {
      if (!deployment) return;
      return run("withdraw", "Proving and withdrawing…", async () => {
        const value = parseUnits(amount, encryptedDecimals);
        const result = await balance.withdraw(value);
        await Promise.all([refetchPublic(), balance.refetchBalance()]);
        return result;
      });
    },
    [run, balance, deployment, tokenDecimals, refetchPublic],
  );

  return useMemo(
    () => ({
      available: !!deployment,
      chainId,
      address,
      deployment,
      /** SDK lifecycle state. */
      isInitialized: eerc.isInitialized,
      isRegistered: eerc.isRegistered,
      isDecryptionKeySet: eerc.isDecryptionKeySet,
      isAuditorKeySet: eerc.isAuditorKeySet,
      symbol: tokenSymbol,
      decimals: tokenDecimals,
      /**
       * Balances.
       *
       * The SDK reports -1n when a balance cannot be reconciled — either the
       * ElGamal point disagrees with the summed PCTs, or one of the PCTs was
       * written for a different key and will not decrypt. Both mean the same
       * thing to a reader: this balance is not readable with this key, and
       * showing a zero instead would be a lie about their funds.
       */
      unreadable: (balance.decryptedBalance ?? 0n) < 0n,
      /**
       * Formatted with the *encrypted* token's own decimals.
       *
       * The encrypted side of a converter keeps its own precision -- two
       * decimal places here, against the ERC20's eighteen. Depositing 100
       * tokens therefore stores 10000 base units, and printing that raw next
       * to a public balance of 900 in the same symbol reads as though the
       * deposit multiplied the holding by a hundred.
       */
      encrypted: formatUnits(balance.decryptedBalance ?? 0n, encryptedDecimals),
      encryptedRaw: balance.decryptedBalance ?? 0n,
      encryptedDecimals,
      publicBalance: (publicBalance as bigint | undefined) ?? 0n,
      formatPublic: (v: bigint) => formatUnits(v, tokenDecimals),
      refetchBalance: balance.refetchBalance,
      /** Actions, each reporting pending and failed. */
      generateKey,
      register,
      deposit,
      transfer,
      withdraw,
      busy,
      status,
      error,
      lastProofMs,
      clearError: () => setError(""),
    }),
    [
      deployment, chainId, address, eerc.isInitialized, eerc.isRegistered,
      eerc.isDecryptionKeySet, eerc.isAuditorKeySet, balance.parsedDecryptedBalance,
      balance.decryptedBalance, balance.refetchBalance, encryptedDecimals,
      publicBalance, tokenDecimals, tokenSymbol,
      generateKey, register, deposit, transfer, withdraw, busy, status, error,
      lastProofMs,
    ],
  );
}

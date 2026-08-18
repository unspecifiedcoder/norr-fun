import { useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { encodeDeployData, formatEther, parseUnits } from "viem";
import { feeRouterAbi, idoAbi, projectTokenAbi } from "../contracts/abis";
import { feeRouterBytecode, idoBytecode, projectTokenBytecode } from "../contracts/bytecode";
import { getLaunch } from "../contracts/config";

/**
 * What deploying will actually cost.
 *
 * Four signatures is a number the form already states; what it costs is not,
 * and "about a minute" is a poor answer to "can I afford this". The three
 * contract creations are estimated against the connected node with the real
 * constructor arguments, priced at the current fee, and summed.
 *
 * The registry call is deliberately left out of the estimate rather than
 * guessed at: it cannot be estimated before the contracts it references
 * exist. The figure is presented as the floor it is.
 */
export function useDeployCost(supply: string, enabled: boolean) {
  const chainId = useChainId();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const launch = getLaunch(chainId);

  const [cost, setCost] = useState<{ gas: bigint; wei: bigint } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || !publicClient || !address || !launch) return;
    let cancelled = false;

    const run = async () => {
      try {
        const minted = parseUnits(supply && Number(supply) > 0 ? supply : "1", 18);

        // Real constructor arguments, so the estimate is for the bytecode that
        // will actually be sent rather than an empty stand-in.
        const payloads = [
          encodeDeployData({
            abi: projectTokenAbi,
            bytecode: projectTokenBytecode,
            args: [minted],
          }),
          encodeDeployData({
            abi: feeRouterAbi,
            bytecode: feeRouterBytecode,
            args: [
              launch.contributionAsset as `0x${string}`,
              address,
              [
                {
                  recipient: address,
                  bps: 10_000n,
                  category: 0,
                  label: "Creator",
                },
              ],
            ],
          }),
          encodeDeployData({
            abi: idoAbi,
            bytecode: idoBytecode,
            args: [address, address, BigInt(Math.floor(Date.now() / 1000)), 0n],
          }),
        ];

        const [gases, fees] = await Promise.all([
          Promise.all(
            payloads.map((data) => publicClient.estimateGas({ account: address, data })),
          ),
          publicClient.estimateFeesPerGas().catch(async () => ({
            maxFeePerGas: await publicClient.getGasPrice(),
          })),
        ]);

        const gas = gases.reduce((sum, g) => sum + g, 0n);
        const price = fees.maxFeePerGas ?? 0n;
        if (!cancelled) {
          setCost({ gas, wei: gas * price });
          setError("");
        }
      } catch (err) {
        const e = err as { shortMessage?: string; message?: string };
        if (!cancelled) setError(e.shortMessage ?? e.message ?? String(err));
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, publicClient, address, launch, supply]);

  return {
    available: !!cost,
    gas: cost?.gas ?? 0n,
    /** A floor: the registry call is not included, for the reason above. */
    ether: cost ? formatEther(cost.wei) : "",
    error,
  };
}

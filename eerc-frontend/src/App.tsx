// App.tsx
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { FaPaperPlane, FaSearchDollar } from "react-icons/fa";

import { useEERC } from "./hooks/useEERC";
import { StyledInput } from "./components/StyledIntput";
import { ActionButton } from "./components/ActionButton";
import { Card } from "./components/Card";
import { ParticleBackground } from "./components/ParticleBackground";

export default function App() {
  const { address, isConnected } = useAccount();
  const {
    // EERC
    eercAddress, setEercAddress,
    transferAmount, setTransferAmount,
    transferRecipient, setTransferRecipient,
    decryptedBalance,
    handleCheckBalance, handleTransfer
  } = useEERC();

  return (
    <div className="min-h-screen text-white flex flex-col items-center justify-center font-mono p-4">
      <ParticleBackground />

      <div className="relative z-10 w-full flex flex-col items-center">
        <main className="w-full max-w-3xl bg-black bg-opacity-40 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-2xl shadow-blue-500/10">
          <div className="p-6 border-b border-gray-700 flex justify-between items-center">
            <h1 className="text-2xl font-bold">🔐 norr.fun</h1>
            <ConnectButton />
          </div>
          <div className="p-6">
            {isConnected ? (
              <>
                <p className="text-center text-gray-400 mb-6">
                  Connected as:{" "}
                  <span className="font-bold text-indigo-400 break-all">
                    {address}
                  </span>
                </p>

                {/* Contract Setup */}
                <Card title="1. Contract Setup">
                  <div className="space-y-4">
                    <StyledInput
                      value={eercAddress}
                      onChange={(e) => setEercAddress(e.target.value)}
                      placeholder="EncryptedERC Contract Address (0x...)"
                    />
                  </div>
                </Card>

                {/* Private Actions */}
                <Card title="2. Private Actions (eERC)">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Private Transfer */}
                    <div className="flex flex-col gap-4">
                      <h3 className="font-bold text-lg text-gray-300 flex items-center gap-2">
                        <FaPaperPlane /> Private Transfer
                      </h3>
                      <StyledInput
                        value={transferRecipient}
                        onChange={(e) => setTransferRecipient(e.target.value)}
                        placeholder="Recipient Address (0x...)"
                      />
                      <StyledInput
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        placeholder="Amount to send"
                        type="number"
                      />
                      <ActionButton
                        onClick={handleTransfer}
                        disabled={!eercAddress || !transferRecipient || !transferAmount}
                      >
                        Send Privately
                      </ActionButton>
                    </div>

                    {/* Check Balance */}
                    <div className="flex flex-col gap-4">
                      <h3 className="font-bold text-lg text-gray-300 flex items-center gap-2">
                        <FaSearchDollar /> Check Balance
                      </h3>
                      <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 text-center h-20 flex items-center justify-center">
                        {decryptedBalance !== null ? (
                          <p className="text-2xl font-bold text-green-400">
                            {decryptedBalance}{" "}
                            <span className="text-sm text-gray-400">eERC</span>
                          </p>
                        ) : (
                          <p className="text-gray-500">Click below to decrypt</p>
                        )}
                      </div>
                      <ActionButton onClick={handleCheckBalance} disabled={!eercAddress}>
                        Check My Balance
                      </ActionButton>
                    </div>
                  </div>
                </Card>
              </>
            ) : (
              <p className="text-center text-gray-400 mt-6">
                Please connect your wallet
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

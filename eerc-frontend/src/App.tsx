// App.tsx
import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { FaPaperPlane, FaSearchDollar, FaPlus, FaStream, FaCoins } from "react-icons/fa";

import { useEERC } from "./hooks/useEERC";
import { StyledInput } from "./components/StyledIntput";
import { ActionButton } from "./components/ActionButton";
import { Card } from "./components/Card";
import { ParticleBackground } from "./components/ParticleBackground";
import { FeeBuilder } from "./components/FeeBuilder";
import { IdoClaim } from "./components/IdoClaim";
import { Logo } from "./components/Logo";
import { CreateLaunch } from "./components/CreateLaunch";
import { Feed } from "./components/Feed";

type View = "feed" | "create" | "manage" | "private";

const TABS: { key: View; label: string; icon: React.ReactNode }[] = [
  { key: "feed", label: "Raises", icon: <FaStream /> },
  { key: "create", label: "Start one", icon: <FaPlus /> },
  { key: "manage", label: "Payouts & claims", icon: <FaCoins /> },
  { key: "private", label: "Private transfer", icon: <FaPaperPlane /> },
];

export default function App() {
  const { address, isConnected } = useAccount();
  const [view, setView] = useState<View>("feed");

  const {
    eercAddress, setEercAddress,
    transferAmount, setTransferAmount,
    transferRecipient, setTransferRecipient,
    decryptedBalance,
    handleCheckBalance, handleTransfer
  } = useEERC();

  return (
    // justify-center would push overflow above the top of the viewport once the
    // page grows taller than the screen, making it unscrollable; start-aligned
    // with vertical padding keeps tall content reachable.
    <div className="min-h-screen text-white flex flex-col items-center justify-start font-mono p-4 py-10">
      <ParticleBackground />

      <div className="relative z-10 w-full flex flex-col items-center">
        <main className="w-full max-w-5xl bg-black bg-opacity-40 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-2xl shadow-blue-500/10">
          <div className="p-6 border-b border-gray-700 flex justify-between items-center gap-4 flex-wrap">
            <h1>
              <Logo size="2rem" />
            </h1>
            <ConnectButton />
          </div>

          <nav className="px-6 pt-4 flex gap-1 flex-wrap border-b border-gray-800">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={`px-4 py-2.5 text-sm rounded-t-lg flex items-center gap-2 transition-colors ${
                  view === t.key
                    ? "bg-white/10 text-white font-bold"
                    : "text-gray-500 hover:text-gray-200 hover:bg-white/5"
                }`}
              >
                <span className="text-xs">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          <div className="p-6">
            {view === "feed" && <Feed onCreate={() => setView("create")} />}

            {view === "create" && <CreateLaunch onDone={() => setView("feed")} />}

            {view === "manage" && (
              <>
                <FeeBuilder />
                <IdoClaim />
              </>
            )}

            {view === "private" && (
              <>
                {isConnected ? (
                  <>
                    <p className="text-center text-gray-400 mb-6">
                      Signed in as{" "}
                      <span className="font-bold text-indigo-400 break-all">
                        {address}
                      </span>
                    </p>

                    <Card title="Encrypted balance contract">
                      <StyledInput
                        value={eercAddress}
                        onChange={(e) => setEercAddress(e.target.value)}
                        placeholder="EncryptedERC Contract Address (0x...)"
                      />
                    </Card>

                    <Card title="Move value without revealing the amount">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col gap-4">
                          <h3 className="font-bold text-lg text-gray-300 flex items-center gap-2">
                            <FaPaperPlane /> Send
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
                            Send privately
                          </ActionButton>
                        </div>

                        <div className="flex flex-col gap-4">
                          <h3 className="font-bold text-lg text-gray-300 flex items-center gap-2">
                            <FaSearchDollar /> Your balance
                          </h3>
                          <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 text-center h-20 flex items-center justify-center">
                            {decryptedBalance !== null ? (
                              <p className="text-2xl font-bold text-green-400">
                                {decryptedBalance}{" "}
                                <span className="text-sm text-gray-400">eERC</span>
                              </p>
                            ) : (
                              <p className="text-gray-500">Decrypt to reveal</p>
                            )}
                          </div>
                          <ActionButton onClick={handleCheckBalance} disabled={!eercAddress}>
                            Decrypt my balance
                          </ActionButton>
                        </div>
                      </div>
                    </Card>
                  </>
                ) : (
                  <p className="text-center text-gray-400 py-8">
                    Connect a wallet to move encrypted balances.
                  </p>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

// App.tsx
import { Route, Routes, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { FaPaperPlane, FaSearchDollar } from "react-icons/fa";

import { useEERC } from "./hooks/useEERC";
import { StyledInput } from "./components/StyledIntput";
import { ActionButton } from "./components/ActionButton";
import { Card } from "./components/Card";
import { ParticleBackground } from "./components/ParticleBackground";
import { CreateLaunch } from "./components/CreateLaunch";
import { Feed } from "./components/Feed";
import { LaunchDetail } from "./components/LaunchDetail";
import { Profile } from "./components/Profile";
import { Boards, BoardDetail } from "./components/Boards";
import { Earnings } from "./components/Earnings";
import { Activity } from "./components/Activity";
import { Preferences } from "./components/Preferences";
import { usePreferences } from "./hooks/usePreferences";
import { ChainGuard } from "./components/ChainGuard";
import { Shell } from "./components/Shell";

export default function App() {
  const { prefs } = usePreferences();
  return (
    <>
      {prefs.showBackdrop && <ParticleBackground />}
      <div className="relative z-10">
        <Shell>
          <Routes>
            <Route path="/" element={<FeedRoute />} />
            <Route path="/raise/:ido" element={<LaunchDetail />} />
            <Route path="/start" element={<CreateRoute />} />
            <Route path="/desks" element={<Boards />} />
            <Route path="/desk/:slug" element={<BoardDetail />} />
            <Route path="/owed" element={<Earnings />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/me" element={<Profile />} />
            <Route path="/u/:address" element={<Profile />} />
            <Route path="/private" element={<PrivateTransfer />} />
            <Route path="/settings" element={<Preferences />} />
            {/* Chain-scoped mirrors, so a shared link carries its network. */}
            <Route path="/:chain/raise/:ido" element={<ChainGuard><LaunchDetail /></ChainGuard>} />
            <Route path="/:chain/desk/:slug" element={<ChainGuard><BoardDetail /></ChainGuard>} />
            <Route path="/:chain/u/:address" element={<ChainGuard><Profile /></ChainGuard>} />
            <Route path="*" element={<FeedRoute />} />
          </Routes>
        </Shell>
      </div>
    </>
  );
}

const FeedRoute = () => {
  const navigate = useNavigate();
  return <Feed onCreate={() => navigate("/start")} />;
};

const CreateRoute = () => {
  const navigate = useNavigate();
  return <CreateLaunch onDone={() => navigate("/")} />;
};

const PrivateTransfer = () => {
  const { address, isConnected } = useAccount();
  const {
    eercAddress, setEercAddress,
    transferAmount, setTransferAmount,
    transferRecipient, setTransferRecipient,
    decryptedBalance,
    handleCheckBalance, handleTransfer,
  } = useEERC();

  if (!isConnected) {
    return (
      <p className="text-center text-gray-400 py-8">
        Connect a wallet to move encrypted balances.
      </p>
    );
  }

  return (
    <>
      <p className="text-center text-gray-400 mb-6">
        Signed in as{" "}
        <span className="font-bold text-indigo-400 break-all">{address}</span>
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
  );
};

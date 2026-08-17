// App.tsx
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { FaPaperPlane, FaSearchDollar, FaPlus, FaStream, FaUser, FaColumns, FaHandHoldingUsd } from "react-icons/fa";

import { useEERC } from "./hooks/useEERC";
import { StyledInput } from "./components/StyledIntput";
import { ActionButton } from "./components/ActionButton";
import { Card } from "./components/Card";
import { ParticleBackground } from "./components/ParticleBackground";
import { Logo } from "./components/Logo";
import { CreateLaunch } from "./components/CreateLaunch";
import { Feed } from "./components/Feed";
import { LaunchDetail } from "./components/LaunchDetail";
import { Profile } from "./components/Profile";
import { Boards, BoardDetail } from "./components/Boards";
import { Earnings } from "./components/Earnings";

const TABS = [
  { to: "/", label: "Raises", icon: <FaStream />, end: true },
  { to: "/start", label: "Start one", icon: <FaPlus />, end: false },
  { to: "/desks", label: "Desks", icon: <FaColumns />, end: false },
  { to: "/owed", label: "Owed to you", icon: <FaHandHoldingUsd />, end: false },
  { to: "/me", label: "You", icon: <FaUser />, end: false },
  { to: "/private", label: "Private transfer", icon: <FaPaperPlane />, end: false },
];

export default function App() {
  return (
    // justify-center would push overflow above the top of the viewport once the
    // page grows taller than the screen, making it unscrollable; start-aligned
    // with vertical padding keeps tall content reachable.
    <div className="min-h-screen text-white flex flex-col items-center justify-start font-mono p-4 py-10">
      <ParticleBackground />

      <div className="relative z-10 w-full flex flex-col items-center">
        <main className="w-full max-w-5xl bg-black bg-opacity-40 backdrop-blur-xl rounded-2xl border border-gray-700 shadow-2xl shadow-blue-500/10">
          <div className="p-6 border-b border-gray-700 flex justify-between items-center gap-4 flex-wrap">
            <NavLink to="/" aria-label="norr.fun home">
              <Logo size="2rem" />
            </NavLink>
            <ConnectButton />
          </div>

          <nav className="px-6 pt-4 flex gap-1 flex-wrap border-b border-gray-800">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `px-4 py-2.5 text-sm rounded-t-lg flex items-center gap-2 transition-colors ${
                    isActive
                      ? "bg-white/10 text-white font-bold"
                      : "text-gray-500 hover:text-gray-200 hover:bg-white/5"
                  }`
                }
              >
                <span className="text-xs">{t.icon}</span>
                {t.label}
              </NavLink>
            ))}
          </nav>

          <div className="p-6">
            <Routes>
              <Route path="/" element={<FeedRoute />} />
              <Route path="/raise/:ido" element={<LaunchDetail />} />
              <Route path="/start" element={<CreateRoute />} />
              <Route path="/desks" element={<Boards />} />
              <Route path="/desk/:slug" element={<BoardDetail />} />
              <Route path="/owed" element={<Earnings />} />
              <Route path="/me" element={<Profile />} />
              <Route path="/u/:address" element={<Profile />} />
              <Route path="/private" element={<PrivateTransfer />} />
              <Route path="*" element={<FeedRoute />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
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

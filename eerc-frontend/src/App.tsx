import { Route, Routes, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { FaPaperPlane, FaSearchDollar, FaLock } from "react-icons/fa";
import { useEERC } from "./hooks/useEERC";
import { StyledInput } from "./components/StyledIntput";
import { ActionButton } from "./components/ActionButton";
import { Panel } from "./components/ui/Panel";
import { CreateLaunch } from "./components/CreateLaunch";
import { LaunchModels } from "./components/LaunchModels";
import { Feed } from "./components/Feed";
import { LaunchDetail } from "./components/LaunchDetail";
import { Profile } from "./components/Profile";
import { Boards, BoardDetail } from "./components/Boards";
import { Earnings } from "./components/Earnings";
import { Activity } from "./components/Activity";
import { Preferences } from "./components/Preferences";
import { ChainGuard } from "./components/ChainGuard";
import { Shell } from "./components/Shell";

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<FeedRoute />} />
        <Route path="/raise/:ido" element={<LaunchDetail />} />

        {/* The wizard is three routes, not three states of one, so a chosen
            model is a place you can link to and go back from. */}
        <Route path="/start" element={<LaunchModels />} />
        <Route path="/start/instant" element={<CreateRoute mode="instant" />} />
        <Route path="/start/raise" element={<CreateRoute mode="full" />} />

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
  );
}

const FeedRoute = () => {
  const navigate = useNavigate();
  return <Feed onCreate={() => navigate("/start")} />;
};

const CreateRoute = ({ mode }: { mode: "instant" | "full" }) => {
  const navigate = useNavigate();
  return <CreateLaunch mode={mode} onDone={() => navigate("/")} />;
};

/**
 * Move an encrypted balance without revealing the amount.
 *
 * The one surface where the privacy layer is operated directly rather than
 * through a raise, so it states what is hidden and what is not instead of
 * assuming the reader already knows.
 */
const PrivateTransfer = () => {
  const { address, isConnected } = useAccount();
  const {
    eercAddress, setEercAddress,
    transferAmount, setTransferAmount,
    transferRecipient, setTransferRecipient,
    decryptedBalance, handleCheckBalance, handleTransfer,
  } = useEERC();

  return (
    <div className="max-w-4xl">
      <header className="mb-5">
        <h1 className="lead">Private transfer</h1>
        <p className="text-[length:var(--t-base)] text-[var(--ink-3)] mt-1.5 max-w-2xl">
          Move an encrypted balance. The amount is never written in the clear —
          the transfer is a proof that the arithmetic holds, not a statement of
          what was sent.
        </p>
      </header>

      {!isConnected ? (
        <Panel title="Wallet required">
          <p className="text-[length:var(--t-base)] text-[var(--ink-3)]">
            Connect a wallet to move encrypted balances.
          </p>
        </Panel>
      ) : (
        <>
          <Panel title="Encrypted balance contract">
            <StyledInput
              value={eercAddress}
              onChange={(e) => setEercAddress(e.target.value)}
              placeholder="EncryptedERC contract address (0x…)"
            />
            <p className="text-[length:var(--t-fine)] text-[var(--ink-4)] mt-2">
              Signed in as <span className="text-[var(--ink-2)] break-all">{address}</span>
            </p>
          </Panel>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <Panel
              title={
                <span className="label !text-[var(--ink)] flex items-center gap-2">
                  <FaPaperPlane className="text-[10px]" /> Send
                </span>
              }
            >
              <div className="space-y-3">
                <StyledInput
                  value={transferRecipient}
                  onChange={(e) => setTransferRecipient(e.target.value)}
                  placeholder="Recipient address (0x…)"
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
                  <FaLock /> Send privately
                </ActionButton>
              </div>
            </Panel>

            <Panel
              title={
                <span className="label !text-[var(--ink)] flex items-center gap-2">
                  <FaSearchDollar className="text-[10px]" /> Your balance
                </span>
              }
            >
              <div className="panel panel--sunk p-4 text-center h-24 grid place-items-center">
                {decryptedBalance !== null ? (
                  <p className="text-[length:var(--t-lead)] font-bold tabular emissive text-[var(--ink)]">
                    {decryptedBalance}{" "}
                    <span className="text-[length:var(--t-fine)] text-[var(--ink-3)]">eERC</span>
                  </p>
                ) : (
                  <p className="text-[length:var(--t-fine)] text-[var(--ink-3)]">
                    Held encrypted. Decrypt locally to read it.
                  </p>
                )}
              </div>
              <div className="mt-3">
                <ActionButton onClick={handleCheckBalance} disabled={!eercAddress} tone="quiet">
                  Decrypt my balance
                </ActionButton>
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
};

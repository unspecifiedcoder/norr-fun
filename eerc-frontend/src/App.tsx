import { Route, Routes, useNavigate } from "react-router-dom";
import { CreateLaunch } from "./components/CreateLaunch";
import { PrivateVault } from "./components/PrivateVault";
import { Portfolio } from "./components/Portfolio";
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
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CommandPalette } from "./components/CommandPalette";
import { Shortcuts } from "./components/Shortcuts";

export default function App() {
  return (
    <Shell>
      <CommandPalette />
      <Shortcuts />
      {/* Scoped to the routed view: the rail and the chrome stay usable
          when one screen throws. */}
      <ErrorBoundary label="route">
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
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/owed" element={<Earnings />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/me" element={<Profile />} />
        <Route path="/u/:address" element={<Profile />} />
        <Route path="/private" element={<PrivateVault />} />
        <Route path="/settings" element={<Preferences />} />

        {/* Chain-scoped mirrors, so a shared link carries its network. */}
        <Route path="/:chain/raise/:ido" element={<ChainGuard><LaunchDetail /></ChainGuard>} />
        <Route path="/:chain/desk/:slug" element={<ChainGuard><BoardDetail /></ChainGuard>} />
        <Route path="/:chain/u/:address" element={<ChainGuard><Profile /></ChainGuard>} />

        <Route path="*" element={<FeedRoute />} />
      </Routes>
      </ErrorBoundary>
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

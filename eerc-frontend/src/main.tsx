import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

import "@rainbow-me/rainbowkit/styles.css";
import {
  getDefaultConfig,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import { WagmiProvider, http } from "wagmi";
import { avalancheFuji, hardhat } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { installDevWallet } from "./lib/dev-wallet";

// Must run before the wagmi config is built so connector discovery sees it.
// No-op unless this is a dev build launched with ?devwallet=1.
installDevWallet();

const config = getDefaultConfig({
  appName: "norr.fun",
  projectId: "YOUR_PROJECT_ID", // can be dummy if only MetaMask
  // hardhat (31337) is included so a launch can be exercised end-to-end against
  // a local node without spending anything on a live network.
  chains: [avalancheFuji, hardhat],
  transports: {
    [avalancheFuji.id]: http(),
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
  ssr: false,
});

// Create QueryClient for wagmi
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WagmiProvider  config={config}>
        {/* RainbowKit ships a blue accent that renders white-on-#0e76fd at
            4.2:1 -- below AA -- and belongs to no palette this app uses. Point
            it at the world's own pigments so the wallet control reads as part
            of the sheet and clears contrast. */}
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#8e3520",
            accentColorForeground: "#ffffff",
            borderRadius: "none",
            fontStack: "system",
          })}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </RainbowKitProvider>
      </WagmiProvider >
    </QueryClientProvider>
  </React.StrictMode>
);

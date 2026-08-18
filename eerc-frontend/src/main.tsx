import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

import "@rainbow-me/rainbowkit/styles.css";
import {
  connectorsForWallets,
  RainbowKitProvider,
  darkTheme,
} from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, WagmiProvider, http } from "wagmi";
import { avalancheFuji, hardhat } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { installDevWallet } from "./lib/dev-wallet";

// Must run before the wagmi config is built so connector discovery sees it.
// No-op unless this is a dev build launched with ?devwallet=1.
installDevWallet();

/**
 * WalletConnect needs a project id from cloud.reown.com, and this repository
 * has none. The placeholder that used to sit here ("YOUR_PROJECT_ID") did not
 * disable WalletConnect -- it offered it in the wallet picker and then failed
 * on selection, which is worse than not offering it. Reading the id from the
 * environment means the connector appears when a real one is configured and
 * is absent when it is not.
 */
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as
  | string
  | undefined;

/**
 * The connector list is assembled by hand rather than taken from
 * `getDefaultConfig`, which always includes WalletConnect and throws on load
 * if no project id is set. WalletConnect is therefore offered only when it can
 * actually work; the injected and Coinbase paths never depended on it.
 */
const connectors = connectorsForWallets(
  [
    {
      groupName: "Installed",
      // injectedWallet is pure EIP-1193 and needs no WalletConnect project.
      // metaMaskWallet does -- it builds a WalletConnect connector for mobile
      // deep-linking and throws on load without one -- so it is offered only
      // when that project id exists.
      wallets: walletConnectProjectId
        ? [injectedWallet, metaMaskWallet]
        : [injectedWallet],
    },
    {
      groupName: "More",
      wallets: walletConnectProjectId
        ? [coinbaseWallet, walletConnectWallet]
        : [coinbaseWallet],
    },
  ],
  {
    appName: "norr.fun",
    projectId: walletConnectProjectId ?? "",
  },
);

const config = createConfig({
  connectors,
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

import React from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import "./index.css";
import App from "./App.jsx";

const config = getDefaultConfig({
  appName: "CACHE",
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  chains: [baseSepolia],
  transports: { [baseSepolia.id]: http(import.meta.env.VITE_ALCHEMY_URL) },
});
const qc = new QueryClient();
const theme = darkTheme({ accentColor: "#2f6bff", accentColorForeground: "white", borderRadius: "small", overlayBlur: "small" });

createRoot(document.getElementById("root")).render(
  <WagmiProvider config={config}><QueryClientProvider client={qc}>
    <RainbowKitProvider theme={theme}><App /></RainbowKitProvider>
  </QueryClientProvider></WagmiProvider>
);

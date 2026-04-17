import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet, arbitrum, base, optimism, polygon, avalanche } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { http } from "wagmi";

export const projectId = "13318bff388bcd13cf50b4a10e9d7671";

// Avalanche is first — primary Moat Protocol deployment network
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [avalanche, mainnet, arbitrum, base, optimism, polygon];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  transports: {
    [avalanche.id]: http("https://api.avax.network/ext/bc/C/rpc"),
    [mainnet.id]: http("https://eth.llamarpc.com"),
    [arbitrum.id]: http("https://arb1.arbitrum.io/rpc"),
    [base.id]: http("https://mainnet.base.org"),
    [optimism.id]: http("https://mainnet.optimism.io"),
    [polygon.id]: http("https://polygon-rpc.com"),
  },
});

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: "Moats Pro",
    description: "Premium DeFi Moats Experience — Stake, Lock, and Earn",
    url: "https://moats.app",
    icons: ["https://moats.app/favicon.ico"],
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
    emailShowWallets: true,
  },
  themeMode: "dark",
  themeVariables: {
    "--w3m-accent": "#00d4ff",
    "--w3m-color-mix": "#0d1520",
    "--w3m-color-mix-strength": 40,
    "--w3m-border-radius-master": "8px",
    "--w3m-z-index": 9999,
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

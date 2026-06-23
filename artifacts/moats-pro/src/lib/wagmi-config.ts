import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet, base, avalanche } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";
import { defineChain } from "viem";
import { http } from "wagmi";

export const projectId = "13318bff388bcd13cf50b4a10e9d7671";

// Avalanche L1 subnet — The Grotto
export const grotto = defineChain({
  id: 36463,
  name: "The Grotto",
  nativeCurrency: { name: "Heresy", symbol: "HERESY", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://subnets.avax.network/thegrotto/mainnet/rpc"] },
  },
  blockExplorers: {
    default: {
      name: "Subnet Explorer",
      url: "https://subnets.avax.network/thegrotto",
    },
  },
});

// Avalanche L1 subnet — Blaze
export const blaze = defineChain({
  id: 46975,
  name: "Blaze",
  nativeCurrency: { name: "Blaze", symbol: "BLAZE", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://subnets.avax.network/blaze/mainnet/rpc"] },
  },
  blockExplorers: {
    default: {
      name: "Subnet Explorer",
      url: "https://subnets.avax.network/blaze",
    },
  },
});

// Avalanche is first — primary Moat Protocol deployment network
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  avalanche,
  mainnet,
  base,
  grotto as unknown as AppKitNetwork,
  blaze as unknown as AppKitNetwork,
];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false,
  transports: {
    [avalanche.id]: http("https://api.avax.network/ext/bc/C/rpc"),
    [mainnet.id]: http("https://eth.llamarpc.com"),
    [base.id]: http("https://mainnet.base.org"),
    [grotto.id]: http(grotto.rpcUrls.default.http[0]),
    [blaze.id]: http(blaze.rpcUrls.default.http[0]),
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

// Display metadata for the nav chain selector.
// `network` matches the `network` string returned by the Moats API config docs,
// used to filter Moat cards by the currently-selected chain.
export const CHAIN_DISPLAY: Record<
  number,
  { label: string; logo: string; network: string }
> = {
  [avalanche.id]: { label: "Avalanche", logo: "/chains/avalanche.png", network: "avalanche" },
  [mainnet.id]: { label: "Ethereum", logo: "/chains/ethereum.png", network: "ethereum" },
  [base.id]: { label: "Base", logo: "/chains/base.png", network: "base" },
  [grotto.id]: { label: "The Grotto", logo: "/chains/grotto.png", network: "thegrotto" },
  [blaze.id]: { label: "Blaze", logo: "/chains/blaze.png", network: "blaze" },
};

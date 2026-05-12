import type { MoatConfig } from "./moats-api";
import { MOAT_METADATA, getMoatMeta, getTokenLogoUrl } from "./moat-metadata";
import btcbLogo from "@assets/logobtc_1777735570322.png";

export interface MoatToken {
  address: `0x${string}`;
  symbol: string;
  name: string;
  logoUrl?: string;
  decimals: number;
  moatContractAddresses: string[];
}

export const NATIVE_AVAX_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;

export function isNativeToken(address: string | undefined): boolean {
  return !!address && address.toLowerCase() === NATIVE_AVAX_ADDRESS;
}

const TW_AVAX_LOGO = (addr: string) =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/assets/${addr}/logo.png`;
const TW_ETH_LOGO = (addr: string) =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${addr}/logo.png`;
const TW_BASE_LOGO = (addr: string) =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/${addr}/logo.png`;

const BASE_TOKENS_AVALANCHE: MoatToken[] = [
  {
    address: NATIVE_AVAX_ADDRESS,
    symbol: "AVAX",
    name: "Avalanche",
    logoUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png",
    decimals: 18,
    moatContractAddresses: [],
  },
  {
    address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    symbol: "WAVAX",
    name: "Wrapped AVAX",
    logoUrl: TW_AVAX_LOGO("0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7"),
    decimals: 18,
    moatContractAddresses: [],
  },
  {
    address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    symbol: "USDC",
    name: "USD Coin",
    logoUrl: TW_AVAX_LOGO("0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"),
    decimals: 6,
    moatContractAddresses: [],
  },
  {
    address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    symbol: "USDT",
    name: "Tether USD",
    logoUrl: TW_AVAX_LOGO("0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7"),
    decimals: 6,
    moatContractAddresses: [],
  },
  {
    address: "0x152b9d0FdC40C096757F570A51E494bd4b943E50",
    symbol: "BTC.b",
    name: "Bitcoin (Bridged)",
    logoUrl: btcbLogo,
    decimals: 8,
    moatContractAddresses: [],
  },
  {
    address: "0x297731Eb3CAB3834525fc9Ea061fd71d8f4645C9",
    symbol: "BLAZE",
    name: "Blaze",
    logoUrl: "/chains/blaze.png",
    decimals: 18,
    moatContractAddresses: [],
  },
];

const BASE_TOKENS_ETHEREUM: MoatToken[] = [
  {
    address: NATIVE_AVAX_ADDRESS,
    symbol: "ETH",
    name: "Ether",
    logoUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    decimals: 18,
    moatContractAddresses: [],
  },
  {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    symbol: "WETH",
    name: "Wrapped Ether",
    logoUrl: TW_ETH_LOGO("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"),
    decimals: 18,
    moatContractAddresses: [],
  },
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    name: "USD Coin",
    logoUrl: TW_ETH_LOGO("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
    decimals: 6,
    moatContractAddresses: [],
  },
  {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT",
    name: "Tether USD",
    logoUrl: TW_ETH_LOGO("0xdAC17F958D2ee523a2206206994597C13D831ec7"),
    decimals: 6,
    moatContractAddresses: [],
  },
  {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    symbol: "WBTC",
    name: "Wrapped BTC",
    logoUrl: TW_ETH_LOGO("0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"),
    decimals: 8,
    moatContractAddresses: [],
  },
];

const BASE_TOKENS_BASE: MoatToken[] = [
  {
    address: NATIVE_AVAX_ADDRESS,
    symbol: "ETH",
    name: "Ether",
    logoUrl:
      "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    decimals: 18,
    moatContractAddresses: [],
  },
  {
    address: "0x4200000000000000000000000000000000000006",
    symbol: "WETH",
    name: "Wrapped Ether",
    logoUrl: TW_BASE_LOGO("0x4200000000000000000000000000000000000006"),
    decimals: 18,
    moatContractAddresses: [],
  },
  {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    name: "USD Coin",
    logoUrl: TW_BASE_LOGO("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
    decimals: 6,
    moatContractAddresses: [],
  },
  {
    address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    symbol: "USDT",
    name: "Tether USD",
    logoUrl: TW_BASE_LOGO("0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2"),
    decimals: 6,
    moatContractAddresses: [],
  },
  {
    address: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    logoUrl: TW_BASE_LOGO("0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf"),
    decimals: 8,
    moatContractAddresses: [],
  },
];

// Per-chain base token universe used by the Moat Swap. The swap UI looks
// these up by the wallet's connected chainId so users can pay with assets
// they actually hold on that chain (not just AVAX-on-Avalanche).
export const BASE_TOKENS_BY_CHAIN: Record<number, MoatToken[]> = {
  43114: BASE_TOKENS_AVALANCHE,
  1: BASE_TOKENS_ETHEREUM,
  8453: BASE_TOKENS_BASE,
};

// Default Avalanche list — kept exported for legacy imports / fallback.
export const BASE_TOKENS: MoatToken[] = BASE_TOKENS_AVALANCHE;

export function getBaseTokensForChain(chainId: number | undefined): MoatToken[] {
  if (!chainId) return BASE_TOKENS_AVALANCHE;
  return BASE_TOKENS_BY_CHAIN[chainId] ?? [];
}

export function deriveMoatTokens(
  configs: MoatConfig[] | undefined,
  network: string = "avalanche",
): MoatToken[] {
  if (!configs) return [];
  const byAddress = new Map<string, MoatToken>();
  for (const cfg of configs) {
    if (cfg.network !== network) continue;
    if (cfg.status === "Deprecated") continue;
    const meta = getMoatMeta(cfg.contractAddress);
    if (!meta.tokenAddress) continue;
    if (meta.tokenSymbol.includes("/")) continue;
    const lower = meta.tokenAddress.toLowerCase();
    const existing = byAddress.get(lower);
    if (existing) {
      existing.moatContractAddresses.push(cfg.contractAddress);
      continue;
    }
    byAddress.set(lower, {
      address: meta.tokenAddress as `0x${string}`,
      symbol: meta.tokenSymbol,
      name: meta.protocol,
      logoUrl: meta.logoUrl ?? getTokenLogoUrl(meta.tokenAddress),
      decimals: 18,
      moatContractAddresses: [cfg.contractAddress],
    });
  }
  return Array.from(byAddress.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export function getKnownMoatTokens(): MoatToken[] {
  const seen = new Set<string>();
  const tokens: MoatToken[] = [];
  for (const [contract, meta] of Object.entries(MOAT_METADATA)) {
    if (!meta.tokenAddress) continue;
    if (meta.tokenSymbol.includes("/")) continue;
    const lower = meta.tokenAddress.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    tokens.push({
      address: meta.tokenAddress as `0x${string}`,
      symbol: meta.tokenSymbol,
      name: meta.protocol,
      logoUrl: meta.logoUrl ?? getTokenLogoUrl(meta.tokenAddress),
      decimals: 18,
      moatContractAddresses: [contract],
    });
  }
  return tokens.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

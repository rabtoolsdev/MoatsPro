import type { MoatConfig } from "./moats-api";
import { MOAT_METADATA, getMoatMeta, getTokenLogoUrl } from "./moat-metadata";

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

export const BASE_TOKENS: MoatToken[] = [
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
    logoUrl: TW_AVAX_LOGO("0x152b9d0FdC40C096757F570A51E494bd4b943E50"),
    decimals: 8,
    moatContractAddresses: [],
  },
];

export function deriveMoatTokens(configs: MoatConfig[] | undefined): MoatToken[] {
  if (!configs) return [];
  const byAddress = new Map<string, MoatToken>();
  for (const cfg of configs) {
    if (cfg.network !== "avalanche") continue;
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

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

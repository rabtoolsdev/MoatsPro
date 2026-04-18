import { useQuery } from "@tanstack/react-query";

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens";
const BATCH_SIZE = 30;

export interface DexTokenInfo {
  /** Volume-weighted (by liquidity) price across all pairs */
  price: number;
  /** Sum of USD liquidity across ALL pools for this token */
  liquidityUsd: number;
  /** Number of liquidity pools found on DexScreener */
  pairCount: number;
}

async function fetchDexInfo(addresses: string[]): Promise<Record<string, DexTokenInfo>> {
  if (addresses.length === 0) return {};
  const acc: Record<string, { price: number; liq: number }[]> = {};

  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(`${DEXSCREENER_API}/${batch.join(",")}`);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        pairs?: Array<{
          baseToken: { address: string; symbol: string };
          priceUsd?: string;
          liquidity?: { usd?: number };
        }>;
      };
      for (const pair of data.pairs ?? []) {
        const addr = pair.baseToken.address.toLowerCase();
        const price = parseFloat(pair.priceUsd ?? "0");
        const liq = pair.liquidity?.usd ?? 0;
        if (price > 0 && liq > 0) {
          (acc[addr] ||= []).push({ price, liq });
        }
      }
    } catch {
      // silently skip failed batches
    }
  }

  const out: Record<string, DexTokenInfo> = {};
  for (const [addr, pairs] of Object.entries(acc)) {
    const totalLiq = pairs.reduce((s, p) => s + p.liq, 0);
    // Liquidity-weighted average price (more robust than picking the deepest pool)
    const price = totalLiq > 0
      ? pairs.reduce((s, p) => s + p.price * p.liq, 0) / totalLiq
      : 0;
    out[addr] = { price, liquidityUsd: totalLiq, pairCount: pairs.length };
  }
  return out;
}

export function useDexscreenerInfo(addresses: string[]) {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()).filter(Boolean))].sort();
  return useQuery({
    queryKey: ["dexscreener-info", unique.join(",")],
    queryFn: () => fetchDexInfo(unique),
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: unique.length > 0,
    placeholderData: {},
  });
}

/**
 * @deprecated Use `useDexscreenerInfo` for richer data (liquidity, pair count).
 * Returns address → price map for backward compatibility.
 */
export function useDexscreenerPrices(addresses: string[]) {
  const q = useDexscreenerInfo(addresses);
  return {
    ...q,
    data: q.data
      ? Object.fromEntries(Object.entries(q.data).map(([k, v]) => [k, v.price]))
      : ({} as Record<string, number>),
  };
}

import { useQuery } from "@tanstack/react-query";

const CHAIN_MAP: Record<string, string> = {
  avalanche: "avax",
  ethereum: "ethereum",
  arbitrum: "arbitrum",
  base: "base",
  optimism: "optimism",
  polygon: "polygon",
  avax: "avax",
  bsc: "bsc",
};

export function getLlamaId(network: string | null | undefined, address: string): string {
  const net = network ?? "avax";
  const chain = CHAIN_MAP[net.toLowerCase()] ?? net.toLowerCase();
  return `${chain}:${address.toLowerCase()}`;
}

async function fetchLlamaPrices(coins: string[]): Promise<Record<string, number>> {
  if (coins.length === 0) return {};
  try {
    // searchWidth is how far back DefiLlama will look for the latest price
    // point. Moat staking tokens are thinly traded, so their canonical price
    // can be several hours old — a narrow window (DefiLlama's own default is
    // 6h) drops them and forces the DexScreener fallback, whose
    // liquidity-weighted average is easily skewed ~2x by a single outlier pool
    // (e.g. MYST's vapordex MYST/FLD pool). A 24h window keeps the canonical
    // price without changing the value returned (DefiLlama always returns the
    // most recent point within the window).
    const res = await fetch(
      `https://coins.llama.fi/prices/current/${coins.join(",")}?searchWidth=24h`
    );
    if (!res.ok) return {};
    const data = (await res.json()) as {
      coins: Record<string, { price: number; symbol?: string }>;
    };
    const out: Record<string, number> = {};
    for (const [key, info] of Object.entries(data.coins)) {
      if (info.price > 0) out[key.toLowerCase()] = info.price;
    }
    return out;
  } catch {
    return {};
  }
}

export function useTokenPrices(llamaIds: string[]) {
  const unique = [...new Set(llamaIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: ["llama-prices", unique.join(",")],
    queryFn: () => fetchLlamaPrices(unique),
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: unique.length > 0,
    placeholderData: {},
  });
}

export function getPrice(
  priceMap: Record<string, number> | undefined,
  llamaId: string
): number {
  if (!priceMap) return 0;
  return priceMap[llamaId.toLowerCase()] ?? 0;
}

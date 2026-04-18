import { useQuery } from "@tanstack/react-query";

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens";
const BATCH_SIZE = 30;

async function fetchDexPrices(addresses: string[]): Promise<Record<string, number>> {
  if (addresses.length === 0) return {};
  const out: Record<string, number> = {};

  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(`${DEXSCREENER_API}/${batch.join(",")}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { pairs?: Array<{
        baseToken: { address: string; symbol: string };
        priceUsd?: string;
        liquidity?: { usd?: number };
      }> };

      // For each token, pick the pair with the highest USD liquidity
      const best: Record<string, { price: number; liq: number }> = {};
      for (const pair of data.pairs ?? []) {
        const addr = pair.baseToken.address.toLowerCase();
        const price = parseFloat(pair.priceUsd ?? "0");
        const liq = pair.liquidity?.usd ?? 0;
        if (price > 0 && liq > (best[addr]?.liq ?? -1)) {
          best[addr] = { price, liq };
        }
      }
      for (const [addr, { price }] of Object.entries(best)) {
        out[addr] = price;
      }
    } catch {
      // silently skip failed batches
    }
  }

  return out;
}

export function useDexscreenerPrices(addresses: string[]) {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()).filter(Boolean))].sort();
  return useQuery({
    queryKey: ["dexscreener-prices", unique.join(",")],
    queryFn: () => fetchDexPrices(unique),
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: unique.length > 0,
    placeholderData: {},
  });
}

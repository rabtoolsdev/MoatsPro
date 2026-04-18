import { useQuery } from "@tanstack/react-query";

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens";
const DEXSCREENER_PAIRS_API = "https://api.dexscreener.com/latest/dex/pairs";
// All currently-supported moats are on Avalanche; if we add other chains later
// the caller can pass per-token network info.
const DEFAULT_PAIR_CHAIN = "avalanche";
// DexScreener returns at most ~30 pairs per response regardless of how many
// tokens are queried, so larger batches silently drop low-liquidity pools.
// Keep this small to ensure every token's pairs are returned.
const BATCH_SIZE = 8;

export interface DexTokenInfo {
  /**
   * For ERC-20 tokens: liquidity-weighted average USD price across all pairs.
   * For LP tokens (`isLpToken=true`): the **base token's** USD price (NOT the
   * per-LP-unit price). The per-LP-unit price must be derived by the caller
   * as `liquidityUsd / lpTotalSupply` (or equivalently via the moat's
   * supply-percentage share of the pool TVL).
   */
  price: number;
  /** Sum of USD liquidity across ALL pools for this token (or the underlying base token for LP tokens) */
  liquidityUsd: number;
  /** Number of liquidity pools found on DexScreener */
  pairCount: number;
  /**
   * True if this address is itself a Uniswap-V2-style LP pair contract (i.e.
   * a staking token that represents a share of a liquidity pool).
   */
  isLpToken?: boolean;
  /**
   * For LP tokens only: the USD TVL of the SPECIFIC pool this LP represents
   * (NOT the aggregated underlying-token liquidity in `liquidityUsd`). Use
   * this for per-LP-unit value math: `pricePerLp = lpPoolLiquidityUsd / lpTotalSupply`.
   */
  lpPoolLiquidityUsd?: number;
}

async function fetchBatch(
  batch: string[],
  acc: Record<string, { price: number; liq: number }[]>,
): Promise<Set<string>> {
  // Returns the set of queried addresses that were represented in the response.
  const seen = new Set<string>();
  try {
    const res = await fetch(`${DEXSCREENER_API}/${batch.join(",")}`);
    if (!res.ok) return seen;
    const data = (await res.json()) as {
      pairs?: Array<{
        baseToken: { address: string; symbol: string };
        priceUsd?: string;
        liquidity?: { usd?: number };
      }>;
    };
    const queried = new Set(batch);
    for (const pair of data.pairs ?? []) {
      const addr = pair.baseToken.address.toLowerCase();
      const price = parseFloat(pair.priceUsd ?? "0");
      const liq = pair.liquidity?.usd ?? 0;
      if (price > 0 && liq > 0) {
        (acc[addr] ||= []).push({ price, liq });
      }
      if (queried.has(addr)) seen.add(addr);
    }
  } catch {
    // silently skip failed batches
  }
  return seen;
}

async function fetchDexInfo(addresses: string[]): Promise<Record<string, DexTokenInfo>> {
  if (addresses.length === 0) return {};
  const acc: Record<string, { price: number; liq: number }[]> = {};
  const missing: string[] = [];
  // LP staking tokens (e.g. Pharaoh's hCASH/WAVAX pair) are pair contracts
  // themselves. Their per-LP-unit price comes from /pairs, but for the DEX TVL
  // display we want ALL pools of the underlying base token (e.g. all hCASH
  // pools across Pharaoh + TraderJoe), not just the single LP's own pool.
  const lpOverride: Record<string, { price: number; baseAddr: string; lpPoolLiquidityUsd: number }> = {};

  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE);
    const seen = await fetchBatch(batch, acc);
    // Truncation safeguard: any queried token with NO pairs in the response
    // might either truly have no DEX listing OR have been dropped due to the
    // ~30-pair response cap. Re-query unseen tokens individually so we never
    // silently drop low-liquidity pools.
    for (const addr of batch) if (!seen.has(addr)) missing.push(addr);
  }

  // Retry missed tokens one-by-one (single-token requests can never be truncated).
  // If still missing after that, try the /pairs endpoint — some staking tokens
  // (e.g. LP positions like hCASH/WAVAX on Pharaoh) ARE pair contracts, not
  // ERC-20s with their own pair listing, so they only resolve via /pairs/{addr}.
  const lpBaseAddrs: string[] = [];
  for (const addr of missing) {
    const seen = await fetchBatch([addr], acc);
    if (seen.has(addr)) continue;
    try {
      const res = await fetch(`${DEXSCREENER_PAIRS_API}/${DEFAULT_PAIR_CHAIN}/${addr}`);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        pairs?: Array<{
          baseToken?: { address?: string };
          priceUsd?: string;
          liquidity?: { usd?: number };
        }>;
        pair?: {
          baseToken?: { address?: string };
          priceUsd?: string;
          liquidity?: { usd?: number };
        };
      };
      const pair = data.pair ?? data.pairs?.[0];
      if (!pair) continue;
      const price = parseFloat(pair.priceUsd ?? "0");
      const baseAddr = pair.baseToken?.address?.toLowerCase();
      const lpPoolLiquidityUsd = pair.liquidity?.usd ?? 0;
      if (price > 0 && baseAddr) {
        // Record the base token's price + the LP's specific pool TVL. The
        // base token's full pool list is fetched below for the DEX TVL row.
        lpOverride[addr] = { price, baseAddr, lpPoolLiquidityUsd };
        if (!acc[baseAddr]) lpBaseAddrs.push(baseAddr);
      }
    } catch {
      // silently skip
    }
  }

  // Fetch all pools for each LP's underlying base token so the DEX TVL row
  // reflects the underlying token's full liquidity (e.g. hCASH appears in 4
  // pools across Pharaoh + TraderJoe, not just the single LP staking pool).
  for (const baseAddr of lpBaseAddrs) {
    await fetchBatch([baseAddr], acc);
  }

  const out: Record<string, DexTokenInfo> = {};
  const allAddrs = new Set([...Object.keys(acc), ...Object.keys(lpOverride)]);
  for (const addr of allAddrs) {
    const lp = lpOverride[addr];
    if (lp) {
      // LP staking token: report the underlying base token's full liquidity
      // (the pool TVL the LP represents a share of). The `price` field is the
      // base token's USD price — callers must derive per-LP-unit price from
      // `liquidityUsd` and the LP's on-chain totalSupply (e.g. moat TVM =
      // moatSupplyShare × liquidityUsd).
      const basePairs = acc[lp.baseAddr] ?? [];
      const totalLiq = basePairs.reduce((s, p) => s + p.liq, 0);
      const basePrice = totalLiq > 0
        ? basePairs.reduce((s, p) => s + p.price * p.liq, 0) / totalLiq
        : lp.price;
      out[addr] = {
        price: basePrice,
        liquidityUsd: totalLiq,
        pairCount: basePairs.length,
        isLpToken: true,
        lpPoolLiquidityUsd: lp.lpPoolLiquidityUsd,
      };
    } else {
      const pairs = acc[addr] ?? [];
      const totalLiq = pairs.reduce((s, p) => s + p.liq, 0);
      // Liquidity-weighted average price (more robust than picking the deepest pool)
      const price = totalLiq > 0
        ? pairs.reduce((s, p) => s + p.price * p.liq, 0) / totalLiq
        : 0;
      out[addr] = { price, liquidityUsd: totalLiq, pairCount: pairs.length };
    }
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

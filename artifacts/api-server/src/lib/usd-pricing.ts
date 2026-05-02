import { logger } from "./logger";

const STABLES = new Set([
  "USDC",
  "USDT",
  "DAI",
  "BUSD",
  "FRAX",
  "LUSD",
  "USDC.E",
  "USDT.E",
  "USDBC",
  "PYUSD",
  "USDS",
]);

const NATIVE_ZERO = "0x0000000000000000000000000000000000000000";

const WRAPPED_NATIVE_BY_CHAIN: Record<number, string> = {
  43114: "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7",
  1: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  8453: "0x4200000000000000000000000000000000000006",
};

const FEE_BPS = 33;
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 4_000;

interface DexscreenerPair {
  baseToken?: { address?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
}

interface DexscreenerResponse {
  pairs?: DexscreenerPair[];
}

const priceCache = new Map<string, { value: number | null; expiresAt: number }>();

function cacheKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`;
}

function resolveLookupAddress(chainId: number, address: string): string {
  const lower = address.toLowerCase();
  if (lower === NATIVE_ZERO) {
    return WRAPPED_NATIVE_BY_CHAIN[chainId] ?? lower;
  }
  return lower;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function getTokenUsdPrice(
  chainId: number,
  address: string,
): Promise<number | null> {
  const lookup = resolveLookupAddress(chainId, address);
  const key = cacheKey(chainId, lookup);
  const cached = priceCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: number | null = null;
  try {
    const res = await fetchWithTimeout(
      `https://api.dexscreener.com/latest/dex/tokens/${lookup}`,
      REQUEST_TIMEOUT_MS,
    );
    if (res.ok) {
      const data = (await res.json()) as DexscreenerResponse;
      let totalLiq = 0;
      let weighted = 0;
      for (const p of data.pairs ?? []) {
        const baseAddr = p.baseToken?.address?.toLowerCase();
        if (baseAddr !== lookup) continue;
        const price = parseFloat(p.priceUsd ?? "0");
        const liq = p.liquidity?.usd ?? 0;
        if (price > 0 && liq > 0) {
          weighted += price * liq;
          totalLiq += liq;
        }
      }
      if (totalLiq > 0) value = weighted / totalLiq;
    }
  } catch (err) {
    logger.warn({ err, chainId, address }, "DexScreener price lookup failed");
  }
  priceCache.set(key, { value, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
  return value;
}

export interface UsdEnrichInput {
  chainId: number;
  fromTokenSymbol: string;
  fromTokenAddress: string;
  toTokenSymbol: string;
  toTokenAddress: string;
  fromAmount: number;
  toAmount: number;
  feeAmount?: number | null;
  fromUsd?: number | null;
  toUsd?: number | null;
  feeUsd?: number | null;
}

export interface UsdEnrichResult {
  fromUsd: number | null;
  toUsd: number | null;
  feeUsd: number | null;
}

/**
 * Compute fromUsd / toUsd / feeUsd for a swap when the router quote did not
 * provide them. Stablecoins are valued 1:1; everything else falls back to a
 * liquidity-weighted DexScreener price. Returns nulls only when no price
 * source is available (caller should preserve any existing values).
 */
export async function enrichUsdValues(
  input: UsdEnrichInput,
): Promise<UsdEnrichResult> {
  const fromUpper = input.fromTokenSymbol.toUpperCase();
  const toUpper = input.toTokenSymbol.toUpperCase();
  const fromIsStable = STABLES.has(fromUpper);
  const toIsStable = STABLES.has(toUpper);

  let fromUsd = input.fromUsd ?? null;
  let toUsd = input.toUsd ?? null;
  let feeUsd = input.feeUsd ?? null;

  // 1) Stablecoin shortcut.
  if (fromUsd == null && fromIsStable) fromUsd = input.fromAmount;
  if (toUsd == null && toIsStable) toUsd = input.toAmount;

  // 2) DexScreener fallback for the side(s) we still don't know.
  if (fromUsd == null) {
    const price = await getTokenUsdPrice(input.chainId, input.fromTokenAddress);
    if (price != null && price > 0) fromUsd = input.fromAmount * price;
  }
  if (toUsd == null) {
    const price = await getTokenUsdPrice(input.chainId, input.toTokenAddress);
    if (price != null && price > 0) toUsd = input.toAmount * price;
  }

  // 3) Cross-fill: derive the unknown side from the known side using the
  //    fee-bps relationship (fromAmount × (1 - fee) ≈ toAmount in USD).
  if (fromUsd == null && toUsd != null) {
    fromUsd = toUsd / (1 - FEE_BPS / 10_000);
  }
  if (toUsd == null && fromUsd != null) {
    toUsd = fromUsd * (1 - FEE_BPS / 10_000);
  }

  // 4) Fee USD = grossFromUsd × feeBps when not provided.
  if (feeUsd == null && fromUsd != null) {
    feeUsd = fromUsd * (FEE_BPS / 10_000);
  }

  return { fromUsd, toUsd, feeUsd };
}

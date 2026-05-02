import { parseUnits } from "viem";

export const FEE_WALLET = "0x037a3b41975B44cF6038e48f1433831aB8810Af7" as const;
export const FEE_BPS = 33;
export const FEE_DECIMAL = FEE_BPS / 10_000;
// Note: `integrator`/`fee` are NOT sent to Li.Fi (would require portal
// registration on https://portal.li.fi/). We collect the 0.33% manually
// via a direct ERC20/native transfer to FEE_WALLET before each swap.
export const INTEGRATOR_NAME = "moats-pro";
export const AVALANCHE_CHAIN_ID = 43114;
export const ETHEREUM_CHAIN_ID = 1;
export const BASE_CHAIN_ID = 8453;
// Chains where Li.Fi + Odos can route (others — e.g. Avalanche subnets —
// don't have aggregator coverage and the swap UI gracefully disables).
export const SWAP_SUPPORTED_CHAIN_IDS: readonly number[] = [
  AVALANCHE_CHAIN_ID,
  ETHEREUM_CHAIN_ID,
  BASE_CHAIN_ID,
] as const;
export const DEFAULT_SLIPPAGE = 0.005;

export type RouterId = "lifi" | "0x" | "odos" | "kyber";

export interface QuoteRequest {
  chainId: number;
  fromTokenAddress: `0x${string}`;
  toTokenAddress: `0x${string}`;
  fromAmount: string;
  fromDecimals: number;
  fromAddress: `0x${string}`;
  slippage?: number;
}

export interface SwapQuote {
  router: RouterId;
  toolName: string;
  fromAmountRaw: string;
  toAmountRaw: string;
  toAmountMinRaw: string;
  estimatedGasUsd?: number;
  fromAmountUsd?: number;
  toAmountUsd?: number;
  feeAmountRaw?: string;
  approveTo: `0x${string}`;
  tx: {
    to: `0x${string}`;
    data: `0x${string}`;
    value: bigint;
  };
}

export interface QuoteResult {
  router: RouterId;
  ok: boolean;
  quote?: SwapQuote;
  error?: string;
}

interface LiFiQuoteResponse {
  tool: string;
  estimate: {
    approvalAddress?: string;
    fromAmount: string;
    fromAmountUSD?: string;
    toAmount: string;
    toAmountUSD?: string;
    toAmountMin: string;
    gasCosts?: Array<{ amountUSD?: string }>;
    feeCosts?: Array<{ amount?: string; token?: { address?: string } }>;
  };
  transactionRequest: {
    to: string;
    data: string;
    value: string;
    chainId: number;
  };
}

export async function getLifiQuote(req: QuoteRequest): Promise<QuoteResult> {
  try {
    const slippage = req.slippage ?? DEFAULT_SLIPPAGE;
    const rawFromAmount = parseUnits(req.fromAmount, req.fromDecimals).toString();
    const params = new URLSearchParams({
      fromChain: String(req.chainId),
      toChain: String(req.chainId),
      fromToken: req.fromTokenAddress,
      toToken: req.toTokenAddress,
      fromAmount: rawFromAmount,
      fromAddress: req.fromAddress,
      // Tracking only — `integrator`/`fee` would require Li.Fi portal
      // registration; we skim the 0.33% manually before the swap.
      referrer: FEE_WALLET,
      slippage: slippage.toString(),
    });
    const res = await fetch(`https://li.quest/v1/quote?${params.toString()}`);
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      return {
        router: "lifi",
        ok: false,
        error: parseLifiError(res.status, errBody),
      };
    }
    const data = (await res.json()) as LiFiQuoteResponse;
    const approveTo = (data.estimate.approvalAddress ?? data.transactionRequest.to) as `0x${string}`;
    const feeAmount = data.estimate.feeCosts?.[0]?.amount;
    const gasUsd = parseFloat(data.estimate.gasCosts?.[0]?.amountUSD ?? "0");
    const fromUsd = parseFloat(data.estimate.fromAmountUSD ?? "0");
    const toUsd = parseFloat(data.estimate.toAmountUSD ?? "0");
    return {
      router: "lifi",
      ok: true,
      quote: {
        router: "lifi",
        toolName: data.tool,
        fromAmountRaw: data.estimate.fromAmount,
        toAmountRaw: data.estimate.toAmount,
        toAmountMinRaw: data.estimate.toAmountMin,
        estimatedGasUsd: Number.isFinite(gasUsd) && gasUsd > 0 ? gasUsd : undefined,
        fromAmountUsd: Number.isFinite(fromUsd) && fromUsd > 0 ? fromUsd : undefined,
        toAmountUsd: Number.isFinite(toUsd) && toUsd > 0 ? toUsd : undefined,
        feeAmountRaw: feeAmount,
        approveTo,
        tx: {
          to: data.transactionRequest.to as `0x${string}`,
          data: data.transactionRequest.data as `0x${string}`,
          value: BigInt(data.transactionRequest.value ?? "0"),
        },
      },
    };
  } catch (e) {
    return {
      router: "lifi",
      ok: false,
      error: e instanceof Error ? e.message : "Quote request failed",
    };
  }
}

function parseLifiError(status: number, body: string): string {
  if (status === 404) return "No swap route available between these tokens.";
  if (status === 429) return "Quote rate limit hit. Try again in a moment.";
  if (status >= 500) return "Li.Fi service is temporarily unavailable.";
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    /* ignore */
  }
  return `Quote failed (HTTP ${status})`;
}

const ZEROX_API_KEY = (import.meta.env.VITE_0X_API_KEY as string | undefined) ?? "";
const ODOS_REFERRAL_CODE_RAW = (import.meta.env.VITE_ODOS_REFERRAL_CODE as string | undefined) ?? "";
const KYBER_CLIENT_ID =
  (import.meta.env.VITE_KYBERSWAP_CLIENT_ID as string | undefined) ?? "moats-pro";

const NATIVE_ZERO = "0x0000000000000000000000000000000000000000";
// 0x and KyberSwap both use the canonical "eee…" sentinel for native;
// our internal token registry uses 0x0…0, so we translate at the boundary.
const NATIVE_EEEE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function toEeeeNative(addr: `0x${string}`): string {
  return addr.toLowerCase() === NATIVE_ZERO ? NATIVE_EEEE : addr;
}

// 0x Swap API v2 (allowance-holder flow). We deliberately avoid the Permit2
// flow because it requires an EIP-712 signature step the rest of our swap
// pipeline doesn't support. AllowanceHolder behaves like Li.Fi/Odos:
// approve `issues.allowance.spender`, then send the returned tx.
const ZEROX_SUPPORTED_CHAIN_IDS = new Set<number>([
  1, 8453, 43114, 42161, 10, 137,
]);

interface ZeroxQuoteResponse {
  liquidityAvailable?: boolean;
  buyAmount?: string;
  sellAmount?: string;
  minBuyAmount?: string;
  totalNetworkFee?: string;
  issues?: {
    allowance?: { spender?: string } | null;
    balance?: unknown;
  };
  transaction?: {
    to?: string;
    data?: string;
    value?: string | number;
    gas?: string | number;
    gasPrice?: string;
  };
  validationErrors?: Array<{ reason?: string; description?: string }>;
  message?: string;
}

export async function get0xQuote(req: QuoteRequest): Promise<QuoteResult> {
  if (!ZEROX_API_KEY) {
    return {
      router: "0x",
      ok: false,
      error: "0x router not configured (VITE_0X_API_KEY missing).",
    };
  }
  if (!ZEROX_SUPPORTED_CHAIN_IDS.has(req.chainId)) {
    return {
      router: "0x",
      ok: false,
      error: "0x is not available on this chain.",
    };
  }
  try {
    const slippage = req.slippage ?? DEFAULT_SLIPPAGE;
    const slippageBps = Math.max(0, Math.round(slippage * 10_000));
    const rawFromAmount = parseUnits(req.fromAmount, req.fromDecimals).toString();
    const sellToken = toEeeeNative(req.fromTokenAddress);
    const buyToken = toEeeeNative(req.toTokenAddress);
    const params = new URLSearchParams({
      chainId: String(req.chainId),
      sellToken,
      buyToken,
      sellAmount: rawFromAmount,
      taker: req.fromAddress,
      slippageBps: String(slippageBps),
    });
    const res = await fetch(
      `https://api.0x.org/swap/allowance-holder/quote?${params.toString()}`,
      {
        headers: {
          "0x-api-key": ZEROX_API_KEY,
          "0x-version": "v2",
        },
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { router: "0x", ok: false, error: parse0xError(res.status, body) };
    }
    const data = (await res.json()) as ZeroxQuoteResponse;
    if (data.liquidityAvailable === false) {
      return { router: "0x", ok: false, error: "No 0x liquidity for this pair." };
    }
    const tx = data.transaction;
    if (!tx?.to || !tx?.data || !data.buyAmount) {
      return {
        router: "0x",
        ok: false,
        error: data.message || "0x returned no transaction.",
      };
    }
    const approveTo = (data.issues?.allowance?.spender ?? tx.to) as `0x${string}`;
    const minBuyAmount = data.minBuyAmount ?? data.buyAmount;
    return {
      router: "0x",
      ok: true,
      quote: {
        router: "0x",
        toolName: "0x",
        fromAmountRaw: rawFromAmount,
        toAmountRaw: data.buyAmount,
        toAmountMinRaw: minBuyAmount,
        approveTo,
        tx: {
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: BigInt(tx.value ?? "0"),
        },
      },
    };
  } catch (e) {
    return {
      router: "0x",
      ok: false,
      error: e instanceof Error ? e.message : "0x quote request failed",
    };
  }
}

function parse0xError(status: number, body: string): string {
  if (status === 401 || status === 403) return "0x API key invalid or expired.";
  if (status === 404) return "No 0x route between these tokens.";
  if (status === 429) return "0x rate limit hit. Try again in a moment.";
  if (status >= 500) return "0x service is temporarily unavailable.";
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed?.validationErrors) && parsed.validationErrors[0]) {
      const ve = parsed.validationErrors[0];
      return ve.description || ve.reason || `0x quote failed (HTTP ${status})`;
    }
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    /* ignore */
  }
  return `0x quote failed (HTTP ${status})`;
}

// KyberSwap Aggregator API. Public — no API key required, but we send a
// stable `x-client-id` so KyberSwap can attribute traffic to Moats.
// Two-step: GET /routes returns a routeSummary; POST /route/build encodes
// it into calldata against the per-chain Meta Aggregation router.
const KYBER_CHAIN_SLUG: Record<number, string> = {
  1: "ethereum",
  43114: "avalanche",
  8453: "base",
  42161: "arbitrum",
  10: "optimism",
  137: "polygon",
};

interface KyberRouteSummary {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountInUsd?: string;
  amountOut: string;
  amountOutUsd?: string;
  gas?: string;
  gasUsd?: string;
}

interface KyberRouteResponse {
  code?: number;
  message?: string;
  data?: {
    routeSummary?: KyberRouteSummary;
    routerAddress?: string;
  };
}

interface KyberBuildResponse {
  code?: number;
  message?: string;
  data?: {
    amountIn?: string;
    amountOut?: string;
    data?: string;
    routerAddress?: string;
  };
}

export async function getKyberQuote(req: QuoteRequest): Promise<QuoteResult> {
  const slug = KYBER_CHAIN_SLUG[req.chainId];
  if (!slug) {
    return {
      router: "kyber",
      ok: false,
      error: "KyberSwap is not available on this chain.",
    };
  }
  try {
    const slippage = req.slippage ?? DEFAULT_SLIPPAGE;
    const slippageBps = Math.max(0, Math.round(slippage * 10_000));
    const rawFromAmount = parseUnits(req.fromAmount, req.fromDecimals).toString();
    const tokenIn = toEeeeNative(req.fromTokenAddress);
    const tokenOut = toEeeeNative(req.toTokenAddress);
    const isNativeIn = tokenIn === NATIVE_EEEE;

    const routeParams = new URLSearchParams({
      tokenIn,
      tokenOut,
      amountIn: rawFromAmount,
    });
    const routeRes = await fetch(
      `https://aggregator-api.kyberswap.com/${slug}/api/v1/routes?${routeParams.toString()}`,
      { headers: { "x-client-id": KYBER_CLIENT_ID } },
    );
    if (!routeRes.ok) {
      const body = await routeRes.text().catch(() => "");
      return { router: "kyber", ok: false, error: parseKyberError(routeRes.status, body) };
    }
    const routeJson = (await routeRes.json()) as KyberRouteResponse;
    if (routeJson.code !== 0 || !routeJson.data?.routeSummary) {
      return {
        router: "kyber",
        ok: false,
        error: routeJson.message || "No KyberSwap route available.",
      };
    }
    const summary = routeJson.data.routeSummary;

    const buildRes = await fetch(
      `https://aggregator-api.kyberswap.com/${slug}/api/v1/route/build`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": KYBER_CLIENT_ID,
        },
        body: JSON.stringify({
          routeSummary: summary,
          sender: req.fromAddress,
          recipient: req.fromAddress,
          slippageTolerance: slippageBps,
          source: KYBER_CLIENT_ID,
        }),
      },
    );
    if (!buildRes.ok) {
      const body = await buildRes.text().catch(() => "");
      return { router: "kyber", ok: false, error: parseKyberError(buildRes.status, body) };
    }
    const build = (await buildRes.json()) as KyberBuildResponse;
    if (build.code !== 0 || !build.data?.data || !build.data?.routerAddress) {
      return {
        router: "kyber",
        ok: false,
        error: build.message || "KyberSwap build failed.",
      };
    }

    const outAmount = BigInt(summary.amountOut);
    const minOut = outAmount - (outAmount * BigInt(slippageBps)) / 10_000n;
    const fromUsd = parseFloat(summary.amountInUsd ?? "0");
    const toUsd = parseFloat(summary.amountOutUsd ?? "0");
    const gasUsd = parseFloat(summary.gasUsd ?? "0");

    return {
      router: "kyber",
      ok: true,
      quote: {
        router: "kyber",
        toolName: "KyberSwap",
        fromAmountRaw: rawFromAmount,
        toAmountRaw: outAmount.toString(),
        toAmountMinRaw: minOut.toString(),
        estimatedGasUsd: Number.isFinite(gasUsd) && gasUsd > 0 ? gasUsd : undefined,
        fromAmountUsd: Number.isFinite(fromUsd) && fromUsd > 0 ? fromUsd : undefined,
        toAmountUsd: Number.isFinite(toUsd) && toUsd > 0 ? toUsd : undefined,
        approveTo: build.data.routerAddress as `0x${string}`,
        tx: {
          to: build.data.routerAddress as `0x${string}`,
          data: build.data.data as `0x${string}`,
          value: isNativeIn ? BigInt(rawFromAmount) : 0n,
        },
      },
    };
  } catch (e) {
    return {
      router: "kyber",
      ok: false,
      error: e instanceof Error ? e.message : "KyberSwap quote request failed",
    };
  }
}

function parseKyberError(status: number, body: string): string {
  if (status === 404) return "No KyberSwap route between these tokens.";
  if (status === 429) return "KyberSwap rate limit hit. Try again in a moment.";
  if (status >= 500) return "KyberSwap service is temporarily unavailable.";
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    /* ignore */
  }
  return `KyberSwap quote failed (HTTP ${status})`;
}

interface OdosQuoteResponse {
  pathId?: string;
  outAmounts?: string[];
  gasEstimateValue?: number;
  detail?: string;
  message?: string;
}

interface OdosAssembleResponse {
  transaction?: {
    to?: string;
    data?: string;
    value?: string | number;
    gas?: number;
  };
  detail?: string;
  message?: string;
}

// Odos handles tokens Li.Fi rejects (e.g. tokens with buy/sell transfer tax)
// and is used as a complementary aggregator. `pickBestQuote` chooses whichever
// router returns the most output. Referral code is optional.
export async function getOdosQuote(req: QuoteRequest): Promise<QuoteResult> {
  try {
    const slippage = req.slippage ?? DEFAULT_SLIPPAGE;
    const rawFromAmount = parseUnits(req.fromAmount, req.fromDecimals).toString();

    // Odos uses 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee for native, but
    // the all-zero address also works on the v2 SOR; we keep zeros for
    // consistency with Li.Fi.
    const referralCode = ODOS_REFERRAL_CODE_RAW
      ? Number(ODOS_REFERRAL_CODE_RAW)
      : undefined;

    const quoteRes = await fetch("https://api.odos.xyz/sor/quote/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chainId: req.chainId,
        inputTokens: [
          { tokenAddress: req.fromTokenAddress, amount: rawFromAmount },
        ],
        outputTokens: [
          { tokenAddress: req.toTokenAddress, proportion: 1 },
        ],
        userAddr: req.fromAddress,
        slippageLimitPercent: slippage * 100,
        ...(referralCode !== undefined && Number.isFinite(referralCode)
          ? { referralCode }
          : {}),
        compact: true,
      }),
    });

    if (!quoteRes.ok) {
      const body = await quoteRes.text().catch(() => "");
      return {
        router: "odos",
        ok: false,
        error: parseOdosError(quoteRes.status, body),
      };
    }
    const qd = (await quoteRes.json()) as OdosQuoteResponse;
    if (!qd.pathId || !qd.outAmounts?.[0]) {
      return {
        router: "odos",
        ok: false,
        error: qd.detail || qd.message || "No Odos route available.",
      };
    }

    const asmRes = await fetch("https://api.odos.xyz/sor/assemble", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAddr: req.fromAddress,
        pathId: qd.pathId,
        simulate: false,
      }),
    });
    if (!asmRes.ok) {
      const body = await asmRes.text().catch(() => "");
      return {
        router: "odos",
        ok: false,
        error: parseOdosError(asmRes.status, body),
      };
    }
    const asm = (await asmRes.json()) as OdosAssembleResponse;
    const tx = asm.transaction;
    if (!tx?.to || !tx?.data) {
      return {
        router: "odos",
        ok: false,
        error: asm.detail || asm.message || "Odos returned no transaction.",
      };
    }

    const outAmount = BigInt(qd.outAmounts[0]);
    const slippageBps = BigInt(Math.max(0, Math.round(slippage * 10_000)));
    const toAmountMin = outAmount - (outAmount * slippageBps) / 10_000n;

    return {
      router: "odos",
      ok: true,
      quote: {
        router: "odos",
        toolName: "Odos",
        fromAmountRaw: rawFromAmount,
        toAmountRaw: outAmount.toString(),
        toAmountMinRaw: toAmountMin.toString(),
        estimatedGasUsd:
          typeof qd.gasEstimateValue === "number" && qd.gasEstimateValue > 0
            ? qd.gasEstimateValue
            : undefined,
        approveTo: tx.to as `0x${string}`,
        tx: {
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: BigInt(tx.value ?? "0"),
        },
      },
    };
  } catch (e) {
    return {
      router: "odos",
      ok: false,
      error: e instanceof Error ? e.message : "Odos quote request failed",
    };
  }
}

function parseOdosError(status: number, body: string): string {
  if (status === 429) return "Odos rate limit hit. Try again in a moment.";
  if (status >= 500) return "Odos service is temporarily unavailable.";
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.detail === "string") return parsed.detail;
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    /* ignore */
  }
  return `Odos quote failed (HTTP ${status})`;
}

export async function getAllQuotes(req: QuoteRequest): Promise<QuoteResult[]> {
  // 0x is intentionally excluded from the parallel comparison for now —
  // its v2 endpoint always charges a ~0.15% volume fee on the user's output
  // which would silently undercut the other routers when it wins "auto".
  // Re-enable by adding `get0xQuote(req)` back to this Promise.all and
  // restoring the conditional `{ id: "0x", label: "0x" }` entry in
  // SELECTABLE_ROUTERS (artifacts/moats-pro/src/pages/swap.tsx).
  const results = await Promise.all([
    getLifiQuote(req),
    getOdosQuote(req),
    getKyberQuote(req),
  ]);
  return results;
}

export function pickBestQuote(results: QuoteResult[]): SwapQuote | null {
  let best: SwapQuote | null = null;
  for (const r of results) {
    if (!r.ok || !r.quote) continue;
    if (!best) {
      best = r.quote;
      continue;
    }
    if (BigInt(r.quote.toAmountRaw) > BigInt(best.toAmountRaw)) {
      best = r.quote;
    }
  }
  return best;
}

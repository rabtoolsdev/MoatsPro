import { parseUnits, type TypedDataDomain } from "viem";

export const FEE_WALLET = "0xe789b6fFdd63835F0Ee64D9d3e085244515230C6" as const;
export const FEE_BPS = 33;
export const FEE_DECIMAL = FEE_BPS / 10_000;
// `integrator` is always sent to Li.Fi for traffic attribution. The `fee`
// parameter requires the integrator to be REGISTERED + APPROVED on
// https://portal.li.fi/ with FEE_WALLET as the fee collector — sending it
// before approval makes Li.Fi reject every quote with "Integrator
// 'moats-pro' is not configured". Set VITE_LIFI_INTEGRATED_FEE=1 only after
// portal approval; until then we fall back to the manual 2-tx flow (user
// transfers the fee separately, then swaps).
export const INTEGRATOR_NAME = "moats-pro";
const LIFI_API_KEY = (import.meta.env.VITE_LIFI_API_KEY as string | undefined) ?? "";
const LIFI_INTEGRATED_FEE_ENABLED =
  (import.meta.env.VITE_LIFI_INTEGRATED_FEE as string | undefined) === "1";
// 0.0033 = 33 bps, must match FEE_BPS above.
const LIFI_FEE_DECIMAL = (FEE_BPS / 10_000).toString();
export const AVALANCHE_CHAIN_ID = 43114;
export const ETHEREUM_CHAIN_ID = 1;
export const BASE_CHAIN_ID = 8453;
// Chains where our aggregators can route (others — e.g. Avalanche subnets —
// don't have aggregator coverage and the swap UI gracefully disables).
export const SWAP_SUPPORTED_CHAIN_IDS: readonly number[] = [
  AVALANCHE_CHAIN_ID,
  ETHEREUM_CHAIN_ID,
  BASE_CHAIN_ID,
] as const;
export const DEFAULT_SLIPPAGE = 0.005;

export type RouterId = "lifi" | "0x" | "kyber";

export interface QuoteRequest {
  chainId: number;
  fromTokenAddress: `0x${string}`;
  toTokenAddress: `0x${string}`;
  /**
   * Full input amount in human units (pre-fee). Each router decides whether
   * to subtract the fee internally (manual) or pass through to the
   * aggregator's own fee mechanism (integrated).
   */
  fromAmount: string;
  fromDecimals: number;
  fromAddress: `0x${string}`;
  slippage?: number;
  /**
   * Integrator fee in basis points (e.g. 33 = 0.33%). When > 0:
   *  - Routers with native fee support (KyberSwap, 0x v2 permit2) include
   *    fee fields in their build call so the fee is skimmed atomically
   *    inside the swap tx. They set feeHandling="integrated".
   *  - Routers without (Li.Fi — would need portal registration) reduce
   *    their requested input by the fee amount, so the caller must transfer
   *    the fee separately before the swap. They set feeHandling="manual".
   */
  feeBps?: number;
  /** Wallet to receive the integrator fee. Required when feeBps > 0. */
  feeReceiver?: `0x${string}`;
}

export type FeeHandling = "manual" | "integrated";

export interface SwapQuote {
  router: RouterId;
  toolName: string;
  /**
   * Input amount the user's wallet will be debited *by this single swap tx*.
   *  - manual: post-fee amount (the fee was already / will be sent in a separate tx).
   *  - integrated: full pre-fee amount (the aggregator skims the fee in-tx).
   */
  fromAmountRaw: string;
  toAmountRaw: string;
  toAmountMinRaw: string;
  estimatedGasUsd?: number;
  fromAmountUsd?: number;
  toAmountUsd?: number;
  feeAmountRaw?: string;
  /**
   * How the integrator fee is collected for this quote. When "integrated"
   * the caller MUST NOT send a separate fee transfer; when "manual" it MUST.
   */
  feeHandling: FeeHandling;
  approveTo: `0x${string}`;
  tx: {
    to: `0x${string}`;
    data: `0x${string}`;
    value: bigint;
  };
  /**
   * Optional EIP-712 payload that must be signed BEFORE the swap tx is
   * sent. Currently used only by 0x v2 permit2 for ERC20 inputs — the
   * executor signs `eip712`, then appends `<32-byte sigLength><sig>` to
   * `tx.data` (per 0x docs) so the swap consumes the Permit2 allowance in
   * a single signature flow. Native sells don't need a permit so this is
   * absent for those.
   */
  permit2?: {
    eip712: {
      domain: TypedDataDomain;
      types: Record<string, Array<{ name: string; type: string }>>;
      primaryType: string;
      message: Record<string, unknown>;
    };
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

/**
 * Subtract the integrator fee from `fromAmount` and return the post-fee raw
 * amount that should be sent to aggregators which don't handle our fee
 * natively (Li.Fi). The caller (useExecuteSwap) is responsible for
 * transferring `feeRaw` to FEE_WALLET in a separate tx before the swap.
 */
function applyManualFee(req: QuoteRequest): { rawFromAmount: string; feeRaw: bigint } {
  const fullRaw = parseUnits(req.fromAmount, req.fromDecimals);
  const feeBps = req.feeBps ?? 0;
  const feeRaw = feeBps > 0 ? (fullRaw * BigInt(feeBps)) / 10_000n : 0n;
  return { rawFromAmount: (fullRaw - feeRaw).toString(), feeRaw };
}

export async function getLifiQuote(req: QuoteRequest): Promise<QuoteResult> {
  try {
    const slippage = req.slippage ?? DEFAULT_SLIPPAGE;
    // Integrated-fee mode: only when an API key is present (which implies the
    // integrator was registered on the Li.Fi portal with FEE_WALLET as the
    // fee collector). In that mode we send the FULL pre-fee amount and let
    // Li.Fi skim the fee inside the swap tx.
    const integrated =
      LIFI_INTEGRATED_FEE_ENABLED &&
      !!LIFI_API_KEY &&
      (req.feeBps ?? 0) > 0 &&
      !!req.feeReceiver;
    const rawFromAmount = integrated
      ? parseUnits(req.fromAmount, req.fromDecimals).toString()
      : applyManualFee(req).rawFromAmount;
    const params = new URLSearchParams({
      fromChain: String(req.chainId),
      toChain: String(req.chainId),
      fromToken: req.fromTokenAddress,
      toToken: req.toTokenAddress,
      fromAmount: rawFromAmount,
      fromAddress: req.fromAddress,
      integrator: INTEGRATOR_NAME,
      referrer: FEE_WALLET,
      slippage: slippage.toString(),
      ...(integrated ? { fee: LIFI_FEE_DECIMAL } : {}),
    });
    const res = await fetch(`https://li.quest/v1/quote?${params.toString()}`, {
      headers: LIFI_API_KEY ? { "x-lifi-api-key": LIFI_API_KEY } : undefined,
    });
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
        feeHandling: integrated ? "integrated" : "manual",
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

// Browser CANNOT call api.0x.org directly: 0x v2 requires the
// `0x-version: v2` header, which is not in their CORS allow-list, so every
// browser request is blocked by preflight. Instead we proxy through our
// api-server (`/api/0x/quote`), which holds the API key and adds the
// version header server-side. The client only needs to know the proxy
// base URL — VITE_0X_API_KEY is no longer required in the browser bundle.
const ZEROX_PROXY_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";
const KYBER_CLIENT_ID =
  (import.meta.env.VITE_KYBERSWAP_CLIENT_ID as string | undefined) ?? "moats-pro";

const NATIVE_ZERO = "0x0000000000000000000000000000000000000000";
// 0x and KyberSwap both use the canonical "eee…" sentinel for native;
// our internal token registry uses 0x0…0, so we translate at the boundary.
const NATIVE_EEEE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

function toEeeeNative(addr: `0x${string}`): string {
  return addr.toLowerCase() === NATIVE_ZERO ? NATIVE_EEEE : addr;
}

// 0x Swap API v2 (Permit2 flow). Native integrator-fee support via
// swapFeeRecipient/swapFeeBps/swapFeeToken — fee is skimmed in-tx, 100%
// goes to the recipient (no rev share with 0x). For ERC20 sells the
// response includes a `permit2.eip712` payload the user must sign; the
// signature is appended to `transaction.data` (per 0x docs) so the swap
// pulls funds via Permit2 in a single signature flow. Native sells
// (sellToken=0xeee…) don't need a permit and the tx is sent as-is.
const ZEROX_SUPPORTED_CHAIN_IDS = new Set<number>([
  1, 8453, 43114, 42161, 10, 137,
]);

interface ZeroxQuoteResponse {
  liquidityAvailable?: boolean;
  buyAmount?: string;
  sellAmount?: string;
  minBuyAmount?: string;
  totalNetworkFee?: string;
  // The canonical spender the user must grant ERC20 allowance to. For
  // /swap/permit2 this is ALWAYS the Permit2 contract
  // (0x000…22d473030f116ddee9f6b43ac78ba3). 0x returns it on every
  // response — whether or not the user already has allowance — so it's
  // the safe field to use for our approveTo. (`issues.allowance` is only
  // populated when allowance is INSUFFICIENT, so falling back to `tx.to`
  // when it's null sends the user to approve the wrong contract.)
  allowanceTarget?: string;
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
  permit2?: {
    type?: string;
    hash?: string;
    eip712?: {
      domain: TypedDataDomain;
      types: Record<string, Array<{ name: string; type: string }>>;
      primaryType: string;
      message: Record<string, unknown>;
    };
  } | null;
  fees?: {
    integratorFee?: { amount?: string; token?: string } | null;
  };
  validationErrors?: Array<{ reason?: string; description?: string }>;
  message?: string;
}

export async function get0xQuote(req: QuoteRequest): Promise<QuoteResult> {
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
    const feeBps = req.feeBps ?? 0;
    const wantsFee = feeBps > 0 && !!req.feeReceiver;
    // 0x v2 permit2 supports native integrator fees, so we always send the
    // FULL pre-fee amount and let 0x skim the fee from the BUY token in-tx.
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
    if (wantsFee) {
      params.set("swapFeeRecipient", req.feeReceiver as string);
      params.set("swapFeeBps", String(feeBps));
      // Charge the fee in the BUY token (output) — 0x requires
      // swapFeeToken to be either sellToken or buyToken.
      params.set("swapFeeToken", buyToken);
    }
    // Routed through our api-server proxy (see ZEROX_PROXY_BASE comment).
    const res = await fetch(
      `${ZEROX_PROXY_BASE}/0x/quote?${params.toString()}`,
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
    // For ERC20 sells, allowance must go to Permit2 (data.allowanceTarget).
    // The 0x router/settler at tx.to pulls funds via Permit2 and does NOT
    // need its own ERC20 allowance — falling back to tx.to here was the
    // root cause of users being prompted for a redundant second approval
    // after the Permit2 approval already confirmed.
    const approveTo = (data.allowanceTarget ??
      data.issues?.allowance?.spender ??
      tx.to) as `0x${string}`;
    const minBuyAmount = data.minBuyAmount ?? data.buyAmount;
    const integratorFeeAmount = data.fees?.integratorFee?.amount;
    return {
      router: "0x",
      ok: true,
      quote: {
        router: "0x",
        toolName: "0x",
        fromAmountRaw: rawFromAmount,
        toAmountRaw: data.buyAmount,
        toAmountMinRaw: minBuyAmount,
        feeHandling: wantsFee ? "integrated" : "manual",
        feeAmountRaw: integratorFeeAmount,
        approveTo,
        tx: {
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: BigInt(tx.value ?? "0"),
        },
        ...(data.permit2?.eip712 ? { permit2: { eip712: data.permit2.eip712 } } : {}),
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
    // KyberSwap supports integrator fees natively via feeAmount/chargeFeeBy/
    // isInBps/feeReceiver — passed to BOTH /routes (so amountOut reflects
    // post-fee output for fair comparison) and /route/build (so the encoded
    // tx actually skims the fee to feeReceiver inside the swap). When set,
    // we send the FULL pre-fee amount; the router handles the rest.
    const feeBps = req.feeBps ?? 0;
    const feeReceiver = req.feeReceiver;
    const integrated = feeBps > 0 && !!feeReceiver;
    const rawFromAmount = parseUnits(req.fromAmount, req.fromDecimals).toString();
    const tokenIn = toEeeeNative(req.fromTokenAddress);
    const tokenOut = toEeeeNative(req.toTokenAddress);
    const isNativeIn = tokenIn === NATIVE_EEEE;

    const feeFields: Record<string, string> = integrated
      ? {
          feeAmount: String(feeBps),
          chargeFeeBy: "currency_in",
          isInBps: "true",
          feeReceiver: feeReceiver as string,
        }
      : {};

    const routeParams = new URLSearchParams({
      tokenIn,
      tokenOut,
      amountIn: rawFromAmount,
      ...feeFields,
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
          ...(integrated
            ? {
                feeReceiver: feeReceiver as string,
                feeAmount: String(feeBps),
                chargeFeeBy: "currency_in",
                isInBps: true,
              }
            : {}),
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
        feeHandling: integrated ? "integrated" : "manual",
        feeAmountRaw: integrated
          ? ((BigInt(rawFromAmount) * BigInt(feeBps)) / 10_000n).toString()
          : undefined,
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

export async function getAllQuotes(req: QuoteRequest): Promise<QuoteResult[]> {
  const results = await Promise.all([
    getLifiQuote(req),
    get0xQuote(req),
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

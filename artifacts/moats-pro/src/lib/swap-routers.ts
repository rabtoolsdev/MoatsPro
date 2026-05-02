import { parseUnits } from "viem";

export const FEE_WALLET = "0x037a3b41975B44cF6038e48f1433831aB8810Af7" as const;
export const FEE_BPS = 33;
export const FEE_DECIMAL = FEE_BPS / 10_000;
// Note: `integrator`/`fee` are NOT sent to Li.Fi (would require portal
// registration on https://portal.li.fi/). We collect the 0.33% manually
// via a direct ERC20/native transfer to FEE_WALLET before each swap.
export const INTEGRATOR_NAME = "moats-pro";
export const AVALANCHE_CHAIN_ID = 43114;
export const DEFAULT_SLIPPAGE = 0.005;

export type RouterId = "lifi" | "0x" | "odos";

export interface QuoteRequest {
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
    toAmount: string;
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
      fromChain: String(AVALANCHE_CHAIN_ID),
      toChain: String(AVALANCHE_CHAIN_ID),
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
const ODOS_REFERRAL_CODE = (import.meta.env.VITE_ODOS_REFERRAL_CODE as string | undefined) ?? "";

export async function get0xQuote(_req: QuoteRequest): Promise<QuoteResult> {
  if (!ZEROX_API_KEY) {
    return {
      router: "0x",
      ok: false,
      error: "0x router not configured (VITE_0X_API_KEY missing).",
    };
  }
  return {
    router: "0x",
    ok: false,
    error: "0x router scaffolded — wiring pending. Using Li.Fi best route.",
  };
}

export async function getOdosQuote(_req: QuoteRequest): Promise<QuoteResult> {
  if (!ODOS_REFERRAL_CODE) {
    return {
      router: "odos",
      ok: false,
      error: "ODOS router not configured (VITE_ODOS_REFERRAL_CODE missing).",
    };
  }
  return {
    router: "odos",
    ok: false,
    error: "ODOS router scaffolded — wiring pending. Using Li.Fi best route.",
  };
}

export async function getAllQuotes(req: QuoteRequest): Promise<QuoteResult[]> {
  const results = await Promise.all([
    getLifiQuote(req),
    get0xQuote(req),
    getOdosQuote(req),
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

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useAccount,
  useSendTransaction,
  useSignTypedData,
  useWaitForTransactionReceipt,
} from "wagmi";
import { encodeFunctionData, erc20Abi, numberToHex, size } from "viem";
import {
  getAllQuotes,
  pickBestQuote,
  type QuoteRequest,
  type QuoteResult,
  type RouterId,
  type SwapQuote,
} from "@/lib/swap-routers";

export type RouterPreference = RouterId | "auto";

export interface UseSwapQuoteParams {
  chainId?: number;
  fromTokenAddress?: `0x${string}`;
  toTokenAddress?: `0x${string}`;
  /** Full pre-fee input the user wants to spend, in human units. */
  fromAmount?: string;
  fromDecimals?: number;
  enabled?: boolean;
  slippage?: number;
  /** Integrator fee in bps (e.g. 33 = 0.33%). Forwarded to each router. */
  feeBps?: number;
  /** Wallet that receives the integrator fee. Required when feeBps > 0. */
  feeReceiver?: `0x${string}`;
  /**
   * Router the user manually picked from the "Routed via" dropdown. When
   * "auto" (or omitted) we fall back to `pickBestQuote` (highest output).
   * When a specific router is selected we surface that router's quote even
   * if another aggregator returned a better price — the user's choice wins.
   */
  preferredRouter?: RouterPreference;
}

export interface UseSwapQuoteResult {
  /** The quote that will actually be executed — preferred router (if it has
   *  a quote) or auto-best otherwise. */
  best: SwapQuote | null;
  /** The highest-output quote across all routers, regardless of preference.
   *  Used by the UI to nudge the user toward a better route when their
   *  manual selection isn't the best one. */
  autoBest: SwapQuote | null;
  results: QuoteResult[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

const STALE_MS = 8_000;
const REFETCH_MS = 12_000;

export function useSwapQuote(params: UseSwapQuoteParams): UseSwapQuoteResult {
  const {
    chainId,
    fromTokenAddress,
    toTokenAddress,
    fromAmount,
    fromDecimals,
    enabled = true,
    slippage,
    feeBps,
    feeReceiver,
    preferredRouter,
  } = params;
  const { address } = useAccount();

  const reqEnabled =
    enabled &&
    !!chainId &&
    !!fromTokenAddress &&
    !!toTokenAddress &&
    !!fromAmount &&
    fromAmount !== "0" &&
    !!fromDecimals &&
    !!address;

  const queryKey = [
    "swap-quote",
    chainId,
    fromTokenAddress,
    toTokenAddress,
    fromAmount,
    fromDecimals,
    address,
    slippage,
    feeBps,
    feeReceiver,
  ];

  const query = useQuery<QuoteResult[]>({
    queryKey,
    enabled: reqEnabled,
    staleTime: STALE_MS,
    refetchInterval: REFETCH_MS,
    queryFn: async () => {
      if (!reqEnabled) return [];
      const req: QuoteRequest = {
        chainId: chainId!,
        fromTokenAddress: fromTokenAddress!,
        toTokenAddress: toTokenAddress!,
        fromAmount: fromAmount!,
        fromDecimals: fromDecimals!,
        fromAddress: address!,
        slippage,
        feeBps,
        feeReceiver,
      };
      return getAllQuotes(req);
    },
  });

  const results = query.data ?? [];
  const auto = pickBestQuote(results);
  let best: SwapQuote | null = auto;
  if (preferredRouter && preferredRouter !== "auto") {
    const picked = results.find(
      (r) => r.router === preferredRouter && r.ok && r.quote,
    );
    best = picked?.quote ?? null;
  }

  return {
    best,
    autoBest: auto,
    results,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}

export type SwapStep =
  | "idle"
  | "fee"
  | "fee-confirming"
  | "swap"
  | "swap-confirming"
  | "success"
  | "error";

export interface FeeTransfer {
  wallet: `0x${string}`;
  /** ERC20 contract address (or native sentinel) of the fee asset. */
  tokenAddress: `0x${string}`;
  amount: bigint;
  isNative: boolean;
}

export interface UseExecuteSwapResult {
  execute: (quote: SwapQuote, fee?: FeeTransfer | null) => Promise<void>;
  reset: () => void;
  step: SwapStep;
  feeHash?: `0x${string}`;
  swapHash?: `0x${string}`;
  hash?: `0x${string}`;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  feeReused: boolean;
  error: Error | null;
}

interface FeeCredit {
  key: string;
  feeHash: `0x${string}`;
}

function makeFeeKey(
  payer: `0x${string}` | undefined,
  chainId: number | undefined,
  fee: FeeTransfer,
): string | null {
  // Without a connected payer we can't safely attribute a credit, so refuse
  // to build a key — the caller will treat that as "no reuse possible".
  if (!payer) return null;
  return [
    payer.toLowerCase(),
    chainId ?? 0,
    fee.tokenAddress.toLowerCase(),
    fee.amount.toString(),
    fee.wallet.toLowerCase(),
  ].join("|");
}

/**
 * If the quote includes a 0x v2 permit2 EIP-712 payload, sign it and append
 * `<32-byte sigLength><sig>` to `tx.data` per 0x docs. Returns the modified
 * tx parameters ready for sendTransaction. Native sells (no permit2) pass
 * through unchanged.
 */
async function withPermit2Signature(
  quote: SwapQuote,
  signTypedDataAsync: ReturnType<typeof useSignTypedData>["signTypedDataAsync"],
): Promise<{ to: `0x${string}`; data: `0x${string}`; value: bigint }> {
  if (!quote.permit2?.eip712) {
    return { to: quote.tx.to, data: quote.tx.data, value: quote.tx.value };
  }
  // wagmi's useSignTypedData has very strict generic constraints on
  // `types`/`primaryType` derived from the literal type system; the 0x
  // payload is fully dynamic so we cast through `unknown` to satisfy the
  // checker without losing runtime correctness.
  const signature = await signTypedDataAsync({
    domain: quote.permit2.eip712.domain,
    types: quote.permit2.eip712.types,
    primaryType: quote.permit2.eip712.primaryType,
    message: quote.permit2.eip712.message,
  } as unknown as Parameters<typeof signTypedDataAsync>[0]);
  const sigLengthHex = numberToHex(size(signature), { signed: false, size: 32 });
  const data = (quote.tx.data + sigLengthHex.slice(2) + signature.slice(2)) as `0x${string}`;
  return { to: quote.tx.to, data, value: quote.tx.value };
}

export function useExecuteSwap(): UseExecuteSwapResult {
  const { address, chainId } = useAccount();
  const [step, setStep] = useState<SwapStep>("idle");
  const [feeHash, setFeeHash] = useState<`0x${string}` | undefined>();
  const [swapHash, setSwapHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<Error | null>(null);
  const [feeReused, setFeeReused] = useState(false);
  // Credit kept in component-state so a fee paid in attempt N can be reused
  // by attempt N+1 when the swap leg failed or the user cancelled the
  // simulation. Cleared once a swap finally succeeds.
  const [feeCredit, setFeeCredit] = useState<FeeCredit | null>(null);
  const pendingSwap = useRef<SwapQuote | null>(null);
  const pendingFeeKey = useRef<string | null>(null);

  const { sendTransactionAsync } = useSendTransaction();
  const { signTypedDataAsync } = useSignTypedData();
  const feeReceipt = useWaitForTransactionReceipt({ hash: feeHash });
  const swapReceipt = useWaitForTransactionReceipt({ hash: swapHash });

  // After fee confirms, store the credit (so a subsequent retry can skip the
  // fee tx) and send the swap tx.
  useEffect(() => {
    if (step !== "fee-confirming") return;
    if (!feeReceipt.isSuccess) return;
    if (pendingFeeKey.current && feeHash) {
      setFeeCredit({ key: pendingFeeKey.current, feeHash });
    }
    const quote = pendingSwap.current;
    if (!quote) return;
    setStep("swap");
    withPermit2Signature(quote, signTypedDataAsync)
      .then((tx) => sendTransactionAsync(tx))
      .then((hash) => {
        setSwapHash(hash);
        setStep("swap-confirming");
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e : new Error("Swap transaction failed"));
        setStep("error");
      });
  }, [step, feeReceipt.isSuccess, sendTransactionAsync, signTypedDataAsync, feeHash]);

  // After swap confirms, mark success and burn the fee credit — the next
  // swap is a brand-new intent and should pay its own fee.
  useEffect(() => {
    if (step === "swap-confirming" && swapReceipt.isSuccess) {
      setStep("success");
      setFeeCredit(null);
      pendingFeeKey.current = null;
    }
  }, [step, swapReceipt.isSuccess]);

  // Surface a failed receipt as an error. We deliberately do NOT clear
  // `feeCredit` here — keeping it lets the user retry without paying again.
  useEffect(() => {
    if (step === "fee-confirming" && feeReceipt.isError) {
      setError(feeReceipt.error ?? new Error("Fee transfer failed"));
      setStep("error");
    }
  }, [step, feeReceipt.isError, feeReceipt.error]);

  // Defense-in-depth: if the connected wallet changes (disconnect / switch
  // account), drop any credit so wallet B can never reuse a fee paid by
  // wallet A. The fee-key already binds the payer address, but clearing
  // here keeps stale state from leaking across sessions.
  useEffect(() => {
    setFeeCredit(null);
    pendingFeeKey.current = null;
  }, [address]);
  useEffect(() => {
    if (step === "swap-confirming" && swapReceipt.isError) {
      setError(swapReceipt.error ?? new Error("Swap transaction failed"));
      setStep("error");
    }
  }, [step, swapReceipt.isError, swapReceipt.error]);

  const execute = useCallback(
    async (quote: SwapQuote, fee?: FeeTransfer | null) => {
      setError(null);
      setSwapHash(undefined);
      setFeeReused(false);
      pendingSwap.current = quote;

      // Aggregator-integrated fee (KyberSwap with feeReceiver in calldata,
      // 0x v2 permit2 with swapFeeRecipient): the swap tx itself transfers
      // the fee atomically — sending a separate fee transfer here would
      // double-charge. The caller signals this by passing fee=null (or by
      // the quote.feeHandling === "integrated").
      const skipManualFee = !fee || quote.feeHandling === "integrated";

      try {
        if (!skipManualFee && fee && fee.amount > 0n) {
          const feeKey = makeFeeKey(address, chainId, fee);

          // If the user already paid this exact fee in a prior attempt that
          // failed (or was cancelled at simulation), skip straight to the
          // swap and reuse the stored fee hash for recording. The key is
          // bound to the connected payer so a different wallet can never
          // inherit another wallet's credit.
          if (feeKey && feeCredit && feeCredit.key === feeKey) {
            setFeeHash(feeCredit.feeHash);
            setFeeReused(true);
            setStep("swap");
            const tx = await withPermit2Signature(quote, signTypedDataAsync);
            const hash = await sendTransactionAsync(tx);
            setSwapHash(hash);
            setStep("swap-confirming");
            return;
          }

          setFeeHash(undefined);
          pendingFeeKey.current = feeKey;
          setStep("fee");
          const tx = fee.isNative
            ? { to: fee.wallet, value: fee.amount }
            : {
                to: fee.tokenAddress,
                data: encodeFunctionData({
                  abi: erc20Abi,
                  functionName: "transfer",
                  args: [fee.wallet, fee.amount],
                }),
                value: 0n,
              };
          const hash = await sendTransactionAsync(tx);
          setFeeHash(hash);
          setStep("fee-confirming");
          // Swap is dispatched by the effect once the fee receipt confirms.
        } else {
          setFeeHash(undefined);
          pendingFeeKey.current = null;
          setStep("swap");
          const tx = await withPermit2Signature(quote, signTypedDataAsync);
          const hash = await sendTransactionAsync(tx);
          setSwapHash(hash);
          setStep("swap-confirming");
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e : new Error("Transaction rejected or failed"));
        setStep("error");
      }
    },
    [sendTransactionAsync, signTypedDataAsync, address, chainId, feeCredit],
  );

  const reset = useCallback(() => {
    setStep("idle");
    setFeeHash(undefined);
    setSwapHash(undefined);
    setError(null);
    setFeeReused(false);
    pendingSwap.current = null;
  }, []);

  return {
    execute,
    reset,
    step,
    feeHash,
    swapHash,
    hash: swapHash ?? feeHash,
    isPending: step === "fee" || step === "swap",
    isConfirming: step === "fee-confirming" || step === "swap-confirming",
    isSuccess: step === "success",
    feeReused,
    error,
  };
}

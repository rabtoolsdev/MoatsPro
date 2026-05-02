import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { encodeFunctionData, erc20Abi } from "viem";
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
  fromAmount?: string;
  fromDecimals?: number;
  enabled?: boolean;
  slippage?: number;
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
  /** The auto-best quote regardless of preferredRouter — useful for showing
   *  "Auto picks Li.Fi" hints in the router dropdown. */
  autoBest: SwapQuote | null;
  results: QuoteResult[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useSwapQuote(params: UseSwapQuoteParams): UseSwapQuoteResult {
  const { address } = useAccount();
  const {
    chainId,
    fromTokenAddress,
    toTokenAddress,
    fromAmount,
    fromDecimals,
    enabled = true,
    slippage,
    preferredRouter = "auto",
  } = params;

  const validAmount =
    !!fromAmount && !Number.isNaN(parseFloat(fromAmount)) && parseFloat(fromAmount) > 0;

  const queryEnabled =
    !!enabled &&
    !!address &&
    !!chainId &&
    !!fromTokenAddress &&
    !!toTokenAddress &&
    fromTokenAddress.toLowerCase() !== toTokenAddress.toLowerCase() &&
    !!fromDecimals &&
    validAmount;

  const query = useQuery({
    queryKey: [
      "swap-quote",
      address,
      chainId,
      fromTokenAddress,
      toTokenAddress,
      fromAmount,
      fromDecimals,
      slippage,
    ],
    queryFn: async () => {
      const req: QuoteRequest = {
        chainId: chainId!,
        fromTokenAddress: fromTokenAddress!,
        toTokenAddress: toTokenAddress!,
        fromAmount: fromAmount!,
        fromDecimals: fromDecimals!,
        fromAddress: address!,
        slippage,
      };
      const results = await getAllQuotes(req);
      const best = pickBestQuote(results);
      return { results, best };
    },
    enabled: queryEnabled,
    refetchInterval: queryEnabled ? 20_000 : false,
    staleTime: 10_000,
    retry: 1,
  });

  const results = query.data?.results ?? [];
  const autoBest = query.data?.best ?? null;
  // Resolve the user's manual router pick. If they picked a specific router
  // and that router returned a quote, use it — even when another aggregator
  // beats it. If their pick failed (no quote), gracefully fall back to the
  // auto-best so the swap still works; the dropdown surfaces the warning.
  const manualPick =
    preferredRouter === "auto"
      ? null
      : results.find((r) => r.router === preferredRouter && r.ok)?.quote ?? null;
  const best = manualPick ?? autoBest;

  return {
    best,
    autoBest,
    results,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error as Error | null,
    refetch: () => query.refetch(),
  };
}

export interface FeeTransfer {
  wallet: `0x${string}`;
  amount: bigint;
  tokenAddress: `0x${string}`;
  isNative: boolean;
}

export type SwapStep =
  | "idle"
  | "fee"
  | "fee-confirming"
  | "swap"
  | "swap-confirming"
  | "success"
  | "error";

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
  /**
   * True when the most recent `execute()` reused a fee that the user had
   * already paid in a prior failed/cancelled attempt — i.e. they were not
   * charged again. Reset whenever a new `execute()` starts.
   */
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
    sendTransactionAsync({
      to: quote.tx.to,
      data: quote.tx.data,
      value: quote.tx.value,
    })
      .then((hash) => {
        setSwapHash(hash);
        setStep("swap-confirming");
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e : new Error("Swap transaction failed"));
        setStep("error");
      });
  }, [step, feeReceipt.isSuccess, sendTransactionAsync, feeHash]);

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

      try {
        if (fee && fee.amount > 0n) {
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
            const hash = await sendTransactionAsync({
              to: quote.tx.to,
              data: quote.tx.data,
              value: quote.tx.value,
            });
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
          const hash = await sendTransactionAsync({
            to: quote.tx.to,
            data: quote.tx.data,
            value: quote.tx.value,
          });
          setSwapHash(hash);
          setStep("swap-confirming");
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e : new Error("Transaction rejected or failed"));
        setStep("error");
      }
    },
    [sendTransactionAsync, address, chainId, feeCredit],
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

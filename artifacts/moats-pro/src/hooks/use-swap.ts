import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { encodeFunctionData, erc20Abi } from "viem";
import {
  getAllQuotes,
  pickBestQuote,
  type QuoteRequest,
  type QuoteResult,
  type SwapQuote,
} from "@/lib/swap-routers";

export interface UseSwapQuoteParams {
  chainId?: number;
  fromTokenAddress?: `0x${string}`;
  toTokenAddress?: `0x${string}`;
  fromAmount?: string;
  fromDecimals?: number;
  enabled?: boolean;
  slippage?: number;
}

export interface UseSwapQuoteResult {
  best: SwapQuote | null;
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

  return {
    best: query.data?.best ?? null,
    results: query.data?.results ?? [],
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
  error: Error | null;
}

export function useExecuteSwap(): UseExecuteSwapResult {
  const [step, setStep] = useState<SwapStep>("idle");
  const [feeHash, setFeeHash] = useState<`0x${string}` | undefined>();
  const [swapHash, setSwapHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState<Error | null>(null);
  const pendingSwap = useRef<SwapQuote | null>(null);

  const { sendTransactionAsync } = useSendTransaction();
  const feeReceipt = useWaitForTransactionReceipt({ hash: feeHash });
  const swapReceipt = useWaitForTransactionReceipt({ hash: swapHash });

  // After fee confirms, send the swap tx.
  useEffect(() => {
    if (step !== "fee-confirming") return;
    if (!feeReceipt.isSuccess) return;
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
  }, [step, feeReceipt.isSuccess, sendTransactionAsync]);

  // After swap confirms, mark success.
  useEffect(() => {
    if (step === "swap-confirming" && swapReceipt.isSuccess) {
      setStep("success");
    }
  }, [step, swapReceipt.isSuccess]);

  // Surface a failed receipt as an error.
  useEffect(() => {
    if (step === "fee-confirming" && feeReceipt.isError) {
      setError(feeReceipt.error ?? new Error("Fee transfer failed"));
      setStep("error");
    }
  }, [step, feeReceipt.isError, feeReceipt.error]);
  useEffect(() => {
    if (step === "swap-confirming" && swapReceipt.isError) {
      setError(swapReceipt.error ?? new Error("Swap transaction failed"));
      setStep("error");
    }
  }, [step, swapReceipt.isError, swapReceipt.error]);

  const execute = useCallback(
    async (quote: SwapQuote, fee?: FeeTransfer | null) => {
      setError(null);
      setFeeHash(undefined);
      setSwapHash(undefined);
      pendingSwap.current = quote;

      try {
        if (fee && fee.amount > 0n) {
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
    [sendTransactionAsync],
  );

  const reset = useCallback(() => {
    setStep("idle");
    setFeeHash(undefined);
    setSwapHash(undefined);
    setError(null);
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
    error,
  };
}

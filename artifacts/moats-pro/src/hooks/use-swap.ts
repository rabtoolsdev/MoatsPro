import { useQuery } from "@tanstack/react-query";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import {
  getAllQuotes,
  pickBestQuote,
  type QuoteRequest,
  type QuoteResult,
  type SwapQuote,
} from "@/lib/swap-routers";

export interface UseSwapQuoteParams {
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
    !!fromTokenAddress &&
    !!toTokenAddress &&
    fromTokenAddress.toLowerCase() !== toTokenAddress.toLowerCase() &&
    !!fromDecimals &&
    validAmount;

  const query = useQuery({
    queryKey: [
      "swap-quote",
      address,
      fromTokenAddress,
      toTokenAddress,
      fromAmount,
      fromDecimals,
      slippage,
    ],
    queryFn: async () => {
      const req: QuoteRequest = {
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

export function useExecuteSwap() {
  const { sendTransaction, data: hash, isPending, error, reset } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const execute = (quote: SwapQuote) => {
    sendTransaction({
      to: quote.tx.to,
      data: quote.tx.data,
      value: quote.tx.value,
    });
  };

  return { execute, hash, isPending, isConfirming, isSuccess, error, reset };
}

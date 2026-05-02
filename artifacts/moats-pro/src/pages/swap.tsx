import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { useAppKit, useAppKitNetwork } from "@reown/appkit/react";
import { formatUnits, parseUnits } from "viem";
import { ArrowDownUp, Check, ChevronDown, Loader2, Wallet, Zap } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import moatSwapLogo from "@assets/Moats_Logo_Swap_1777739220258.png";
import { Navbar } from "@/components/navbar";
import { TokenSelectModal } from "@/components/swap/token-select-modal";
import { TokenLogo } from "@/components/swap/token-logo";
import { SlippageSettings } from "@/components/swap/slippage-settings";
import {
  getBaseTokensForChain,
  deriveMoatTokens,
  isNativeToken,
  type MoatToken,
} from "@/lib/moat-tokens";
import {
  AVALANCHE_CHAIN_ID,
  FEE_BPS,
  FEE_WALLET,
  SWAP_SUPPORTED_CHAIN_IDS,
  type QuoteResult,
  type RouterId,
  type SwapQuote,
} from "@/lib/swap-routers";
import { networks, CHAIN_DISPLAY } from "@/lib/wagmi-config";
import { useAllMoatConfigs } from "@/hooks/use-moats-api";
import { MOAT_LOGO_ABI } from "@/lib/moat-abi";
import {
  useTokenAllowance,
  useTokenBalance,
  useApproveToken,
  useSwapFromBalance,
} from "@/hooks/use-moat-contract";
import {
  useSwapQuote,
  useExecuteSwap,
  type FeeTransfer,
  type RouterPreference,
} from "@/hooks/use-swap";
import { useSlippage } from "@/hooks/use-slippage";
import { useWalletAssetBalances } from "@/hooks/use-wallet-assets";
import { useToast } from "@/hooks/use-toast";
import { recordSwap } from "@/lib/admin-api";

type Side = "from" | "to";

export default function Swap() {
  const { isConnected, address } = useAccount();
  const { open } = useAppKit();
  const { chainId: rawChainId, switchNetwork } = useAppKitNetwork();
  const { toast } = useToast();

  // Normalize chainId to a number (AppKit may surface a string).
  const activeChainId = useMemo(() => {
    if (rawChainId == null) return undefined;
    const n = typeof rawChainId === "number" ? rawChainId : Number(rawChainId);
    return Number.isFinite(n) ? n : undefined;
  }, [rawChainId]);

  // Network key the Moats API uses (e.g. "avalanche", "ethereum", "base"),
  // derived from the wallet's connected chain. Falls back to Avalanche so
  // the UI stays useful before a wallet is connected.
  const networkKey = activeChainId
    ? CHAIN_DISPLAY[activeChainId]?.network ?? "avalanche"
    : "avalanche";

  // Aggregator coverage gate. Subnets (Grotto, Blaze) aren't in Li.Fi/Odos.
  const isSwapSupported =
    !!activeChainId && SWAP_SUPPORTED_CHAIN_IDS.includes(activeChainId);

  // Base assets shown to the user are pulled from the *connected* chain so
  // they swap with what they actually hold (AVAX/USDC on Avalanche, ETH/USDC
  // on Ethereum, ETH/USDC on Base, etc.).
  const baseTokens = useMemo(
    () => getBaseTokensForChain(activeChainId ?? AVALANCHE_CHAIN_ID),
    [activeChainId],
  );

  const { data: moats } = useAllMoatConfigs();
  const rawMoatTokens = useMemo(
    () => deriveMoatTokens(moats, networkKey),
    [moats, networkKey],
  );

  // Pull moat-token logos from the same on-chain source the Explore and
  // Portfolio pages use: every moat contract exposes a getLogoURL() and we
  // simply mirror it. A token may be backed by multiple moat contracts, so
  // we use the first non-empty result.
  const logoContracts = useMemo(() => {
    if (!moats) return [];
    return moats.map((c) => ({
      address: c.contractAddress as `0x${string}`,
      abi: MOAT_LOGO_ABI,
      functionName: "getLogoURL" as const,
    }));
  }, [moats]);

  const { data: logoData } = useReadContracts({
    contracts: logoContracts,
    query: {
      enabled: logoContracts.length > 0,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  });

  const moatLogoByContract = useMemo((): Record<string, string> => {
    if (!logoData || !moats) return {};
    const m: Record<string, string> = {};
    moats.forEach((c, i) => {
      const r = logoData[i];
      if (r?.status === "success" && typeof r.result === "string" && r.result.length > 0) {
        m[c.contractAddress.toLowerCase()] = r.result;
      }
    });
    return m;
  }, [logoData, moats]);

  const moatTokens = useMemo(() => {
    if (Object.keys(moatLogoByContract).length === 0) return rawMoatTokens;
    return rawMoatTokens.map((t) => {
      for (const ca of t.moatContractAddresses) {
        const logo = moatLogoByContract[ca.toLowerCase()];
        if (logo) return { ...t, logoUrl: logo };
      }
      return t;
    });
  }, [rawMoatTokens, moatLogoByContract]);
  // Both sides accept the full token universe — base assets + moat-backed
  // tokens for the *current* chain. This makes the swap symmetric (e.g. buy
  // a moat token with the chain's native asset, or sell it back).
  const allTokens = useMemo(
    () => [...baseTokens, ...moatTokens],
    [baseTokens, moatTokens]
  );
  const fromTokens = allTokens;
  const toTokens = allTokens;
  const { slippage, setSlippage } = useSlippage();

  const [fromToken, setFromToken] = useState<MoatToken | null>(
    baseTokens[0] ?? null,
  );
  const [toToken, setToToken] = useState<MoatToken | null>(null);
  const [amount, setAmount] = useState("");
  const [pickerSide, setPickerSide] = useState<Side | null>(null);
  const [flipCount, setFlipCount] = useState(0);
  // Manual router override. "auto" lets pickBestQuote choose the best output;
  // any specific router id forces the quote/tx through that aggregator even
  // if another would have priced higher.
  const [preferredRouter, setPreferredRouter] = useState<RouterPreference>("auto");

  // When the user switches networks the previously-selected tokens belong
  // to the wrong chain — reset to that chain's defaults so we never quote
  // an Avalanche token while the wallet is on Ethereum (etc.).
  useEffect(() => {
    setFromToken(baseTokens[0] ?? null);
    setToToken(null);
    setAmount("");
  }, [activeChainId, baseTokens]);

  // Pre-select first moat token for "to" side once loaded
  useEffect(() => {
    if (moatTokens.length >= 1 && !toToken) {
      setToToken(moatTokens[0]);
    }
  }, [moatTokens, toToken]);

  // Keep the currently-selected fromToken/toToken in sync with the latest
  // token list. moatTokens initially contains the raw entries (no
  // DexScreener logo yet) and rebuilds with real `logoUrl` values once
  // useDexscreenerInfo resolves — without this re-sync the selected token
  // would keep its stale placeholder logo until the user re-picks it from
  // the modal. Match by address (allTokens is already chain-scoped).
  useEffect(() => {
    if (fromToken) {
      const fresh = allTokens.find(
        (t) => t.address.toLowerCase() === fromToken.address.toLowerCase(),
      );
      if (fresh && fresh.logoUrl !== fromToken.logoUrl) setFromToken(fresh);
    }
    if (toToken) {
      const fresh = allTokens.find(
        (t) => t.address.toLowerCase() === toToken.address.toLowerCase(),
      );
      if (fresh && fresh.logoUrl !== toToken.logoUrl) setToToken(fresh);
    }
  }, [allTokens, fromToken, toToken]);

  const fromBal = useSwapFromBalance(fromToken);
  const toBal = useTokenBalance(toToken?.address);
  const fromDecimals = (fromBal.decimals as number | undefined) ?? fromToken?.decimals ?? 18;
  const toDecimals = (toBal.decimals as number | undefined) ?? toToken?.decimals ?? 18;
  const isFromNative = !!fromToken && isNativeToken(fromToken.address);

  // Wallet balances for the "You pay" picker (auto-shows assets the user
  // holds on the currently connected chain).
  const { balances: walletBalances } = useWalletAssetBalances(
    fromTokens,
    activeChainId,
  );

  const amountRaw = useMemo(() => {
    try {
      if (!amount || !fromDecimals) return 0n;
      const n = parseFloat(amount);
      if (!Number.isFinite(n) || n <= 0) return 0n;
      return parseUnits(amount as `${number}`, fromDecimals);
    } catch {
      return 0n;
    }
  }, [amount, fromDecimals]);

  // Manual fee skim: 0.33% goes directly to FEE_WALLET; the rest gets swapped.
  // Li.Fi can't auto-collect fees without portal registration, so we collect it
  // ourselves via a separate ERC20 / native transfer before the swap.
  const feeRaw = useMemo(
    () => (amountRaw * BigInt(FEE_BPS)) / 10_000n,
    [amountRaw],
  );
  const swapRaw = useMemo(() => amountRaw - feeRaw, [amountRaw, feeRaw]);
  const swapAmountStr = useMemo(() => {
    if (swapRaw <= 0n) return "";
    return formatUnits(swapRaw, fromDecimals);
  }, [swapRaw, fromDecimals]);

  const quote = useSwapQuote({
    chainId: activeChainId,
    fromTokenAddress: fromToken?.address,
    toTokenAddress: toToken?.address,
    fromAmount: swapAmountStr,
    fromDecimals,
    slippage,
    preferredRouter,
    enabled: isSwapSupported && isConnected,
  });

  const allowance = useTokenAllowance(
    isFromNative ? undefined : fromToken?.address,
    quote.best?.approveTo
  );

  const approver = useApproveToken(isFromNative ? undefined : fromToken?.address);
  const executor = useExecuteSwap();

  const balanceRaw = (fromBal.balance as bigint | undefined) ?? 0n;
  const insufficient = amountRaw > 0n && balanceRaw < amountRaw;

  const allowanceRaw = (allowance.data as bigint | undefined) ?? 0n;
  const needsApproval =
    !isFromNative &&
    !!quote.best &&
    swapRaw > 0n &&
    allowanceRaw < swapRaw;

  // Toast on swap success + record to admin DB.
  useEffect(() => {
    if (!executor.isSuccess) return;
    toast({
      title: "Swap complete",
      description: "Your tokens have arrived in your wallet.",
    });
    // Best-effort record. We capture closure values BEFORE reset() clears them.
    if (
      address &&
      activeChainId &&
      fromToken &&
      toToken &&
      executor.swapHash &&
      quote.best
    ) {
      const fromAmtNum = parseFloat(formatUnits(amountRaw, fromDecimals));
      const toAmtNum = parseFloat(formatUnits(BigInt(quote.best.toAmountRaw), toDecimals));
      const feeAmtNum = parseFloat(formatUnits(feeRaw, fromDecimals));

      // Stablecoin fallback: if the router didn't return USD pricing (Odos),
      // derive it from whichever side is a known dollar-pegged token.
      const STABLES = new Set([
        "USDC", "USDT", "DAI", "BUSD", "FRAX", "LUSD",
        "USDC.E", "USDT.E", "USDBC", "PYUSD", "USDS",
      ]);
      const fromIsStable = STABLES.has(fromToken.symbol.toUpperCase());
      const toIsStable = STABLES.has(toToken.symbol.toUpperCase());

      let postFeeFromUsd = quote.best.fromAmountUsd;
      let toUsd = quote.best.toAmountUsd;
      if (postFeeFromUsd === undefined && fromIsStable) {
        // Post-fee input AVAX→USD: amountRaw - feeRaw, in stablecoin units = USD.
        postFeeFromUsd = fromAmtNum - feeAmtNum;
      }
      if (toUsd === undefined && toIsStable) {
        toUsd = toAmtNum;
      }
      // If we still don't have post-fee USD but we know the output USD, use it
      // as a proxy (≈ post-fee input minus slippage; close enough for accounting).
      if (postFeeFromUsd === undefined && toUsd !== undefined) {
        postFeeFromUsd = toUsd;
      }

      // Scale post-fee USD up by 1/(1-feeBps) to recover the full-input USD.
      const fullFromUsd =
        postFeeFromUsd !== undefined ? postFeeFromUsd / (1 - FEE_BPS / 10_000) : undefined;
      const feeUsd =
        fullFromUsd !== undefined ? fullFromUsd * (FEE_BPS / 10_000) : undefined;
      void recordSwap({
        walletAddress: address,
        chainId: activeChainId,
        network: networkKey,
        txHash: executor.swapHash,
        feeTxHash: executor.feeHash ?? null,
        fromTokenSymbol: fromToken.symbol,
        fromTokenAddress: fromToken.address,
        fromTokenDecimals: fromDecimals,
        toTokenSymbol: toToken.symbol,
        toTokenAddress: toToken.address,
        toTokenDecimals: toDecimals,
        fromAmountRaw: amountRaw.toString(),
        toAmountRaw: quote.best.toAmountRaw,
        feeAmountRaw: feeRaw.toString(),
        fromAmount: fromAmtNum,
        toAmount: toAmtNum,
        feeAmount: feeAmtNum,
        fromUsd: fullFromUsd ?? null,
        toUsd: toUsd ?? null,
        feeUsd: feeUsd ?? null,
        router: quote.best.router,
        toolName: quote.best.toolName ?? null,
        slippageBps: Math.round((slippage ?? 0.005) * 10_000),
        status: "success",
      });
    }
    setAmount("");
    executor.reset();
  }, [executor.isSuccess]);

  // Toast on approve success → refetch allowance
  useEffect(() => {
    if (approver.isSuccess) {
      toast({ title: "Approval confirmed", description: "You can now run the swap." });
      void allowance.refetch();
    }
  }, [approver.isSuccess]);

  useEffect(() => {
    if (executor.error) {
      toast({
        title: "Swap failed",
        description: executor.error.message ?? "Transaction rejected or failed.",
        variant: "destructive",
      });
    }
  }, [executor.error]);

  // Reassure the user when we skip the fee transfer because they already
  // paid for this exact swap intent in a previous attempt.
  useEffect(() => {
    if (executor.feeReused) {
      toast({
        title: "Reusing fee from your previous attempt",
        description: "You won't be charged the swap fee again.",
      });
    }
  }, [executor.feeReused]);

  useEffect(() => {
    if (approver.error) {
      toast({
        title: "Approval failed",
        description: approver.error.message ?? "Transaction rejected or failed.",
        variant: "destructive",
      });
    }
  }, [approver.error]);

  const canFlip = !!fromToken && !!toToken;

  const flip = () => {
    if (!canFlip) return;
    const a = fromToken;
    setFromToken(toToken);
    setToToken(a);
    setAmount("");
    setFlipCount((c) => c + 1);
  };

  const setMax = () => {
    if (!fromBal.formatted) return;
    setAmount(fromBal.formatted);
  };

  const handleApprove = () => {
    if (!fromToken || !quote.best || swapRaw <= 0n) return;
    // Approve only the amount that actually goes through Li.Fi (post-fee).
    approver.approve(quote.best.approveTo, swapAmountStr, fromDecimals);
  };

  const handleSwap = () => {
    if (!quote.best || !fromToken || feeRaw <= 0n) return;
    const fee: FeeTransfer = {
      wallet: FEE_WALLET,
      amount: feeRaw,
      tokenAddress: fromToken.address,
      isNative: isFromNative,
    };
    void executor.execute(quote.best, fee);
  };

  const toAmountFormatted = quote.best
    ? formatUnits(BigInt(quote.best.toAmountRaw), toDecimals)
    : "";
  const toAmountMinFormatted = quote.best
    ? formatUnits(BigInt(quote.best.toAmountMinRaw), toDecimals)
    : "";

  const rate = useMemo(() => {
    if (!quote.best || !fromToken || !toToken) return null;
    const out = parseFloat(formatUnits(BigInt(quote.best.toAmountRaw), toDecimals));
    const inp = parseFloat(formatUnits(BigInt(quote.best.fromAmountRaw), fromDecimals));
    if (!inp || !Number.isFinite(out / inp)) return null;
    return out / inp;
  }, [quote.best, fromToken, toToken, fromDecimals, toDecimals]);

  // Surface a route error only when no router could quote at all. Treat
  // stub/"not configured" errors (0x) as silent so they don't drown out the
  // real reason from Li.Fi or Odos.
  const allRoutersFailed =
    !quote.isLoading &&
    !quote.best &&
    quote.results.length > 0 &&
    quote.results.every((r) => !r.ok);
  const routeError = (() => {
    if (!allRoutersFailed) return undefined;
    const lifi = quote.results.find((r) => r.router === "lifi" && !r.ok)?.error;
    const odos = quote.results.find((r) => r.router === "odos" && !r.ok)?.error;
    return lifi ?? odos;
  })();

  // ---------- UI ----------
  const buttonState = (() => {
    if (!isConnected)
      return { label: "Connect Wallet", action: () => open({ view: "Connect" }), disabled: false, primary: true };
    if (!isSwapSupported)
      return {
        label: "Switch to a supported chain",
        action: () => {
          const avax = networks.find((n) => Number(n.id) === AVALANCHE_CHAIN_ID);
          if (avax && typeof switchNetwork === "function") switchNetwork(avax);
        },
        disabled: false,
        primary: true,
      };
    if (!fromToken || !toToken) return { label: "Select tokens", disabled: true };
    if (!amount || amountRaw === 0n) return { label: "Enter an amount", disabled: true };
    if (insufficient)
      return { label: `Insufficient ${fromToken.symbol}`, disabled: true };
    if (quote.isLoading || quote.isFetching)
      return { label: "Fetching best route…", disabled: true, loading: true };
    if (!quote.best)
      return { label: "No route available", disabled: true };
    if (needsApproval) {
      if (approver.isPending || approver.isConfirming)
        return { label: "Approving…", disabled: true, loading: true };
      return {
        label: `Approve ${fromToken.symbol}`,
        action: handleApprove,
        disabled: false,
        primary: true,
      };
    }
    if (executor.step === "fee")
      return { label: "Sending fee…", disabled: true, loading: true };
    if (executor.step === "fee-confirming")
      return { label: "Confirming fee…", disabled: true, loading: true };
    if (executor.step === "swap")
      return { label: "Swapping…", disabled: true, loading: true };
    if (executor.step === "swap-confirming")
      return { label: "Confirming swap…", disabled: true, loading: true };
    return { label: "Swap", action: handleSwap, disabled: false, primary: true };
  })();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-28 sm:pt-32 pb-24 px-4 max-w-xl mx-auto">
        <div className="mb-6 flex justify-center">
          <img
            src={moatSwapLogo}
            alt="The Moats Swap"
            className="h-20 sm:h-24 w-auto select-none drop-shadow-[0_4px_24px_rgba(0,212,255,0.18)]"
            draggable={false}
          />
        </div>

        <div className="relative">
          <div className="swap-halo" aria-hidden />
          <div
            className="relative z-10 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-2xl shadow-black/30 p-4 sm:p-5 card-glow"
            data-testid="swap-card"
          >
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              You pay
            </div>
            <SlippageSettings slippage={slippage} onChange={setSlippage} />
          </div>

          <TokenInput
            token={fromToken}
            balance={fromBal.formatted}
            value={amount}
            onChange={setAmount}
            onPick={() => setPickerSide("from")}
            onMax={setMax}
            showMax
            isInsufficient={insufficient}
          />

          <div className="flex justify-center my-2 relative">
            <div className="h-px w-full bg-border/40 absolute top-1/2" />
            <button
              onClick={flip}
              disabled={!canFlip}
              data-testid="btn-flip-tokens"
              title={canFlip ? "Flip tokens" : "Pick both tokens first"}
              className={`relative z-10 w-9 h-9 rounded-full border border-border bg-card transition-all duration-200 flex items-center justify-center group ${
                canFlip
                  ? "hover:border-primary/60 hover:bg-primary/10 hover:text-primary hover:shadow-[0_0_18px_rgba(0,212,255,0.35)] active:scale-90"
                  : "opacity-40 cursor-not-allowed"
              }`}
              aria-label="Flip tokens"
            >
              <ArrowDownUp
                size={14}
                style={{ transform: `rotate(${flipCount * 180}deg)` }}
                className={`text-muted-foreground transition-transform duration-300 ease-out ${canFlip ? "group-hover:text-primary" : ""}`}
              />
            </button>
          </div>

          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-1 mb-1">
            You receive
          </div>

          <TokenInput
            token={toToken}
            balance={toBal.formatted}
            value={toAmountFormatted}
            onChange={() => {}}
            onPick={() => setPickerSide("to")}
            readOnly
            isLoading={quote.isFetching && amountRaw > 0n}
          />

          {/* Quote details */}
          <div
            key={quote.best ? quote.best.toAmountRaw : "no-quote"}
            className={`mt-4 px-1 space-y-1.5 ${quote.best ? "fade-rise" : ""}`}
          >
            {quote.best && rate && fromToken && toToken && (
              <Row
                label="Rate"
                value={`1 ${fromToken.symbol} ≈ ${formatNumber(rate)} ${toToken.symbol}`}
              />
            )}
            {quote.best && (
              <Row
                label="Min received"
                value={`${formatNumber(parseFloat(toAmountMinFormatted))} ${toToken?.symbol ?? ""}`}
              />
            )}
            <Row label="Moat fee" value={`${(FEE_BPS / 100).toFixed(2)}%`} />
            {(quote.best || quote.results.length > 0) && (
              <Row
                label="Routed via"
                value={
                  <RouterSelector
                    preferred={preferredRouter}
                    onChange={setPreferredRouter}
                    results={quote.results}
                    autoBest={quote.autoBest}
                    activeQuote={quote.best}
                    toDecimals={toDecimals}
                    toSymbol={toToken?.symbol}
                  />
                }
              />
            )}
            {routeError && (
              <div className="text-[11px] text-amber-400/90 mt-2 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                {routeError}
              </div>
            )}
          </div>

          {/* Action button */}
          <button
            onClick={buttonState.action}
            disabled={buttonState.disabled}
            data-testid="btn-swap-action"
            className={`w-full mt-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              buttonState.disabled
                ? "bg-muted/40 text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(0,212,255,0.35)] btn-shimmer"
            }`}
          >
            {buttonState.loading && <Loader2 size={14} className="animate-spin" />}
            {buttonState.label}
          </button>

          <div className="mt-3 text-[10px] text-muted-foreground/70 text-center flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/80 live-dot" aria-hidden />
            <span>Quotes auto-refresh every 20s · Aggregating across 0x, ODOS, KyberSwap, ParaSwap &amp; more via Li.Fi</span>
          </div>
          </div>
        </div>
      </div>

      <TokenSelectModal
        open={pickerSide !== null}
        onClose={() => setPickerSide(null)}
        onSelect={(t) => {
          // If the user picks the same token that's on the other side,
          // swap them so the pair never has duplicates.
          if (pickerSide === "from") {
            if (toToken && t.address.toLowerCase() === toToken.address.toLowerCase()) {
              setToToken(fromToken);
            }
            setFromToken(t);
          } else if (pickerSide === "to") {
            if (fromToken && t.address.toLowerCase() === fromToken.address.toLowerCase()) {
              setFromToken(toToken);
            }
            setToToken(t);
          }
        }}
        tokens={pickerSide === "from" ? fromTokens : toTokens}
        excludeAddress={pickerSide === "from" ? toToken?.address : fromToken?.address}
        title={pickerSide === "from" ? "Pay with" : "Receive"}
        balances={walletBalances}
        showBalances
        footerLabel={`${allTokens.length} tokens · base + moat-backed`}
      />
    </div>
  );
}

function TokenInput({
  token,
  balance,
  value,
  onChange,
  onPick,
  onMax,
  showMax,
  readOnly,
  isLoading,
  isInsufficient,
}: {
  token: MoatToken | null;
  balance?: string;
  value: string;
  onChange: (v: string) => void;
  onPick: () => void;
  onMax?: () => void;
  showMax?: boolean;
  readOnly?: boolean;
  isLoading?: boolean;
  isInsufficient?: boolean;
}) {
  return (
    <div
      className={`swap-input-glow rounded-xl border p-3.5 transition-all duration-200 ${
        isInsufficient
          ? "border-rose-500/40 bg-rose-500/5"
          : "border-border/40 bg-muted/10 hover:border-border/60"
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onPick}
          data-testid={`btn-pick-token-${readOnly ? "to" : "from"}`}
          className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-card/80 border border-border hover:border-primary/60 hover:bg-card transition-all shrink-0"
        >
          {token ? (
            <>
              <TokenLogo
                address={token.address}
                symbol={token.symbol}
                hint={token.logoUrl}
                size={24}
              />
              <span className="text-sm font-semibold">{token.symbol}</span>
            </>
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">Select</span>
          )}
          <ChevronDown size={13} className="text-muted-foreground" />
        </button>

        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="h-7 w-32 ml-auto rounded bg-muted/30 animate-pulse" />
          ) : (
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={value}
              onChange={(e) => {
                const v = e.target.value.replace(/,/g, ".");
                if (v === "" || /^[0-9]*\.?[0-9]*$/.test(v)) onChange(v);
              }}
              readOnly={readOnly}
              data-testid={`input-amount-${readOnly ? "to" : "from"}`}
              className="w-full bg-transparent text-right text-2xl font-semibold tracking-tight focus:outline-none placeholder:text-muted-foreground/40"
            />
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
        <div className="flex items-center gap-1">
          <Wallet size={11} />
          <span>
            {balance !== undefined ? formatNumber(parseFloat(balance)) : "—"}
            {token && <span className="ml-1 text-muted-foreground/60">{token.symbol}</span>}
          </span>
        </div>
        {showMax && balance && parseFloat(balance) > 0 && onMax && (
          <button
            onClick={onMax}
            data-testid="btn-max"
            className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide text-primary hover:bg-primary/10 transition-colors"
          >
            Max
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground/90 font-medium">{value}</span>
    </div>
  );
}

// Routers we expose in the manual selector. Order = display order in dropdown.
// 0x is omitted because the integration is currently scaffolded only and never
// returns a real quote — surfacing it would just be a permanently-disabled item.
const SELECTABLE_ROUTERS: { id: RouterId; label: string }[] = [
  { id: "lifi", label: "Li.Fi" },
  { id: "odos", label: "Odos" },
];

function routerLabel(id: RouterId): string {
  return SELECTABLE_ROUTERS.find((r) => r.id === id)?.label ?? id;
}

interface RouterSelectorProps {
  preferred: RouterPreference;
  onChange: (next: RouterPreference) => void;
  results: QuoteResult[];
  autoBest: SwapQuote | null;
  activeQuote: SwapQuote | null;
  toDecimals: number;
  toSymbol?: string;
}

function RouterSelector({
  preferred,
  onChange,
  results,
  autoBest,
  activeQuote,
  toDecimals,
  toSymbol,
}: RouterSelectorProps) {
  // Trigger label: shows the router whose quote is currently driving the swap.
  // When in auto mode we annotate which aggregator auto picked.
  const triggerRouter = activeQuote?.router;
  const triggerToolName = activeQuote?.toolName;
  const isManual = preferred !== "auto";
  const usedFallback = isManual && triggerRouter !== preferred;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="btn-router-selector"
        className="group flex items-center gap-1.5 px-2 py-1 -my-1 rounded-md hover:bg-muted/40 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="relative flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">
          {preferred === "auto" ? (
            <Zap size={10} className="-ml-0.5" aria-hidden />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-primary live-dot" aria-hidden />
          )}
          {preferred === "auto"
            ? `Auto${triggerRouter ? ` · ${routerLabel(triggerRouter)}` : ""}`
            : routerLabel(preferred)}
        </span>
        {triggerToolName && (
          <span className="text-muted-foreground/80 truncate max-w-[120px] text-[11px]">
            via {triggerToolName}
          </span>
        )}
        <ChevronDown
          size={12}
          className="text-muted-foreground/70 group-hover:text-foreground transition-colors"
          aria-hidden
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-60 bg-popover/95 backdrop-blur border-border/60"
      >
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          Route quote through
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Auto — picks the router with the highest output */}
        <DropdownMenuItem
          data-testid="router-option-auto"
          onSelect={() => onChange("auto")}
          className="flex items-start gap-2 cursor-pointer"
        >
          <Check
            size={14}
            className={`mt-0.5 shrink-0 ${preferred === "auto" ? "text-primary" : "opacity-0"}`}
            aria-hidden
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Zap size={11} className="text-primary" aria-hidden />
              Auto (best price)
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {autoBest
                ? `Currently ${routerLabel(autoBest.router)} · ${formatNumber(parseFloat(formatUnits(BigInt(autoBest.toAmountRaw), toDecimals)))} ${toSymbol ?? ""}`
                : "Picks the highest-output aggregator"}
            </div>
          </div>
        </DropdownMenuItem>

        {SELECTABLE_ROUTERS.map(({ id, label }) => {
          const result = results.find((r) => r.router === id);
          const ok = !!result?.ok && !!result.quote;
          const out = ok && result?.quote
            ? formatNumber(parseFloat(formatUnits(BigInt(result.quote.toAmountRaw), toDecimals)))
            : null;
          const isPicked = preferred === id;
          return (
            <DropdownMenuItem
              key={id}
              data-testid={`router-option-${id}`}
              disabled={!ok}
              onSelect={() => {
                if (ok) onChange(id);
              }}
              className="flex items-start gap-2 cursor-pointer data-[disabled]:cursor-not-allowed"
            >
              <Check
                size={14}
                className={`mt-0.5 shrink-0 ${isPicked ? "text-primary" : "opacity-0"}`}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                  <span>{label}</span>
                  {ok && out && (
                    <span className="text-muted-foreground font-normal text-[10px] truncate">
                      {out} {toSymbol}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                  {ok
                    ? `via ${result?.quote?.toolName ?? label}`
                    : result?.error ?? "No route available"}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}

        {usedFallback && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[10px] text-amber-400/90 leading-snug">
              {routerLabel(preferred as RouterId)} has no quote — using auto-best ({triggerRouter ? routerLabel(triggerRouter) : "—"}) for this trade.
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(6).replace(/\.?0+$/, "");
  if (n < 1000) return n.toFixed(4).replace(/\.?0+$/, "");
  if (n < 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

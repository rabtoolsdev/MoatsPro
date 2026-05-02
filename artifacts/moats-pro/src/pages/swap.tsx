import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useAppKit, useAppKitNetwork } from "@reown/appkit/react";
import { formatUnits, parseUnits } from "viem";
import { ArrowDownUp, ChevronDown, Loader2, Wallet } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { TokenSelectModal } from "@/components/swap/token-select-modal";
import { TokenLogo } from "@/components/swap/token-logo";
import { SlippageSettings } from "@/components/swap/slippage-settings";
import {
  BASE_TOKENS,
  deriveMoatTokens,
  isNativeToken,
  type MoatToken,
} from "@/lib/moat-tokens";
import {
  AVALANCHE_CHAIN_ID,
  FEE_BPS,
  FEE_WALLET,
} from "@/lib/swap-routers";
import { networks } from "@/lib/wagmi-config";
import { useAllMoatConfigs } from "@/hooks/use-moats-api";
import {
  useTokenAllowance,
  useTokenBalance,
  useApproveToken,
  useSwapFromBalance,
} from "@/hooks/use-moat-contract";
import { useSwapQuote, useExecuteSwap, type FeeTransfer } from "@/hooks/use-swap";
import { useSlippage } from "@/hooks/use-slippage";
import { useWalletAssetBalances } from "@/hooks/use-wallet-assets";
import { useToast } from "@/hooks/use-toast";

type Side = "from" | "to";

export default function Swap() {
  const { isConnected, address } = useAccount();
  const { open } = useAppKit();
  const { chainId, switchNetwork } = useAppKitNetwork();
  const { toast } = useToast();

  const { data: moats } = useAllMoatConfigs();
  const moatTokens = useMemo(() => deriveMoatTokens(moats), [moats]);
  // Both sides accept the full token universe — base assets + moat-backed
  // tokens. This makes the swap symmetric (e.g. buy a moat token with AVAX,
  // or sell it back for AVAX/USDC/USDT/WAVAX/BTC.b or another moat token).
  const allTokens = useMemo(
    () => [...BASE_TOKENS, ...moatTokens],
    [moatTokens]
  );
  const fromTokens = allTokens;
  const toTokens = allTokens;
  const { slippage, setSlippage } = useSlippage();

  const [fromToken, setFromToken] = useState<MoatToken | null>(BASE_TOKENS[0]);
  const [toToken, setToToken] = useState<MoatToken | null>(null);
  const [amount, setAmount] = useState("");
  const [pickerSide, setPickerSide] = useState<Side | null>(null);
  const [flipCount, setFlipCount] = useState(0);

  // Pre-select first moat token for "to" side once loaded
  useEffect(() => {
    if (moatTokens.length >= 1 && !toToken) {
      setToToken(moatTokens[0]);
    }
  }, [moatTokens, toToken]);

  const fromBal = useSwapFromBalance(fromToken);
  const toBal = useTokenBalance(toToken?.address);
  const fromDecimals = (fromBal.decimals as number | undefined) ?? fromToken?.decimals ?? 18;
  const toDecimals = (toBal.decimals as number | undefined) ?? toToken?.decimals ?? 18;
  const isFromNative = !!fromToken && isNativeToken(fromToken.address);

  const onAvalanche = chainId === AVALANCHE_CHAIN_ID;

  // Wallet balances for the "You pay" picker (auto-shows assets the user holds).
  const { balances: walletBalances } = useWalletAssetBalances(fromTokens);

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
    fromTokenAddress: fromToken?.address,
    toTokenAddress: toToken?.address,
    fromAmount: swapAmountStr,
    fromDecimals,
    slippage,
    enabled: onAvalanche && isConnected,
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

  // Toast on swap success
  useEffect(() => {
    if (executor.isSuccess) {
      toast({
        title: "Swap complete",
        description: "Your tokens have arrived in your wallet.",
      });
      setAmount("");
      executor.reset();
    }
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
    if (!onAvalanche)
      return {
        label: "Switch to Avalanche",
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
        <div className="mb-6 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-br from-foreground to-primary/80 bg-clip-text text-transparent">
            Moat Swap
          </h1>
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
            {quote.best && (
              <Row
                label="Routed via"
                value={
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary live-dot" aria-hidden />
                      {quote.best.router === "lifi" ? "Li.Fi" : quote.best.router}
                    </span>
                    <span className="text-muted-foreground/80 truncate max-w-[140px]">
                      via {quote.best.toolName}
                    </span>
                  </span>
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

function formatNumber(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(6).replace(/\.?0+$/, "");
  if (n < 1000) return n.toFixed(4).replace(/\.?0+$/, "");
  if (n < 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

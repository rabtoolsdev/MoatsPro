import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { useReadContracts, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { motion } from "framer-motion";
import {
  Shield, ToggleLeft, ToggleRight,
  Coins, Settings, AlertTriangle, Loader2, CheckCircle2,
  UserPlus, UserMinus, Zap, Power, Lock,
  ArrowDownToLine, BadgeCheck, ExternalLink, AlertCircle,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { MoatLogo } from "@/components/moat-card";
import { useAllMoatConfigs } from "@/hooks/use-moats-api";
import { getMoatMeta, formatAddress, getExplorerUrl } from "@/lib/moat-metadata";
import { TokenLogo } from "@/components/swap/token-logo";
import { MOAT_V3_ABI, MOAT_V3_ADMIN_ABI, MOAT_LOGO_ABI, ERC20_ABI } from "@/lib/moat-abi";
import { networkToChainId } from "@/lib/wagmi-config";
import type { MoatConfig, RewardToken } from "@/lib/moats-api";

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtFee(fee: bigint | undefined): string {
  if (fee === undefined) return "—";
  return `${(Number(fee) / 100).toFixed(2)}%`;
}

const networkLabels: Record<string, string> = {
  avalanche: "Avalanche", ethereum: "Ethereum", base: "Base", bsc: "BNB",
  monad: "Monad", thegrotto: "The Grotto", blaze: "Blaze", robinhood: "Robinhood",
};

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({
  label, enabled, isLoading, onEnable, onDisable, isPending, description,
}: {
  label: string; enabled: boolean | undefined; isLoading: boolean;
  onEnable: () => void; onDisable: () => void; isPending: boolean; description?: string;
}) {
  const active = enabled === true;
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-0">
      <div className="min-w-0 pr-4">
        <p className="text-sm font-semibold text-white">{label}</p>
        {description && <p className="text-xs text-muted-foreground/70 mt-0.5 leading-snug">{description}</p>}
      </div>
      <button
        onClick={() => (active ? onDisable() : onEnable())}
        disabled={isLoading || isPending || enabled === undefined}
        className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed border ${
          active
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20 shadow-[0_0_12px_rgba(52,211,153,0.1)]"
            : "bg-rose-500/10 text-rose-400 border-rose-500/25 hover:bg-rose-500/20"
        }`}
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : active ? (
          <ToggleRight size={14} />
        ) : (
          <ToggleLeft size={14} />
        )}
        {active ? "Enabled" : "Disabled"}
      </button>
    </div>
  );
}

// ── Tx status banner ──────────────────────────────────────────────────────────

function TxStatus({ hash, isPending, isConfirming, isSuccess, error }: {
  hash?: `0x${string}`; isPending: boolean; isConfirming: boolean;
  isSuccess: boolean; error: Error | null;
}) {
  if (!isPending && !isConfirming && !isSuccess && !error) return null;
  return (
    <div className={`mt-3 flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs font-medium border ${
      error ? "bg-rose-500/8 text-rose-400 border-rose-500/20"
        : isSuccess ? "bg-emerald-500/8 text-emerald-400 border-emerald-500/20"
        : "bg-primary/8 text-primary border-primary/20"
    }`}>
      {(isPending || isConfirming) && <Loader2 size={12} className="animate-spin shrink-0 mt-0.5" />}
      {isSuccess && <CheckCircle2 size={12} className="shrink-0 mt-0.5" />}
      {error && <AlertCircle size={12} className="shrink-0 mt-0.5" />}
      <span className="break-all leading-snug">
        {isPending ? "Confirm in wallet…"
          : isConfirming ? `Confirming on-chain… ${hash ? `(${hash.slice(0, 10)}…)` : ""}`
          : isSuccess ? `Transaction confirmed! ${hash ? hash.slice(0, 10) + "…" : ""}`
          : (error?.message ?? "Transaction failed").slice(0, 120)}
      </span>
    </div>
  );
}

// ── Per-token deposit row ─────────────────────────────────────────────────────

function RewardTokenDepositRow({
  tokenAddress, symbol, decimals, unallocated, network, chainId, moatAddress,
}: {
  tokenAddress: string; symbol: string; decimals: number;
  unallocated: bigint | undefined; network: string;
  chainId: number | undefined; moatAddress: `0x${string}`;
}) {
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState("");

  const { writeContract: writeApprove, data: approveHash, isPending: approvePending, error: approveError } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { writeContract: writeDeposit, data: depositHash, isPending: depositPending, error: depositError } = useWriteContract();
  const { isLoading: depositConfirming, isSuccess: depositSuccess } = useWaitForTransactionReceipt({ hash: depositHash });

  const parsedAmount = amount ? parseUnits(amount, decimals) : 0n;
  const displayBalance = unallocated !== undefined
    ? parseFloat(formatUnits(unallocated, decimals))
    : null;

  const submitApprove = () => {
    if (!amount) return;
    writeApprove({ address: tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: "approve",
      args: [moatAddress, parsedAmount], chainId });
  };
  const submitDeposit = () => {
    if (!amount) return;
    writeDeposit({ address: moatAddress, abi: MOAT_V3_ADMIN_ABI, functionName: "depositRewards",
      args: [tokenAddress as `0x${string}`, parsedAmount], chainId });
  };

  return (
    <div className="border-b border-white/5 last:border-0">
      {/* Row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <TokenLogo address={tokenAddress} symbol={symbol} network={network} size={32} className="shrink-0 rounded-full" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white leading-tight">{symbol}</p>
          <p className={`text-xs font-mono tabular-nums ${displayBalance !== null && displayBalance > 0 ? "text-emerald-400" : "text-muted-foreground/50"}`}>
            {displayBalance !== null
              ? `${displayBalance.toLocaleString("en-US", { maximumFractionDigits: 4 })} unallocated`
              : "loading…"}
          </p>
        </div>
        <button
          onClick={() => { setExpanded((v) => !v); setAmount(""); }}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
            expanded
              ? "bg-white/5 border-white/10 text-muted-foreground"
              : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 shadow-[0_0_10px_rgba(0,212,255,0.1)]"
          }`}
        >
          <ArrowDownToLine size={12} />
          {expanded ? "Cancel" : "Deposit"}
        </button>
      </div>

      {/* Inline deposit form */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={submitApprove}
              disabled={!amount || approvePending || approveConfirming}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-xs font-bold text-white transition-all disabled:opacity-40"
            >
              {approvePending || approveConfirming ? <Loader2 size={11} className="animate-spin" /> : <BadgeCheck size={12} />}
              1. Approve
            </button>
            <button
              onClick={submitDeposit}
              disabled={!amount || !approveSuccess || depositPending || depositConfirming}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 text-xs font-bold text-primary transition-all disabled:opacity-40 shadow-[0_0_12px_rgba(0,212,255,0.08)]"
            >
              {depositPending || depositConfirming ? <Loader2 size={11} className="animate-spin" /> : <ArrowDownToLine size={12} />}
              2. Deposit
            </button>
          </div>
          <TxStatus hash={approveHash} isPending={approvePending} isConfirming={approveConfirming} isSuccess={approveSuccess} error={approveError} />
          <TxStatus hash={depositHash} isPending={depositPending} isConfirming={depositConfirming} isSuccess={depositSuccess} error={depositError} />
        </div>
      )}
    </div>
  );
}

// ── Per-moat admin panel ──────────────────────────────────────────────────────

function MoatAdminPanel({ moat }: { moat: MoatConfig }) {
  const [activeTab, setActiveTab] = useState<"controls" | "rewards" | "settings">("controls");
  const meta = getMoatMeta(moat.contractAddress, moat.network);
  const chainId = networkToChainId(moat.network);
  const addr = moat.contractAddress as `0x${string}`;
  const explorerUrl = getExplorerUrl(moat.network);
  const primaryTokenAddress = meta.tokenAddress || moat.rewardTokens[0]?.tokenAddress;
  const statusStyle = moat.status === "Verified"
    ? { border: "border-emerald-500/20", badge: "bg-emerald-500/8 text-emerald-400 border-emerald-500/25", dot: "bg-emerald-400" }
    : { border: "border-primary/20", badge: "bg-primary/8 text-primary border-primary/25", dot: "bg-primary" };

  // ── On-chain logo ────────────────────────────────────────────────────────
  const { data: onChainLogoUrl } = useReadContract({
    address: addr,
    abi: MOAT_LOGO_ABI,
    functionName: "getLogoURL",
    chainId,
  });

  // ── State reads ─────────────────────────────────────────────────────────
  const { data: adminState } = useReadContracts({
    contracts: [
      { address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "paused", chainId },
      { address: addr, abi: MOAT_V3_ABI, functionName: "stakingEnabled", chainId },
      { address: addr, abi: MOAT_V3_ABI, functionName: "lockingEnabled", chainId },
      { address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "burningEnabled", chainId },
      { address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "earlyExitEnabled", chainId },
      { address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "emergencyUnlockEnabled", chainId },
      { address: addr, abi: MOAT_V3_ABI, functionName: "unstakeFee", chainId },
      { address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "feeCollector", chainId },
      { address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "getRewardTokens", chainId },
    ],
    allowFailure: true,
  });

  const paused = adminState?.[0]?.status === "success" ? (adminState[0].result as boolean) : undefined;
  const stakingEnabled = adminState?.[1]?.status === "success" ? (adminState[1].result as boolean) : undefined;
  const lockingEnabled = adminState?.[2]?.status === "success" ? (adminState[2].result as boolean) : undefined;
  const burningEnabled = adminState?.[3]?.status === "success" ? (adminState[3].result as boolean) : undefined;
  const earlyExitEnabled = adminState?.[4]?.status === "success" ? (adminState[4].result as boolean) : undefined;
  const emergencyUnlockEnabled = adminState?.[5]?.status === "success" ? (adminState[5].result as boolean) : undefined;
  const unstakeFee = adminState?.[6]?.status === "success" ? (adminState[6].result as bigint) : undefined;
  const feeCollectorAddr = adminState?.[7]?.status === "success" ? (adminState[7].result as string) : undefined;
  const rewardTokensData = adminState?.[8]?.status === "success"
    ? (adminState[8].result as [string[], bigint[], bigint[], bigint[]])
    : undefined;
  const rewardTokenAddresses = rewardTokensData?.[0] ?? [];
  const rewardTokenUnallocated = rewardTokensData?.[3] ?? [];

  // ── Write: controls ──────────────────────────────────────────────────────
  const { writeContract: writeToggle, data: toggleHash, isPending: togglePending, error: toggleError } = useWriteContract();
  const { isLoading: toggleConfirming, isSuccess: toggleSuccess } = useWaitForTransactionReceipt({ hash: toggleHash });
  const toggle = (fn: "setStakingEnabled" | "setLockingEnabled" | "setBurningEnabled" | "setEarlyExitEnabled" | "togglePause", val: boolean) =>
    writeToggle({ address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: fn, args: [val], chainId });
  const triggerEmergencyUnlock = () =>
    writeToggle({ address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "enableEmergencyUnlock", chainId });

  // ── Write: fee / settings ────────────────────────────────────────────────
  const [newFee, setNewFee] = useState("");
  const [newFeeCollector, setNewFeeCollector] = useState("");
  const { writeContract: writeFee, data: feeHash, isPending: feePending, error: feeError } = useWriteContract();
  const { isLoading: feeConfirming, isSuccess: feeSuccess } = useWaitForTransactionReceipt({ hash: feeHash });
  const submitFee = () => {
    const bps = Math.round(parseFloat(newFee) * 100);
    if (isNaN(bps) || bps < 0 || bps > 10000) return;
    writeFee({ address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "setUnstakeFee", args: [BigInt(bps)], chainId });
  };
  const submitFeeCollector = () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(newFeeCollector)) return;
    writeFee({ address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "setFeeCollector", args: [newFeeCollector as `0x${string}`], chainId });
  };

  // ── Write: deposit rewards ───────────────────────────────────────────────
  const [depositToken, setDepositToken] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const selectedToken = moat.rewardTokens.find(
    (t) => t.tokenAddress.toLowerCase() === depositToken.toLowerCase()
  );
  const resolvedDecimals = selectedToken?.decimals ?? 18;

  const { writeContract: writeApprove, data: approveHash, isPending: approvePending, error: approveError } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { writeContract: writeDeposit, data: depositHash, isPending: depositPending, error: depositError } = useWriteContract();
  const { isLoading: depositConfirming, isSuccess: depositSuccess } = useWaitForTransactionReceipt({ hash: depositHash });

  const submitApprove = () => {
    if (!depositToken || !depositAmount) return;
    writeApprove({ address: depositToken as `0x${string}`, abi: ERC20_ABI, functionName: "approve",
      args: [addr, parseUnits(depositAmount, resolvedDecimals)], chainId });
  };
  const submitDeposit = () => {
    if (!depositToken || !depositAmount) return;
    writeDeposit({ address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "depositRewards",
      args: [depositToken as `0x${string}`, parseUnits(depositAmount, resolvedDecimals)], chainId });
  };

  // ── Write: admin access ───────────────────────────────────────────────────
  const [adminInput, setAdminInput] = useState("");
  const { writeContract: writeAdmin, data: adminHash, isPending: adminPending, error: adminError } = useWriteContract();
  const { isLoading: adminConfirming, isSuccess: adminSuccess } = useWaitForTransactionReceipt({ hash: adminHash });
  const submitAddAdmin = () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(adminInput)) return;
    writeAdmin({ address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "addAdmin", args: [adminInput as `0x${string}`], chainId });
  };
  const submitRemoveAdmin = () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(adminInput)) return;
    writeAdmin({ address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "removeAdmin", args: [adminInput as `0x${string}`], chainId });
  };

  const isDataLoading = adminState === undefined;

  const tabs = [
    { id: "controls" as const, label: "Controls", icon: Power },
    { id: "rewards" as const, label: "Rewards", icon: Coins },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
      className={`relative rounded-2xl border ${statusStyle.border} bg-card/60 backdrop-blur-xl overflow-hidden shadow-xl cyber-grid`}
      style={{ boxShadow: "0 4px 32px rgba(0,0,0,0.4)" }}
    >
      {/* Top edge glow */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {/* Header */}
      <div className="relative flex items-start justify-between gap-4 p-5 border-b border-white/5">
        <div className="flex items-center gap-4 min-w-0">
          <div className="relative shrink-0">
            <MoatLogo meta={meta} primaryTokenAddress={primaryTokenAddress} onChainLogoUrl={onChainLogoUrl ?? undefined} size="lg" />
            {/* Admin badge overlay */}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-[0_0_8px_rgba(0,212,255,0.6)] border border-background">
              <Shield size={10} className="text-background" />
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-white text-base leading-tight truncate">{meta.name}</h3>
            <p className="text-xs font-mono text-muted-foreground/70 uppercase tracking-tight mt-0.5">{meta.protocol}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] font-mono text-muted-foreground/60 capitalize">
                {networkLabels[moat.network?.toLowerCase()] ?? moat.network}
              </span>
              <span className="text-muted-foreground/30">·</span>
              <a
                href={`${explorerUrl}/address/${moat.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-primary/60 hover:text-primary transition-colors font-mono flex items-center gap-1"
              >
                {formatAddress(moat.contractAddress)}
                <ExternalLink size={9} />
              </a>
            </div>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            {paused !== undefined && (
              <span className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border uppercase tracking-widest ${
                paused
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/25"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${paused ? "bg-amber-400" : "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"}`} />
                {paused ? "Paused" : "Live"}
              </span>
            )}
            <span className={`text-[10px] font-black px-2 py-1 rounded-lg border uppercase tracking-widest ${statusStyle.badge}`}>
              {moat.status}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 bg-black/20">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`relative flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold tracking-wide uppercase transition-all duration-200 ${
              activeTab === id
                ? "text-primary"
                : "text-muted-foreground/60 hover:text-muted-foreground"
            }`}
          >
            <Icon size={13} />
            {label}
            {activeTab === id && (
              <motion.div
                layoutId={`admin-tab-${moat.contractAddress}`}
                className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary shadow-[0_0_8px_rgba(0,212,255,0.6)]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-5">

        {/* ── CONTROLS TAB ── */}
        {activeTab === "controls" && (
          <div className="space-y-1">
            {isDataLoading ? (
              <div className="space-y-3 py-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="h-14 rounded-xl bg-white/3 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-white/5 bg-black/20 px-4 mb-4">
                  <ToggleRow label="Staking" enabled={stakingEnabled} isLoading={isDataLoading}
                    isPending={togglePending || toggleConfirming}
                    onEnable={() => toggle("setStakingEnabled", true)}
                    onDisable={() => toggle("setStakingEnabled", false)}
                    description="Allow users to stake tokens into this moat" />
                  <ToggleRow label="Locking" enabled={lockingEnabled} isLoading={isDataLoading}
                    isPending={togglePending || toggleConfirming}
                    onEnable={() => toggle("setLockingEnabled", true)}
                    onDisable={() => toggle("setLockingEnabled", false)}
                    description="Allow time-locking staked tokens for multipliers" />
                  <ToggleRow label="Burning" enabled={burningEnabled} isLoading={isDataLoading}
                    isPending={togglePending || toggleConfirming}
                    onEnable={() => toggle("setBurningEnabled", true)}
                    onDisable={() => toggle("setBurningEnabled", false)}
                    description="Allow users to burn tokens for burn-points" />
                  <ToggleRow label="Early Exit" enabled={earlyExitEnabled} isLoading={isDataLoading}
                    isPending={togglePending || toggleConfirming}
                    onEnable={() => toggle("setEarlyExitEnabled", true)}
                    onDisable={() => toggle("setEarlyExitEnabled", false)}
                    description="Allow early lock exit with a penalty fee" />
                </div>

                <TxStatus hash={toggleHash} isPending={togglePending} isConfirming={toggleConfirming} isSuccess={toggleSuccess} error={toggleError} />

                {/* Pause */}
                <div className="rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-transparent p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle size={14} /> Emergency Pause
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        Instantly halts all moat interactions.
                      </p>
                    </div>
                    <button
                      onClick={() => toggle("togglePause", !paused)}
                      disabled={togglePending || toggleConfirming || paused === undefined}
                      className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-40 border ${
                        paused
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/20"
                      }`}
                    >
                      {togglePending || toggleConfirming
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Power size={12} />}
                      {paused ? "Unpause Moat" : "Pause Moat"}
                    </button>
                  </div>
                </div>

                {/* Emergency unlock */}
                {emergencyUnlockEnabled === false && (
                  <div className="rounded-xl border border-rose-500/20 bg-gradient-to-r from-rose-500/5 to-transparent p-4 mt-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-rose-400 flex items-center gap-1.5">
                          <Lock size={14} /> Emergency Unlock
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          Allow all locked stakers to exit immediately. Irreversible.
                        </p>
                      </div>
                      <button
                        onClick={triggerEmergencyUnlock}
                        disabled={togglePending || toggleConfirming}
                        className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 transition-all disabled:opacity-40"
                      >
                        {togglePending || toggleConfirming
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Zap size={12} />}
                        Enable
                      </button>
                    </div>
                  </div>
                )}
                {emergencyUnlockEnabled === true && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 mt-3">
                    <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 size={13} /> Emergency unlock active — all locks are exitable
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── REWARDS TAB ── */}
        {activeTab === "rewards" && (
          <div>
            {moat.rewardTokens.length === 0 ? (
              <p className="text-sm text-muted-foreground/50 text-center py-8">No reward tokens configured.</p>
            ) : (
              <>
                <p className="text-[10px] font-mono font-bold text-muted-foreground/60 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Coins size={10} className="text-primary/60" /> Reward Tokens
                </p>
                <div className="rounded-xl border border-white/5 bg-black/20 overflow-hidden">
                  {moat.rewardTokens.map((t: RewardToken, i: number) => {
                    const onChainAddr = rewardTokenAddresses.find(
                      (a) => a.toLowerCase() === t.tokenAddress.toLowerCase()
                    );
                    const onChainIdx = rewardTokenAddresses.findIndex(
                      (a) => a.toLowerCase() === t.tokenAddress.toLowerCase()
                    );
                    const unallocated = onChainIdx >= 0 ? rewardTokenUnallocated[onChainIdx] : undefined;
                    return (
                      <RewardTokenDepositRow
                        key={t.tokenAddress}
                        tokenAddress={t.tokenAddress}
                        symbol={t.symbol}
                        decimals={t.decimals ?? 18}
                        unallocated={unallocated}
                        network={moat.network ?? "avalanche"}
                        chainId={chainId}
                        moatAddress={addr}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            {/* Unstake fee */}
            <div>
              <p className="text-[10px] font-mono font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Unstake Fee</p>
              <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3 mb-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground/60">Current fee</span>
                <span className="text-sm font-black text-white tabular-nums">{fmtFee(unstakeFee)}</span>
              </div>
              <div className="flex gap-2.5">
                <input
                  type="number"
                  placeholder="New fee % (e.g. 0.50)"
                  value={newFee}
                  onChange={(e) => setNewFee(e.target.value)}
                  step="0.01" min="0" max="100"
                  className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
                <button
                  onClick={submitFee}
                  disabled={!newFee || feePending || feeConfirming}
                  className="px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 text-xs font-bold text-primary transition-all disabled:opacity-40 whitespace-nowrap"
                >
                  {feePending || feeConfirming ? <Loader2 size={12} className="animate-spin inline" /> : null} Set Fee
                </button>
              </div>
            </div>

            {/* Fee collector */}
            <div>
              <p className="text-[10px] font-mono font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Fee Collector</p>
              {feeCollectorAddr && (
                <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3 mb-3 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground/60">Current</span>
                  <span className="text-xs font-mono text-white">{formatAddress(feeCollectorAddr)}</span>
                </div>
              )}
              <div className="flex gap-2.5">
                <input
                  type="text"
                  placeholder="0x… new collector address"
                  value={newFeeCollector}
                  onChange={(e) => setNewFeeCollector(e.target.value)}
                  className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors font-mono"
                />
                <button
                  onClick={submitFeeCollector}
                  disabled={!newFeeCollector || feePending || feeConfirming}
                  className="px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/30 hover:bg-primary/20 text-xs font-bold text-primary transition-all disabled:opacity-40 whitespace-nowrap"
                >
                  Update
                </button>
              </div>
              <TxStatus hash={feeHash} isPending={feePending} isConfirming={feeConfirming} isSuccess={feeSuccess} error={feeError} />
            </div>

            {/* Add / remove admin */}
            <div>
              <p className="text-[10px] font-mono font-bold text-muted-foreground/60 uppercase tracking-widest mb-3">Admin Access</p>
              <input
                type="text"
                placeholder="0x… wallet address"
                value={adminInput}
                onChange={(e) => setAdminInput(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors font-mono mb-2.5"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={submitAddAdmin}
                  disabled={!adminInput || adminPending || adminConfirming}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 hover:bg-emerald-500/15 text-xs font-bold text-emerald-400 transition-all disabled:opacity-40"
                >
                  {adminPending || adminConfirming ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={13} />}
                  Add Admin
                </button>
                <button
                  onClick={submitRemoveAdmin}
                  disabled={!adminInput || adminPending || adminConfirming}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/8 border border-rose-500/20 hover:bg-rose-500/15 text-xs font-bold text-rose-400 transition-all disabled:opacity-40"
                >
                  {adminPending || adminConfirming ? <Loader2 size={12} className="animate-spin" /> : <UserMinus size={13} />}
                  Remove Admin
                </button>
              </div>
              <TxStatus hash={adminHash} isPending={adminPending} isConfirming={adminConfirming} isSuccess={adminSuccess} error={adminError} />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MoatAdmin() {
  const { address: walletAddress, isConnected } = useAccount();
  const { data: allMoats, isLoading: moatsLoading } = useAllMoatConfigs();

  // Batch-check admins(wallet) across all moats in one multicall
  const adminChecks = useMemo(() => {
    if (!walletAddress || !allMoats?.length) return [];
    return allMoats.map((m) => ({
      address: m.contractAddress as `0x${string}`,
      abi: MOAT_V3_ADMIN_ABI,
      functionName: "admins" as const,
      args: [walletAddress] as const,
      chainId: networkToChainId(m.network),
    }));
  }, [walletAddress, allMoats]);

  const { data: adminResults, isLoading: adminLoading } = useReadContracts({
    contracts: adminChecks,
    allowFailure: true,
    query: { enabled: adminChecks.length > 0 },
  });

  const adminMoats = useMemo(() => {
    if (!allMoats || !walletAddress) return [];
    return allMoats.filter((m, i) => {
      const onChainAdmin = adminResults?.[i]?.status === "success"
        ? (adminResults[i].result as boolean)
        : false;
      const isOwner = m.owner?.toLowerCase() === walletAddress.toLowerCase();
      return onChainAdmin || isOwner;
    });
  }, [allMoats, adminResults, walletAddress]);

  const isLoading = moatsLoading || (isConnected && adminLoading && adminChecks.length > 0);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 pt-20 pb-16">
        {/* Page hero */}
        <div className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-primary/3 to-transparent">
          <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative max-w-4xl mx-auto px-4 py-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/25 shadow-[0_0_20px_rgba(0,212,255,0.1)]">
                <Shield size={24} className="text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white tracking-tight">Moat Admin</h1>
                <p className="text-xs font-mono text-muted-foreground/60 uppercase tracking-widest mt-0.5">Protocol Management Terminal</p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm max-w-lg leading-relaxed">
              Manage moats your wallet has admin rights to. All controls execute directly
              on-chain — only your connected wallet can authorize these transactions.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 pt-8">
          {/* Not connected */}
          {!isConnected && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/8 bg-card/30 backdrop-blur-xl p-16 text-center cyber-grid"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center mx-auto mb-5">
                <Shield size={32} className="text-primary/40" />
              </div>
              <p className="text-white font-black text-xl mb-2">Connect your wallet</p>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Connect the wallet that has admin rights to your moat(s) to access the management controls.
              </p>
            </motion.div>
          )}

          {/* Loading skeleton */}
          {isConnected && isLoading && (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-white/8 bg-card/30 overflow-hidden">
                  <div className="h-24 bg-white/3 animate-pulse" />
                  <div className="h-12 bg-black/20 animate-pulse" />
                  <div className="p-5 space-y-3">
                    <div className="h-14 rounded-xl bg-white/3 animate-pulse" />
                    <div className="h-14 rounded-xl bg-white/3 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No admin moats */}
          {isConnected && !isLoading && adminMoats.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/8 bg-card/30 backdrop-blur-xl p-16 text-center cyber-grid"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/3 border border-white/8 flex items-center justify-center mx-auto mb-5">
                <Shield size={32} className="text-muted-foreground/30" />
              </div>
              <p className="text-white font-black text-xl mb-2">No admin access found</p>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                The connected wallet{" "}
                <span className="font-mono text-primary/70">
                  {walletAddress ? formatAddress(walletAddress) : "—"}
                </span>{" "}
                does not have admin rights on any active moat contracts.
              </p>
            </motion.div>
          )}

          {/* Admin panels */}
          {isConnected && !isLoading && adminMoats.length > 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-mono font-bold text-muted-foreground/50 uppercase tracking-widest">
                  {adminMoats.length} moat{adminMoats.length !== 1 ? "s" : ""} with admin access
                </p>
                <div className="flex-1 h-px bg-white/5" />
              </div>
              {adminMoats.map((moat) => (
                <MoatAdminPanel
                  key={`${moat.network}-${moat.contractAddress}`}
                  moat={moat}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Coins, Settings, AlertTriangle, Loader2, CheckCircle2,
  UserPlus, UserMinus, Zap, Power, Lock, Flame, ArrowDownToLine,
  BadgeCheck, ExternalLink,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useAllMoatConfigs } from "@/hooks/use-moats-api";
import { getMoatMeta, formatAddress, getExplorerUrl } from "@/lib/moat-metadata";
import { MOAT_V3_ABI, MOAT_V3_ADMIN_ABI, ERC20_ABI } from "@/lib/moat-abi";
import { networkToChainId } from "@/lib/wagmi-config";
import type { MoatConfig, RewardToken } from "@/lib/moats-api";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtFee(fee: bigint | undefined): string {
  if (fee === undefined) return "—";
  return `${(Number(fee) / 100).toFixed(2)}%`;
}

// ── Sub-component: Toggle Row ─────────────────────────────────────────────────

function ToggleRow({
  label,
  enabled,
  isLoading,
  onEnable,
  onDisable,
  isPending,
  description,
}: {
  label: string;
  enabled: boolean | undefined;
  isLoading: boolean;
  onEnable: () => void;
  onDisable: () => void;
  isPending: boolean;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => (enabled ? onDisable() : onEnable())}
        disabled={isLoading || isPending || enabled === undefined}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
          enabled
            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
            : "bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25"
        }`}
      >
        {isPending || isLoading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : enabled ? (
          <ToggleRight size={14} />
        ) : (
          <ToggleLeft size={14} />
        )}
        {enabled ? "Enabled" : "Disabled"}
      </button>
    </div>
  );
}

// ── Sub-component: Tx Status Banner ──────────────────────────────────────────

function TxStatus({
  hash,
  isPending,
  isConfirming,
  isSuccess,
  error,
}: {
  hash?: `0x${string}`;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error: Error | null;
}) {
  if (!isPending && !isConfirming && !isSuccess && !error) return null;
  return (
    <div
      className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${
        error
          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          : isSuccess
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          : "bg-primary/10 text-primary border border-primary/20"
      }`}
    >
      {(isPending || isConfirming) && <Loader2 size={12} className="animate-spin shrink-0" />}
      {isSuccess && <CheckCircle2 size={12} className="shrink-0" />}
      {error && <AlertTriangle size={12} className="shrink-0" />}
      <span className="truncate">
        {isPending
          ? "Confirm in wallet…"
          : isConfirming
          ? "Confirming on-chain…"
          : isSuccess
          ? `Success! ${hash ? hash.slice(0, 10) + "…" : ""}`
          : error?.message?.slice(0, 80) ?? "Transaction failed"}
      </span>
    </div>
  );
}

// ── Sub-component: Admin Panel for a single Moat ─────────────────────────────

function MoatAdminPanel({ moat }: { moat: MoatConfig }) {
  const [activeTab, setActiveTab] = useState<"controls" | "rewards" | "settings">("controls");
  const meta = getMoatMeta(moat.contractAddress, moat.network);
  const chainId = networkToChainId(moat.network);
  const addr = moat.contractAddress as `0x${string}`;
  const explorerUrl = getExplorerUrl(moat.network);

  // ── State reads ─────────────────────────────────────────────────────────
  const { data: adminState, refetch: refetchAdmin } = useReadContracts({
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

  const toggle = (fn: "setStakingEnabled" | "setLockingEnabled" | "setBurningEnabled" | "setEarlyExitEnabled" | "togglePause", val: boolean) => {
    writeToggle({ address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: fn, args: [val], chainId });
  };

  // ── Write: fee ───────────────────────────────────────────────────────────
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
    if (!newFeeCollector.startsWith("0x")) return;
    writeFee({ address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "setFeeCollector", args: [newFeeCollector as `0x${string}`], chainId });
  };

  // ── Write: deposit rewards ───────────────────────────────────────────────
  const [depositToken, setDepositToken] = useState<string>("");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDecimals, setDepositDecimals] = useState(18);

  const selectedTokenFromConfig = moat.rewardTokens.find(
    (t) => t.tokenAddress.toLowerCase() === depositToken.toLowerCase()
  );

  // Read decimals for selected token
  const { data: tokenDecimalsData } = useReadContracts({
    contracts: depositToken
      ? [{ address: depositToken as `0x${string}`, abi: ERC20_ABI, functionName: "decimals", chainId }]
      : [],
    allowFailure: true,
    query: { enabled: !!depositToken },
  });
  const resolvedDecimals = tokenDecimalsData?.[0]?.status === "success"
    ? Number(tokenDecimalsData[0].result as number)
    : selectedTokenFromConfig?.decimals ?? 18;

  // Approve then deposit
  const { writeContract: writeApprove, data: approveHash, isPending: approvePending, error: approveError } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

  const { writeContract: writeDeposit, data: depositHash, isPending: depositPending, error: depositError } = useWriteContract();
  const { isLoading: depositConfirming, isSuccess: depositSuccess } = useWaitForTransactionReceipt({ hash: depositHash });

  const submitApprove = () => {
    if (!depositToken || !depositAmount) return;
    writeApprove({
      address: depositToken as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [addr, parseUnits(depositAmount, resolvedDecimals)],
      chainId,
    });
  };

  const submitDeposit = () => {
    if (!depositToken || !depositAmount) return;
    writeDeposit({
      address: addr,
      abi: MOAT_V3_ADMIN_ABI,
      functionName: "depositRewards",
      args: [depositToken as `0x${string}`, parseUnits(depositAmount, resolvedDecimals)],
      chainId,
    });
  };

  // ── Write: add/remove admin ───────────────────────────────────────────────
  const [adminInput, setAdminInput] = useState("");
  const { writeContract: writeAdmin, data: adminHash, isPending: adminPending, error: adminError } = useWriteContract();
  const { isLoading: adminConfirming, isSuccess: adminSuccess } = useWaitForTransactionReceipt({ hash: adminHash });

  const submitAddAdmin = () => {
    if (!adminInput.startsWith("0x")) return;
    writeAdmin({ address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "addAdmin", args: [adminInput as `0x${string}`], chainId });
  };

  const submitRemoveAdmin = () => {
    if (!adminInput.startsWith("0x")) return;
    writeAdmin({ address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "removeAdmin", args: [adminInput as `0x${string}`], chainId });
  };

  const isLoading = adminState === undefined;

  const tabs = [
    { id: "controls" as const, label: "Controls", icon: Power },
    { id: "rewards" as const, label: "Rewards", icon: Coins },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <div className="rounded-2xl border border-white/8 bg-card/40 backdrop-blur-xl overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          {meta.logoUrl ? (
            <img src={meta.logoUrl} alt={meta.protocol} className="w-10 h-10 rounded-xl object-cover bg-white/5" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Shield size={18} className="text-primary" />
            </div>
          )}
          <div>
            <h3 className="font-bold text-white text-base leading-tight">{meta.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground capitalize">{moat.network}</span>
              <span className="text-muted-foreground/40">·</span>
              <a
                href={`${explorerUrl}/address/${moat.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary/70 hover:text-primary transition-colors font-mono flex items-center gap-1"
              >
                {formatAddress(moat.contractAddress)}
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {paused !== undefined && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
              paused
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}>
              {paused ? "PAUSED" : "LIVE"}
            </span>
          )}
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-primary/10 text-primary border-primary/20">
            ADMIN
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-all ${
              activeTab === id
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-muted-foreground hover:text-foreground hover:bg-white/3"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-5">
        {/* ── Controls Tab ── */}
        {activeTab === "controls" && (
          <div>
            <div className="mb-4">
              <ToggleRow
                label="Staking"
                enabled={stakingEnabled}
                isLoading={isLoading}
                isPending={togglePending || toggleConfirming}
                onEnable={() => toggle("setStakingEnabled", true)}
                onDisable={() => toggle("setStakingEnabled", false)}
                description="Allow users to stake tokens into this moat"
              />
              <ToggleRow
                label="Locking"
                enabled={lockingEnabled}
                isLoading={isLoading}
                isPending={togglePending || toggleConfirming}
                onEnable={() => toggle("setLockingEnabled", true)}
                onDisable={() => toggle("setLockingEnabled", false)}
                description="Allow users to time-lock staked tokens for multipliers"
              />
              <ToggleRow
                label="Burning"
                enabled={burningEnabled}
                isLoading={isLoading}
                isPending={togglePending || toggleConfirming}
                onEnable={() => toggle("setBurningEnabled", true)}
                onDisable={() => toggle("setBurningEnabled", false)}
                description="Allow users to burn tokens for burn-points"
              />
              <ToggleRow
                label="Early Exit"
                enabled={earlyExitEnabled}
                isLoading={isLoading}
                isPending={togglePending || toggleConfirming}
                onEnable={() => toggle("setEarlyExitEnabled", true)}
                onDisable={() => toggle("setEarlyExitEnabled", false)}
                description="Allow users to exit locks early with a penalty fee"
              />
            </div>

            {/* Pause moat */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Emergency Pause
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Instantly halt all moat interactions. Use only in emergencies.
                  </p>
                </div>
                <button
                  onClick={() => toggle("togglePause", !paused)}
                  disabled={togglePending || toggleConfirming || paused === undefined}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                    paused
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
                      : "bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
                  }`}
                >
                  {togglePending || toggleConfirming ? <Loader2 size={12} className="animate-spin" /> : <Power size={12} />}
                  {paused ? "Unpause" : "Pause Moat"}
                </button>
              </div>
            </div>

            {/* Emergency Unlock */}
            {emergencyUnlockEnabled === false && (
              <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-rose-400 flex items-center gap-1.5">
                      <Lock size={14} /> Emergency Unlock
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Allow all locked stakers to exit immediately. This action is irreversible.
                    </p>
                  </div>
                  <button
                    onClick={() => writeToggle({ address: addr, abi: MOAT_V3_ADMIN_ABI, functionName: "enableEmergencyUnlock", chainId })}
                    disabled={togglePending || toggleConfirming}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 transition-all disabled:opacity-50"
                  >
                    {togglePending || toggleConfirming ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                    Enable
                  </button>
                </div>
              </div>
            )}
            {emergencyUnlockEnabled === true && (
              <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> Emergency unlock is active — all locks are exitable
                </p>
              </div>
            )}

            <TxStatus hash={toggleHash} isPending={togglePending} isConfirming={toggleConfirming} isSuccess={toggleSuccess} error={toggleError} />
          </div>
        )}

        {/* ── Rewards Tab ── */}
        {activeTab === "rewards" && (
          <div className="space-y-5">
            {/* Reward token balances */}
            {rewardTokenAddresses.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Reward Token Balances</p>
                <div className="space-y-2">
                  {rewardTokenAddresses.map((tokenAddr, i) => {
                    const cfg = moat.rewardTokens.find((t) => t.tokenAddress.toLowerCase() === tokenAddr.toLowerCase());
                    const unallocated = rewardTokenUnallocated[i];
                    const dec = cfg?.decimals ?? 18;
                    const symbol = cfg?.symbol ?? tokenAddr.slice(0, 6);
                    return (
                      <div key={tokenAddr} className="flex items-center justify-between rounded-lg bg-white/3 border border-white/5 px-3 py-2">
                        <span className="text-xs font-medium text-white">{symbol}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {unallocated !== undefined ? `${parseFloat(formatUnits(unallocated, dec)).toLocaleString("en-US", { maximumFractionDigits: 4 })} unallocated` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Deposit rewards */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Deposit Rewards</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Reward Token</label>
                  <select
                    value={depositToken}
                    onChange={(e) => setDepositToken(e.target.value)}
                    className="w-full bg-card/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  >
                    <option value="">Select a reward token…</option>
                    {moat.rewardTokens.map((t: RewardToken) => (
                      <option key={t.tokenAddress} value={t.tokenAddress}>
                        {t.symbol} — {formatAddress(t.tokenAddress)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full bg-card/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={submitApprove}
                    disabled={!depositToken || !depositAmount || approvePending || approveConfirming}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold text-white transition-all disabled:opacity-50"
                  >
                    {approvePending || approveConfirming ? <Loader2 size={12} className="animate-spin" /> : <BadgeCheck size={12} />}
                    1. Approve
                  </button>
                  <button
                    onClick={submitDeposit}
                    disabled={!depositToken || !depositAmount || !approveSuccess || depositPending || depositConfirming}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/15 border border-primary/30 hover:bg-primary/25 text-xs font-semibold text-primary transition-all disabled:opacity-50"
                  >
                    {depositPending || depositConfirming ? <Loader2 size={12} className="animate-spin" /> : <ArrowDownToLine size={12} />}
                    2. Deposit
                  </button>
                </div>
                <TxStatus hash={approveHash} isPending={approvePending} isConfirming={approveConfirming} isSuccess={approveSuccess} error={approveError} />
                <TxStatus hash={depositHash} isPending={depositPending} isConfirming={depositConfirming} isSuccess={depositSuccess} error={depositError} />
              </div>
            </div>
          </div>
        )}

        {/* ── Settings Tab ── */}
        {activeTab === "settings" && (
          <div className="space-y-5">
            {/* Unstake fee */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Unstake Fee</p>
              <div className="rounded-lg bg-white/3 border border-white/5 px-3 py-2 mb-3">
                <span className="text-xs text-muted-foreground">Current fee: </span>
                <span className="text-xs font-semibold text-white">{fmtFee(unstakeFee)}</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="New fee % (e.g. 0.50)"
                  value={newFee}
                  onChange={(e) => setNewFee(e.target.value)}
                  step="0.01"
                  min="0"
                  max="100"
                  className="flex-1 bg-card/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                />
                <button
                  onClick={submitFee}
                  disabled={!newFee || feePending || feeConfirming}
                  className="px-4 py-2 rounded-lg bg-primary/15 border border-primary/30 hover:bg-primary/25 text-xs font-semibold text-primary transition-all disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                >
                  {feePending || feeConfirming ? <Loader2 size={12} className="animate-spin" /> : null}
                  Set Fee
                </button>
              </div>
            </div>

            {/* Fee collector */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Fee Collector</p>
              {feeCollectorAddr && (
                <div className="rounded-lg bg-white/3 border border-white/5 px-3 py-2 mb-3">
                  <span className="text-xs text-muted-foreground">Current: </span>
                  <span className="text-xs font-semibold text-white font-mono">{formatAddress(feeCollectorAddr)}</span>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="0x… new fee collector address"
                  value={newFeeCollector}
                  onChange={(e) => setNewFeeCollector(e.target.value)}
                  className="flex-1 bg-card/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 font-mono"
                />
                <button
                  onClick={submitFeeCollector}
                  disabled={!newFeeCollector || feePending || feeConfirming}
                  className="px-4 py-2 rounded-lg bg-primary/15 border border-primary/30 hover:bg-primary/25 text-xs font-semibold text-primary transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  Update
                </button>
              </div>
              <TxStatus hash={feeHash} isPending={feePending} isConfirming={feeConfirming} isSuccess={feeSuccess} error={feeError} />
            </div>

            {/* Add / remove admin */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Admin Access</p>
              <input
                type="text"
                placeholder="0x… wallet address"
                value={adminInput}
                onChange={(e) => setAdminInput(e.target.value)}
                className="w-full bg-card/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 font-mono mb-2"
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={submitAddAdmin}
                  disabled={!adminInput || adminPending || adminConfirming}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-400 transition-all disabled:opacity-50"
                >
                  {adminPending || adminConfirming ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
                  Add Admin
                </button>
                <button
                  onClick={submitRemoveAdmin}
                  disabled={!adminInput || adminPending || adminConfirming}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-xs font-semibold text-rose-400 transition-all disabled:opacity-50"
                >
                  {adminPending || adminConfirming ? <Loader2 size={12} className="animate-spin" /> : <UserMinus size={12} />}
                  Remove Admin
                </button>
              </div>
              <TxStatus hash={adminHash} isPending={adminPending} isConfirming={adminConfirming} isSuccess={adminSuccess} error={adminError} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MoatAdmin() {
  const { address: walletAddress, isConnected } = useAccount();
  const { data: allMoats, isLoading: moatsLoading } = useAllMoatConfigs();

  // Batch-check admins(walletAddress) across all moats in one multicall.
  // We use allowFailure so a single bad moat contract doesn't kill the batch.
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

  // Also check the API `owner` field as a fallback (some moats may not have
  // the `admins` mapping if deployed on a different chain).
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

  const isLoading = moatsLoading || adminLoading;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-20 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          {/* Header */}
          <div className="mb-8 pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Shield size={22} className="text-primary" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">Moat Admin</h1>
            </div>
            <p className="text-muted-foreground text-sm max-w-lg">
              Manage moats your wallet has admin rights to. Controls are gated on-chain — only your
              connected wallet can execute these transactions.
            </p>
          </div>

          {/* Not connected */}
          {!isConnected && (
            <div className="rounded-2xl border border-white/8 bg-card/30 backdrop-blur-xl p-12 text-center">
              <Shield size={40} className="text-muted-foreground mx-auto mb-4 opacity-40" />
              <p className="text-white font-semibold text-lg mb-2">Connect your wallet</p>
              <p className="text-muted-foreground text-sm">
                Connect the wallet that has admin rights to your moat(s) to access controls.
              </p>
            </div>
          )}

          {/* Loading */}
          {isConnected && isLoading && (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-white/8 bg-card/30 h-36 animate-pulse" />
              ))}
            </div>
          )}

          {/* No admin moats */}
          {isConnected && !isLoading && adminMoats.length === 0 && (
            <div className="rounded-2xl border border-white/8 bg-card/30 backdrop-blur-xl p-12 text-center">
              <Shield size={40} className="text-muted-foreground mx-auto mb-4 opacity-40" />
              <p className="text-white font-semibold text-lg mb-2">No admin access found</p>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                The connected wallet ({walletAddress ? formatAddress(walletAddress) : "—"}) does not
                have admin rights on any active moat contracts.
              </p>
            </div>
          )}

          {/* Admin moat panels */}
          {isConnected && !isLoading && adminMoats.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold mb-1">
                {adminMoats.length} moat{adminMoats.length !== 1 ? "s" : ""} with admin access
              </p>
              {adminMoats.map((moat) => (
                <MoatAdminPanel key={`${moat.network}-${moat.contractAddress}`} moat={moat} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

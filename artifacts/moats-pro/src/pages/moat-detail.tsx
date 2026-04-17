import { useState } from "react";
import { useParams } from "wouter";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Zap, Users, TrendingUp, Lock, Gift,
  AlertCircle, CheckCircle, Loader2, Coins, ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import { formatUnits } from "viem";
import { useMoatConfig, useMoatPointsV2, useEvents } from "@/hooks/use-moats-api";
import {
  useMoatStats, useUserMoatInfo, useTokenBalance,
  useTokenAllowance, useStakeMoat, useLockMoat, useClaimRewards, useApproveToken,
} from "@/hooks/use-moat-contract";
import type { MoatContractAddress } from "@/hooks/use-moat-contract";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ActivityFeed } from "@/components/activity-feed";
import { formatAddress, formatPoints, timeAgo } from "@/lib/moat-metadata";

type ActionTab = "stake" | "lock" | "claim";

const networkExplorerTx: Record<string, string> = {
  avalanche: "https://snowtrace.io/tx/",
  ethereum: "https://etherscan.io/tx/",
  arbitrum: "https://arbiscan.io/tx/",
  base: "https://basescan.org/tx/",
  optimism: "https://optimistic.etherscan.io/tx/",
  polygon: "https://polygonscan.com/tx/",
};

const lockMultiplierInfo = [
  { days: 30, multiplier: "2x", label: "1 Month" },
  { days: 90, multiplier: "2.5x", label: "3 Months" },
  { days: 180, multiplier: "3x", label: "6 Months" },
  { days: 365, multiplier: "4x", label: "1 Year" },
  { days: 730, multiplier: "5x", label: "2 Years" },
];

export default function MoatDetail() {
  const params = useParams<{ address: string }>();
  const contractAddress = params.address as MoatContractAddress | undefined;
  const { address: userAddress, isConnected } = useAccount();

  const [activeTab, setActiveTab] = useState<ActionTab>("stake");
  const [stakeAmount, setStakeAmount] = useState("");
  const [lockAmount, setLockAmount] = useState("");
  const [lockDays, setLockDays] = useState(30);

  const { data: moatConfig, isLoading: configLoading } = useMoatConfig(contractAddress);
  const { data: pointsV2 } = useMoatPointsV2(contractAddress);
  const { data: eventsData } = useEvents(contractAddress);
  const stats = useMoatStats(contractAddress as MoatContractAddress | undefined);
  const userInfo = useUserMoatInfo(contractAddress as MoatContractAddress | undefined);
  const tokenBalance = useTokenBalance(stats.stakingToken as MoatContractAddress | undefined);
  const allowance = useTokenAllowance(
    stats.stakingToken as MoatContractAddress | undefined,
    contractAddress as MoatContractAddress | undefined
  );

  const stakeAction = useStakeMoat(contractAddress as MoatContractAddress | undefined);
  const lockAction = useLockMoat(contractAddress as MoatContractAddress | undefined);
  const claimAction = useClaimRewards(contractAddress as MoatContractAddress | undefined);
  const approveAction = useApproveToken(stats.stakingToken as MoatContractAddress | undefined);

  const decimals = tokenBalance.decimals ?? 18;
  const hasAllowanceForStake = allowance.data !== undefined && stakeAmount
    ? allowance.data >= BigInt(Math.floor(parseFloat(stakeAmount || "0") * 10 ** decimals))
    : false;
  const hasAllowanceForLock = allowance.data !== undefined && lockAmount
    ? allowance.data >= BigInt(Math.floor(parseFloat(lockAmount || "0") * 10 ** decimals))
    : false;

  const totalPoints = pointsV2
    ? pointsV2.reduce((sum, p) => sum + p.points, 0)
    : 0;
  const totalTimeWeightedPoints = pointsV2
    ? pointsV2.reduce((sum, p) => sum + (p.timeWeightedPoints || 0), 0)
    : 0;
  const participantCount = pointsV2?.length || 0;

  const totalStakedFormatted =
    stats.totalStaked !== undefined
      ? parseFloat(formatUnits(stats.totalStaked, decimals)).toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })
      : "—";

  const totalBurnedFormatted =
    stats.totalBurned !== undefined
      ? parseFloat(formatUnits(stats.totalBurned, decimals)).toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })
      : "—";

  const userStakedFormatted =
    userInfo.userInfo !== undefined
      ? parseFloat(formatUnits(userInfo.userInfo[0], decimals)).toFixed(4)
      : "0";
  const userBurnFormatted =
    userInfo.userInfo !== undefined
      ? parseFloat(formatUnits(userInfo.userInfo[1], decimals)).toFixed(4)
      : "0";

  const handleStake = () => {
    if (!stakeAmount || !isConnected) return;
    if (!hasAllowanceForStake) {
      approveAction.approve(contractAddress as MoatContractAddress, stakeAmount, decimals);
    } else {
      stakeAction.stake(stakeAmount, decimals);
    }
  };

  const handleLock = () => {
    if (!lockAmount || !isConnected) return;
    if (!hasAllowanceForLock) {
      approveAction.approve(contractAddress as MoatContractAddress, lockAmount, decimals);
    } else {
      lockAction.lock(lockAmount, lockDays, decimals);
    }
  };

  const TxStatus = ({
    isPending, isConfirming, isSuccess, error,
  }: {
    isPending: boolean; isConfirming: boolean; isSuccess: boolean; error: Error | null;
  }) => (
    <AnimatePresence>
      {(isPending || isConfirming || isSuccess || error) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`mt-3 p-3 rounded-xl flex items-center gap-2 text-sm ${
            error
              ? "bg-destructive/10 text-destructive border border-destructive/20"
              : isSuccess
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-primary/10 text-primary border border-primary/20"
          }`}
        >
          {(isPending || isConfirming) && <Loader2 size={14} className="animate-spin" />}
          {isSuccess && <CheckCircle size={14} />}
          {error && <AlertCircle size={14} />}
          <span>
            {isPending
              ? "Confirm in wallet..."
              : isConfirming
              ? "Confirming transaction..."
              : isSuccess
              ? "Transaction confirmed!"
              : error?.message?.slice(0, 80) || "Transaction failed"}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!contractAddress) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <AlertCircle size={40} className="text-destructive" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 pt-28 pb-16">
        {/* Back */}
        <Link
          href="/"
          data-testid="btn-back"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8 text-sm"
        >
          <ArrowLeft size={16} />
          Back to Explore
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          {configLoading ? (
            <div className="h-20 w-full rounded-xl bg-muted/30 animate-pulse" />
          ) : (
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-xl border border-primary/20 shrink-0">
                M
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-3xl font-bold font-mono">
                    {formatAddress(contractAddress)}
                  </h1>
                  {moatConfig?.status && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        moatConfig.status === "Verified"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                      }`}
                    >
                      {moatConfig.status}
                    </span>
                  )}
                  {moatConfig?.network && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted/50 border border-border/50 text-muted-foreground capitalize">
                      {moatConfig.network}
                    </span>
                  )}
                </div>
                <p className="font-mono text-xs text-muted-foreground/60 mb-2">{contractAddress}</p>
                {moatConfig?.rewardStrategy && (
                  <p className="text-muted-foreground text-sm max-w-2xl">
                    {moatConfig.rewardStrategy}
                  </p>
                )}
              </div>
            </div>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* On-chain Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Staked",
                  value: totalStakedFormatted,
                  icon: TrendingUp,
                  color: "text-primary",
                  testId: "stat-total-staked",
                },
                {
                  label: "Total Points",
                  value: formatPoints(totalPoints),
                  icon: Zap,
                  color: "text-cyan-400",
                  testId: "stat-total-points",
                },
                {
                  label: "Participants",
                  value: participantCount.toLocaleString(),
                  icon: Users,
                  color: "text-emerald-400",
                  testId: "stat-participants",
                },
                {
                  label: "Total Burned",
                  value: totalBurnedFormatted,
                  icon: Zap,
                  color: "text-rose-400",
                  testId: "stat-total-burned",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  data-testid={s.testId}
                  className="rounded-xl border border-border bg-card/30 p-4"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <s.icon size={13} className={s.color} />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <p className="font-bold text-lg tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Moat Config Details */}
            {moatConfig && (
              <div className="rounded-2xl border border-border bg-card/30 p-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Coins size={16} className="text-primary" />
                  Reward Tokens
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {moatConfig.rewardTokens.filter((t) => t.enabled).map((token) => (
                    <div
                      key={token._id}
                      className="p-4 rounded-xl border border-border bg-background/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-primary">{token.symbol}</span>
                        <span className="text-xs text-muted-foreground">{token.name}</span>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Daily Reward</span>
                          <span className="font-medium text-foreground">
                            {token.tokenAmount >= 1_000_000
                              ? `${(token.tokenAmount / 1_000_000).toFixed(2)}M`
                              : token.tokenAmount >= 1_000
                              ? `${(token.tokenAmount / 1_000).toFixed(0)}K`
                              : token.tokenAmount}{" "}
                            {token.symbol}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Deposited</span>
                          <span className="font-medium text-foreground">
                            {(token.totalRewardsDeposited / 1_000_000).toFixed(2)}M
                          </span>
                        </div>
                        {token.lastProcessed && (
                          <div className="flex justify-between">
                            <span>Last Distributed</span>
                            <span className="font-medium text-foreground">
                              {timeAgo(new Date(token.lastProcessed).getTime())}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Additional moat meta */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  {[
                    { label: "Fort Weight", value: `${moatConfig.fortWeight}x` },
                    { label: "Moat Version", value: `v${moatConfig.moatVersion}` },
                    { label: "Auto Rewards", value: moatConfig.automatedRewards ? "Yes" : "No" },
                    { label: "Time-Weighted", value: moatConfig.timeWeightedPointsEnabled ? `${moatConfig.timeWeightPercentage}%` : "Disabled" },
                    { label: "Boost Active", value: moatConfig.boostActive ? `${moatConfig.boostValue}x` : "No" },
                    { label: "Created", value: new Date(moatConfig.createdAt).toLocaleDateString() },
                  ].map((item) => (
                    <div key={item.label} className="text-xs">
                      <p className="text-muted-foreground">{item.label}</p>
                      <p className="font-semibold text-foreground mt-0.5">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User Position */}
            {isConnected && (
              <div className="rounded-2xl border border-border bg-card/30 p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  Your Position
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Staked", value: userStakedFormatted, testId: "user-staked" },
                    { label: "Burned", value: userBurnFormatted, testId: "user-burned" },
                    {
                      label: "Staking Pts",
                      value: formatPoints(Number(userInfo.userInfo?.[2] ?? 0n)),
                      testId: "user-staking-points",
                    },
                    {
                      label: "Burn Pts",
                      value: formatPoints(Number(userInfo.userInfo?.[3] ?? 0n)),
                      testId: "user-burn-points",
                    },
                  ].map((item) => (
                    <div key={item.label} data-testid={item.testId}>
                      <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                      <p className="font-bold text-xl tabular-nums">{item.value}</p>
                    </div>
                  ))}
                </div>

                {userInfo.pendingRewards && userInfo.pendingRewards[0].length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">Pending Rewards</p>
                    <div className="flex flex-wrap gap-2">
                      {userInfo.pendingRewards[0].map((token, i) => (
                        <span
                          key={token}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-400"
                        >
                          {parseFloat(formatUnits(userInfo.pendingRewards![1][i], 18)).toFixed(6)}{" "}
                          from {formatAddress(token)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Top Stakers (from points v2) */}
            {pointsV2 && pointsV2.length > 0 && (
              <div className="rounded-2xl border border-border bg-card/30 overflow-hidden">
                <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
                  <h3 className="font-semibold">Top Stakers</h3>
                  <span className="text-xs text-muted-foreground">
                    {totalTimeWeightedPoints > 0 && `${formatPoints(totalTimeWeightedPoints)} TW pts total`}
                  </span>
                </div>
                <div className="divide-y divide-border/50">
                  {[...pointsV2]
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 10)
                    .map((entry, i) => (
                      <div
                        key={entry.walletAddress}
                        data-testid={`row-staker-${i}`}
                        className="px-6 py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="font-mono text-sm">{formatAddress(entry.walletAddress)}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-primary text-sm tabular-nums">
                            {formatPoints(entry.points)} pts
                          </span>
                          {entry.timeWeightedPoints > 0 && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {formatPoints(entry.timeWeightedPoints)} TW
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Recent Events for this contract */}
            {eventsData && eventsData.results.length > 0 && (
              <div>
                <h3 className="font-semibold mb-4 flex items-center justify-between">
                  <span>Recent Activity</span>
                  <span className="text-sm text-muted-foreground font-normal">
                    {eventsData.total.toLocaleString()} total events
                  </span>
                </h3>
                <ActivityFeed events={eventsData.results.slice(0, 8)} />
              </div>
            )}
          </div>

          {/* Right: Action Panel */}
          <div>
            <div className="rounded-2xl border border-border bg-card/30 overflow-hidden sticky top-24">
              {/* Tabs */}
              <div className="flex border-b border-border">
                {(["stake", "lock", "claim"] as ActionTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveTab(t)}
                    data-testid={`tab-action-${t}`}
                    className={`flex-1 py-3.5 text-sm font-medium capitalize transition-all ${
                      activeTab === t
                        ? "text-primary border-b-2 border-primary bg-primary/5"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "stake" && <TrendingUp size={14} className="inline mr-1.5" />}
                    {t === "lock" && <Lock size={14} className="inline mr-1.5" />}
                    {t === "claim" && <Gift size={14} className="inline mr-1.5" />}
                    {t}
                  </button>
                ))}
              </div>

              <div className="p-6">
                {!isConnected ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground text-sm mb-4">
                      Connect your wallet to interact with this Moat
                    </p>
                    <w3m-button />
                  </div>
                ) : (
                  <>
                    {tokenBalance.balance !== undefined && (
                      <div className="mb-4 p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Wallet Balance</span>
                        <span className="text-sm font-bold tabular-nums">
                          {parseFloat(tokenBalance.formatted || "0").toFixed(4)}{" "}
                          {tokenBalance.symbol}
                        </span>
                      </div>
                    )}

                    {/* Stake */}
                    {activeTab === "stake" && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block">
                            Amount to Stake
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={stakeAmount}
                              onChange={(e) => setStakeAmount(e.target.value)}
                              placeholder="0.00"
                              data-testid="input-stake-amount"
                              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm pr-16"
                            />
                            <button
                              onClick={() => setStakeAmount(tokenBalance.formatted || "0")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-medium hover:text-primary/80"
                            >
                              MAX
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground p-3 rounded-xl bg-muted/20 border border-border/30 space-y-1">
                          <p className="flex justify-between">
                            <span>Points per token</span>
                            <span className="font-medium text-foreground">1x</span>
                          </p>
                          <p className="flex justify-between">
                            <span>Unstake fee</span>
                            <span className="font-medium text-foreground">
                              {stats.unstakeFee !== undefined
                                ? `${Number(stats.unstakeFee) / 100}%`
                                : "5%"}
                            </span>
                          </p>
                          {moatConfig?.fortWeight && (
                            <p className="flex justify-between">
                              <span>FortWeight boost</span>
                              <span className="font-medium text-primary">{moatConfig.fortWeight}x</span>
                            </p>
                          )}
                        </div>
                        <button
                          onClick={handleStake}
                          disabled={!stakeAmount || stakeAction.isPending || stakeAction.isConfirming || approveAction.isPending}
                          data-testid="btn-stake"
                          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                          {approveAction.isPending || approveAction.isConfirming ? (
                            <><Loader2 size={14} className="animate-spin" />Approving...</>
                          ) : stakeAction.isPending || stakeAction.isConfirming ? (
                            <><Loader2 size={14} className="animate-spin" />Staking...</>
                          ) : !hasAllowanceForStake && stakeAmount ? (
                            "Approve First"
                          ) : (
                            <><TrendingUp size={14} />Stake Tokens</>
                          )}
                        </button>
                        <TxStatus
                          isPending={stakeAction.isPending || approveAction.isPending}
                          isConfirming={stakeAction.isConfirming || approveAction.isConfirming}
                          isSuccess={stakeAction.isSuccess || approveAction.isSuccess}
                          error={stakeAction.error || approveAction.error}
                        />
                      </div>
                    )}

                    {/* Lock */}
                    {activeTab === "lock" && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block">
                            Amount to Lock
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={lockAmount}
                              onChange={(e) => setLockAmount(e.target.value)}
                              placeholder="0.00"
                              data-testid="input-lock-amount"
                              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm pr-16"
                            />
                            <button
                              onClick={() => setLockAmount(tokenBalance.formatted || "0")}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-medium"
                            >
                              MAX
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-2 block">
                            Lock Duration
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {lockMultiplierInfo.slice(0, 3).map((option) => (
                              <button
                                key={option.days}
                                onClick={() => setLockDays(option.days)}
                                data-testid={`btn-lock-duration-${option.days}`}
                                className={`p-2 rounded-lg text-xs font-medium border transition-all ${
                                  lockDays === option.days
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:border-primary/50"
                                }`}
                              >
                                <div>{option.label}</div>
                                <div className="font-bold">{option.multiplier}</div>
                              </button>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {lockMultiplierInfo.slice(3).map((option) => (
                              <button
                                key={option.days}
                                onClick={() => setLockDays(option.days)}
                                data-testid={`btn-lock-duration-${option.days}`}
                                className={`p-2 rounded-lg text-xs font-medium border transition-all ${
                                  lockDays === option.days
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:border-primary/50"
                                }`}
                              >
                                <div>{option.label}</div>
                                <div className="font-bold">{option.multiplier}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={handleLock}
                          disabled={!lockAmount || lockAction.isPending || lockAction.isConfirming || approveAction.isPending}
                          data-testid="btn-lock"
                          className="w-full py-3.5 rounded-xl bg-cyan-500 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                          {lockAction.isPending || lockAction.isConfirming ? (
                            <><Loader2 size={14} className="animate-spin" />Locking...</>
                          ) : !hasAllowanceForLock && lockAmount ? (
                            "Approve First"
                          ) : (
                            <><Lock size={14} />Lock Tokens</>
                          )}
                        </button>
                        <TxStatus
                          isPending={lockAction.isPending || approveAction.isPending}
                          isConfirming={lockAction.isConfirming || approveAction.isConfirming}
                          isSuccess={lockAction.isSuccess || approveAction.isSuccess}
                          error={lockAction.error || approveAction.error}
                        />
                      </div>
                    )}

                    {/* Claim */}
                    {activeTab === "claim" && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                          <Gift size={28} className="mx-auto mb-2 text-emerald-400" />
                          <p className="text-sm text-muted-foreground">
                            Claim all pending rewards from this Moat
                          </p>
                          {userInfo.pendingRewards && userInfo.pendingRewards[0].length > 0 ? (
                            <div className="mt-3 space-y-1.5">
                              {userInfo.pendingRewards[0].map((token, i) => (
                                <div
                                  key={token}
                                  className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-background/50 text-xs"
                                >
                                  <span className="font-mono text-muted-foreground">
                                    {formatAddress(token)}
                                  </span>
                                  <span className="font-bold text-emerald-400">
                                    {parseFloat(formatUnits(userInfo.pendingRewards![1][i], 18)).toFixed(6)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-2">No pending rewards</p>
                          )}
                        </div>
                        <button
                          onClick={() => claimAction.claim()}
                          disabled={claimAction.isPending || claimAction.isConfirming}
                          data-testid="btn-claim"
                          className="w-full py-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                          {claimAction.isPending || claimAction.isConfirming ? (
                            <><Loader2 size={14} className="animate-spin" />Claiming...</>
                          ) : (
                            <><Gift size={14} />Claim All Rewards</>
                          )}
                        </button>
                        <TxStatus
                          isPending={claimAction.isPending}
                          isConfirming={claimAction.isConfirming}
                          isSuccess={claimAction.isSuccess}
                          error={claimAction.error}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Owner link */}
              {moatConfig?.owner && (
                <div className="px-6 py-4 border-t border-border/50 bg-muted/10">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Owner</span>
                    <span className="font-mono">{formatAddress(moatConfig.owner)}</span>
                  </div>
                  {moatConfig.publicAddress && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      <span>Public Address</span>
                      <span className="font-mono">{formatAddress(moatConfig.publicAddress)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

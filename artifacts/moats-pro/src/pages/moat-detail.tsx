import { useState, useEffect, useMemo } from "react";
import { useParams } from "wouter";
import { useAccount, useReadContracts, useReadContract } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Zap, Users, TrendingUp, Lock, Gift, Flame,
  AlertCircle, CheckCircle, Loader2, Coins, ExternalLink,
  Unlock, Clock, AlertTriangle, Wallet, Sparkles,
} from "lucide-react";
import { Link } from "wouter";
import { formatUnits, parseUnits } from "viem";
import { useMoatConfig, useMoatPointsV2, useUserMoatPointsV2, useEvents } from "@/hooks/use-moats-api";
import { getActiveBoosts, getBoostTier, getEffectiveBoostValue, getMaxBoostValue, type BoostConfig, type BoostTier } from "@/lib/moats-api";
import {
  useMoatStats, useUserMoatInfo, useTokenBalance,
  useTokenAllowance, useStakeMoat, useLockMoat, useClaimRewards, useApproveToken, useUnstakeMoat, useNftBoostBalances, useBurnMoat, useExitLock, useUserLocks,
} from "@/hooks/use-moat-contract";
import type { MoatContractAddress } from "@/hooks/use-moat-contract";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ActivityFeed } from "@/components/activity-feed";
import { MoatLogo } from "@/components/moat-card";
import { SimilarMoats } from "@/components/similar-moats";
import { formatAddress, formatPoints, timeAgo, getMoatMeta, formatUSD } from "@/lib/moat-metadata";
import { useTokenPrices, getLlamaId } from "@/hooks/use-token-prices";
import { useDexscreenerInfo } from "@/hooks/use-dexscreener";
import { useResolveMoatMetas } from "@/hooks/use-resolve-moat-metas";
import { useDailyRewardEstimates } from "@/hooks/use-daily-reward-estimates";
import { useRewardPoolBalances } from "@/hooks/use-reward-pool-balances";
import { useContractRewardBalances } from "@/hooks/use-contract-reward-balances";
import { useMoatPointsSim, estimateMoatPoints, estimatePoolShare } from "@/hooks/use-moat-points-sim";
import { ERC20_ABI, MOAT_LOGO_ABI } from "@/lib/moat-abi";

type ActionTab = "stake" | "lock" | "claim" | "withdraw" | "burn";

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

function getLockMultiplierLabel(days: number): string {
  const match = lockMultiplierInfo.find((o) => o.days === days);
  return match?.multiplier ?? "1x";
}

function formatPoolShare(pct: number): string {
  if (pct >= 1) return pct.toFixed(2);
  if (pct >= 0.01) return pct.toFixed(3);
  return pct.toPrecision(2);
}

function PointsEstimateBox({
  gained,
  poolShare,
  ready,
  loading,
  hasAmount,
}: {
  gained: number;
  poolShare: number | null;
  ready: boolean;
  loading: boolean;
  hasAmount: boolean;
}) {
  if (!hasAmount || (!ready && !loading)) return null;
  return (
    <div className="text-xs p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <Sparkles size={13} className="text-primary" /> Est. Moat Points
        </span>
        <span className="font-semibold text-primary tabular-nums" data-testid="points-estimate">
          {loading && !ready ? "…" : `+${formatPoints(gained)}`}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Est. % of pool</span>
        <span className="font-semibold text-primary tabular-nums" data-testid="pool-share-estimate">
          {loading && !ready ? "…" : poolShare != null ? `${formatPoolShare(poolShare)}%` : "—"}
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground/70 leading-tight">
        Estimated from current epoch activity — actual points accrue over time.
      </p>
    </div>
  );
}

function formatTierRange(tier: BoostTier): string {
  if (tier.maxHolding == null) return `${tier.minHolding}+`;
  if (tier.minHolding === tier.maxHolding) return `${tier.minHolding}`;
  return `${tier.minHolding}–${tier.maxHolding}`;
}

function NftBoostTiers({
  boosts,
  balances,
  isConnected,
}: {
  boosts: BoostConfig[];
  balances: (bigint | undefined)[];
  isConnected: boolean;
}) {
  if (boosts.length === 0) return null;
  const multi = boosts.length > 1;
  return (
    <div className="rounded-2xl border border-border bg-card/30 p-6">
      <h3 className="font-semibold mb-1 flex items-center gap-2">
        <Zap size={16} className="text-primary" />
        NFT Boosts
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Hold boost NFTs to multiply your Moat Points. The more you hold, the higher the tier.
      </p>
      <div className="space-y-4">
        {boosts.map((boost, i) => {
          const held = Number(balances[i] ?? 0n);
          const tiers = boost.tiers ?? [];
          const currentTier = getBoostTier(boost, held);
          const effective = isConnected ? getEffectiveBoostValue(boost, held) : 0;
          return (
            <div
              key={boost.contractAddress}
              data-testid={`nft-boost-tiers-${boost.contractAddress.toLowerCase()}`}
              className="rounded-xl border border-border/50 bg-muted/10 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono text-muted-foreground">
                  {multi ? `Collection ${i + 1} · ` : ""}{formatAddress(boost.contractAddress)}
                </span>
                {isConnected ? (
                  <span className={`text-xs font-semibold ${held > 0 ? "text-primary" : "text-muted-foreground"}`}>
                    {held} held{held > 0 ? ` · ${effective}% active` : ""}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-muted-foreground">
                    up to {getMaxBoostValue(boost)}%
                  </span>
                )}
              </div>
              {tiers.length > 0 ? (
                <div className="space-y-1.5">
                  {tiers.map((tier) => {
                    const active = isConnected && currentTier === tier;
                    return (
                      <div
                        key={`${tier.minHolding}-${tier.maxHolding}-${tier.boostValue}`}
                        className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${
                          active
                            ? "bg-primary/10 border border-primary/30"
                            : "bg-background/40 border border-transparent"
                        }`}
                      >
                        <span className={active ? "text-primary font-medium" : "text-muted-foreground"}>
                          {formatTierRange(tier)} NFT{tier.maxHolding === 1 ? "" : "s"}
                          {active && " · your tier"}
                        </span>
                        <span className={`tabular-nums font-semibold ${active ? "text-primary" : "text-foreground"}`}>
                          {tier.boostValue}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs rounded-lg px-3 py-2 bg-background/40">
                  <span className="text-muted-foreground">Any holding</span>
                  <span className="tabular-nums font-semibold text-foreground">{boost.boostValue}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getLockDurationLabel(originalDurationSecs: bigint): string {
  const secs = Number(originalDurationSecs);
  const days = Math.round(secs / (24 * 3600));
  if (days >= 700) return "2 Years · 5x";
  if (days >= 350) return "1 Year · 4x";
  if (days >= 150) return "6 Months · 3x";
  if (days >= 80) return "3 Months · 2.5x";
  if (days >= 25) return "1 Month · 2x";
  return `${days} days`;
}

function formatTimeRemaining(endTimestamp: bigint): string {
  const remainingMs = Number(endTimestamp) * 1000 - Date.now();
  if (remainingMs <= 0) return "Ready to exit";
  const secs = Math.floor(remainingMs / 1000);
  if (secs >= 365 * 24 * 3600) {
    const y = Math.floor(secs / (365 * 24 * 3600));
    return `${y} year${y > 1 ? "s" : ""} left`;
  }
  if (secs >= 30 * 24 * 3600) {
    const m = Math.floor(secs / (30 * 24 * 3600));
    return `${m} month${m > 1 ? "s" : ""} left`;
  }
  if (secs >= 24 * 3600) {
    const d = Math.floor(secs / (24 * 3600));
    return `${d} day${d > 1 ? "s" : ""} left`;
  }
  const h = Math.floor(secs / 3600);
  return h > 0 ? `${h}h left` : "< 1h left";
}

export default function MoatDetail() {
  const params = useParams<{ address: string }>();
  const contractAddress = params.address as MoatContractAddress | undefined;
  const { address: userAddress, isConnected } = useAccount();

  const { open } = useAppKit();

  const [activeTab, setActiveTab] = useState<ActionTab>("stake");
  const [stakeAmount, setStakeAmount] = useState("");
  const [lockAmount, setLockAmount] = useState("");
  const [lockDays, setLockDays] = useState(30);

  const { data: moatConfig, isLoading: configLoading } = useMoatConfig(contractAddress);
  const { data: onChainLogoUrl } = useReadContract({
    address: contractAddress as `0x${string}` | undefined,
    abi: MOAT_LOGO_ABI,
    functionName: "getLogoURL",
    query: { enabled: !!contractAddress, staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  });
  const { data: pointsV2 } = useMoatPointsV2(contractAddress);
  const { data: userMoatPoints } = useUserMoatPointsV2(userAddress, contractAddress);
  const { data: eventsData } = useEvents(contractAddress);
  const stats = useMoatStats(contractAddress as MoatContractAddress | undefined);
  const userInfo = useUserMoatInfo(contractAddress as MoatContractAddress | undefined);
  const tokenBalance = useTokenBalance(stats.stakingToken as MoatContractAddress | undefined);
  const allowance = useTokenAllowance(
    stats.stakingToken as MoatContractAddress | undefined,
    contractAddress as MoatContractAddress | undefined
  );

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [burnAmount, setBurnAmount] = useState("");

  const fmtAmt = (raw: string): string => {
    if (!raw) return "";
    const [int, dec] = raw.split(".");
    const n = parseInt(int || "0", 10);
    const formatted = isNaN(n) ? (int || "") : n.toLocaleString("en-US");
    return dec !== undefined ? `${formatted}.${dec}` : formatted;
  };
  const parseAmt = (display: string): string =>
    display.replace(/,/g, "").replace(/[^0-9.]/g, "");
  const [earlyExitConfirm, setEarlyExitConfirm] = useState<number | null>(null);

  const fmtTokenAmt = (n: number): string => {
    if (n === 0) return "0";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (n >= 1) return n.toFixed(4);
    if (n >= 0.000001) return n.toFixed(6);
    return "< 0.000001";
  };

  const stakeAction = useStakeMoat(contractAddress as MoatContractAddress | undefined);
  const lockAction = useLockMoat(contractAddress as MoatContractAddress | undefined);
  const claimAction = useClaimRewards(contractAddress as MoatContractAddress | undefined);
  const approveAction = useApproveToken(stats.stakingToken as MoatContractAddress | undefined);
  const unstakeAction = useUnstakeMoat(contractAddress as MoatContractAddress | undefined);
  const burnAction = useBurnMoat(contractAddress as MoatContractAddress | undefined);
  const exitAction = useExitLock(contractAddress as MoatContractAddress | undefined);
  // Resolve every active boost NFT for this moat (multi-NFT via boostConfigs[],
  // with legacy nftBoostContract as fallback) so pro.moats.app shows the same
  // boosts that moats.app does.
  const activeBoosts: BoostConfig[] = useMemo(() => getActiveBoosts(moatConfig), [moatConfig]);
  const activeBoostAddresses = useMemo(
    () => activeBoosts.map((b: BoostConfig) => b.contractAddress as `0x${string}`),
    [activeBoosts],
  );
  const { balances: nftBoostBalances } = useNftBoostBalances(activeBoostAddresses);

  const activeLockCount = Number(userInfo.userInfo?.[4] ?? 0n);
  const { locks, isLoading: locksLoading, refetch: refetchLocks } = useUserLocks(
    contractAddress as MoatContractAddress | undefined,
    userAddress,
    activeLockCount
  );

  useEffect(() => {
    if (exitAction.isSuccess) {
      refetchLocks();
      userInfo.refetch();
    }
  }, [exitAction.isSuccess]);

  // Refetch allowance immediately after an approval confirms so the
  // action button flips from "Approve First" to the real action (Stake/Lock/Burn).
  useEffect(() => {
    if (approveAction.isSuccess) {
      allowance.refetch();
    }
  }, [approveAction.isSuccess]);

  // Refetch user info after a claim so pendingRewards goes back to 0
  // and the Stake/Lock/Burn buttons unblock immediately.
  useEffect(() => {
    if (claimAction.isSuccess) {
      userInfo.refetch();
    }
  }, [claimAction.isSuccess]);

  const network = moatConfig?.network ?? "avalanche";
  // The backend config can contain duplicate reward-token entries for the same
  // token address (same token, different _id) — e.g. MyStandard's MYST appears
  // twice. Dedupe by token address so the UI shows each reward token once.
  const enabledRewardTokens = useMemo(() => {
    const seen = new Set<string>();
    const out: NonNullable<typeof moatConfig>["rewardTokens"] = [];
    for (const t of moatConfig?.rewardTokens ?? []) {
      if (!t.enabled || !t.tokenAddress) continue;
      const key = t.tokenAddress.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out;
  }, [moatConfig?.rewardTokens]);
  const rewardLlamaIds = enabledRewardTokens.map((t) =>
    getLlamaId(network, t.tokenAddress),
  );
  const stakingLlamaId = stats.stakingToken ? getLlamaId(network, stats.stakingToken) : "";
  const allLlamaIds = [...new Set([...rewardLlamaIds, ...(stakingLlamaId ? [stakingLlamaId] : [])])];
  const { data: priceMap } = useTokenPrices(allLlamaIds);
  // Query DexScreener for the staking token AND every enabled reward token so
  // we can show a USD value for reward tokens that aren't listed on DefiLlama
  // (e.g. HEFE), falling back to DexScreener's liquidity-weighted price.
  const dexLookupAddrs = useMemo(() => {
    const addrs = new Set<string>();
    if (stats.stakingToken) addrs.add(stats.stakingToken);
    for (const t of enabledRewardTokens) {
      if (t.tokenAddress) addrs.add(t.tokenAddress);
    }
    return [...addrs];
  }, [stats.stakingToken, enabledRewardTokens]);
  const { data: dexInfoMap } = useDexscreenerInfo(dexLookupAddrs);
  useResolveMoatMetas(
    contractAddress
      ? [{ contractAddress, stakingToken: stats.stakingToken ?? undefined, network }]
      : [],
  );
  const dailyEstimates = useDailyRewardEstimates(moatConfig ? [moatConfig] : undefined);
  const poolBalances = useRewardPoolBalances(moatConfig ? [moatConfig] : undefined);
  const contractRewardBalances = useContractRewardBalances(moatConfig ? [moatConfig] : undefined);
  const moatLowerKey = (contractAddress ?? "").toLowerCase();
  const getEstDaily = (tokenAddr: string) =>
    dailyEstimates[`${moatLowerKey}_${tokenAddr.toLowerCase()}`] ?? 0;
  const getPoolBalance = (tokenAddr: string) =>
    poolBalances[`${moatLowerKey}_${tokenAddr.toLowerCase()}`] ?? 0;
  const getContractBalance = (tokenAddr: string) =>
    contractRewardBalances[`${moatLowerKey}_${tokenAddr.toLowerCase()}`] ?? 0;
  const stakingTokenPrice = stats.stakingToken
    ? (dexInfoMap?.[stats.stakingToken.toLowerCase()]?.price ?? 0)
    : 0;
  // Unified USD price for a reward token: prefer DefiLlama, fall back to
  // DexScreener so reward tokens missing from Llama still show a dollar value.
  const getRewardTokenPrice = (tokenAddr: string): number => {
    const id = getLlamaId(network, tokenAddr);
    return priceMap?.[id] ?? dexInfoMap?.[tokenAddr.toLowerCase()]?.price ?? 0;
  };

  const pendingRewardTokenAddrs = userInfo.pendingRewards?.[0] ?? [];
  const { data: pendingRewardDecimals } = useReadContracts({
    contracts: pendingRewardTokenAddrs.map((addr) => ({
      address: addr as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals" as const,
    })),
    query: { enabled: pendingRewardTokenAddrs.length > 0 },
  });
  const getPendingRewardDecimals = (idx: number): number => {
    const fromConfig = moatConfig?.rewardTokens.find(
      (t) => t.tokenAddress?.toLowerCase() === pendingRewardTokenAddrs[idx]?.toLowerCase()
    );
    if (fromConfig?.decimals) return fromConfig.decimals;
    const r = pendingRewardDecimals?.[idx];
    return r?.status === "success" ? Number(r.result) : 18;
  };

  const decimals = tokenBalance.decimals ?? 18;

  // Safely convert a user-entered decimal string to a BigInt of token base units.
  // parseUnits is precise (no float math) but throws on malformed strings;
  // we sanitize and clamp the fractional part to `decimals` so things like
  // "11000.123456789012345678999" do not throw.
  const toBaseUnits = (raw: string, dec: number): bigint => {
    if (!raw) return 0n;
    const cleaned = raw.replace(/,/g, "").trim();
    if (!cleaned || cleaned === ".") return 0n;
    const [intPart, fracPart = ""] = cleaned.split(".");
    const safeInt = intPart.replace(/[^0-9]/g, "") || "0";
    const safeFrac = fracPart.replace(/[^0-9]/g, "").slice(0, dec);
    try {
      return parseUnits(`${safeInt}${safeFrac ? "." + safeFrac : ""}`, dec);
    } catch {
      return 0n;
    }
  };

  const hasAllowanceForStake = allowance.data !== undefined && stakeAmount
    ? allowance.data >= toBaseUnits(stakeAmount, decimals)
    : false;
  const hasAllowanceForLock = allowance.data !== undefined && lockAmount
    ? allowance.data >= toBaseUnits(lockAmount, decimals)
    : false;
  const hasAllowanceForBurn = allowance.data !== undefined && burnAmount
    ? allowance.data >= toBaseUnits(burnAmount, decimals)
    : false;

  const leaderboard = pointsV2?.leaderboard ?? [];
  const totalPoints = leaderboard.reduce((sum, p) => sum + p.points, 0);
  const totalTimeWeightedPoints = 0; // not available in v2 leaderboard response
  const participantCount = leaderboard.length;

  const compactToken = (raw: bigint): string => {
    const n = parseFloat(formatUnits(raw, decimals));
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const totalStakedFormatted = stats.totalStaked !== undefined ? compactToken(stats.totalStaked) : "—";
  const totalLockedFormatted = stats.totalLocked !== undefined ? compactToken(stats.totalLocked) : "—";
  const totalBurnedFormatted = stats.totalBurned !== undefined ? compactToken(stats.totalBurned) : "—";

  const fmtUserAmt = (n: number) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  const userStakedFormatted =
    userInfo.userInfo !== undefined
      ? fmtUserAmt(parseFloat(formatUnits(userInfo.userInfo[0], decimals)))
      : "0";
  const userBurnFormatted =
    userInfo.userInfo !== undefined
      ? fmtUserAmt(parseFloat(formatUnits(userInfo.userInfo[1], decimals)))
      : "0";
  const userLockedAmount = locks.filter((l) => l.active).reduce((sum, l) => sum + l.amount, 0n);
  const userLockedFormatted = fmtUserAmt(parseFloat(formatUnits(userLockedAmount, decimals)));
  const userMoatPointsValue = userMoatPoints?.points ?? 0;
  // "Your Moat Weight" = the user's share of the pool. The v2 leaderboard
  // exposes a per-wallet `weight` that already sums to 100 across the moat
  // (the linear staked/locked/burned share), which is what moats.app shows.
  // Points are sqrt-derived, so a points/totalPoints ratio is NOT the weight.
  const userLeaderboardEntry = useMemo(() => {
    if (!userAddress) return undefined;
    return leaderboard.find(
      (e) => e.address.toLowerCase() === userAddress.toLowerCase()
    );
  }, [leaderboard, userAddress]);
  const userLeaderboardWeight = userLeaderboardEntry?.weight;

  // Moat Points simulation: calibrate the points model from the leaderboard so
  // we can estimate the points a stake/lock/burn would yield before the tx.
  const pointsSim = useMoatPointsSim(contractAddress, leaderboard);
  const lockWeightForDays = (days: number): number => {
    const m = lockMultiplierInfo.find((o) => o.days === days);
    return m ? parseFloat(m.multiplier) : 2;
  };
  const getEstimatedPoints = (rawAmount: string, actionWeight: number): number => {
    if (!pointsSim.ready || pointsSim.k == null) return 0;
    const amt = parseFloat(rawAmount);
    if (!amt || amt <= 0) return 0;
    return estimateMoatPoints(pointsSim.k, userMoatPointsValue, amt, actionWeight).gained;
  };
  // Pool weight ∝ basePoints^2 * boostMultiplier (verified against the v2
  // leaderboard `weight` field). Sum that contribution across the moat so the
  // pre-tx "% of pool" estimate accounts for NFT boosts.
  const sumBoostedBaseSq = useMemo(
    () =>
      leaderboard.reduce((s, e) => {
        const base = e.basePoints ?? e.points;
        const mult = e.boostMultiplier && e.boostMultiplier > 0 ? e.boostMultiplier : 1;
        return s + base * base * mult;
      }, 0),
    [leaderboard],
  );
  const getEstimatedPoolShare = (rawAmount: string, actionWeight: number): number | null => {
    if (!pointsSim.ready || pointsSim.k == null) return null;
    const amt = parseFloat(rawAmount);
    if (!amt || amt <= 0) return null;
    const userBase = userLeaderboardEntry?.basePoints ?? userLeaderboardEntry?.points ?? 0;
    const userMult =
      userLeaderboardEntry?.boostMultiplier && userLeaderboardEntry.boostMultiplier > 0
        ? userLeaderboardEntry.boostMultiplier
        : 1;
    return estimatePoolShare(pointsSim.k, userBase, userMult, sumBoostedBaseSq, amt, actionWeight);
  };

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

  const handleWithdraw = () => {
    if (!withdrawAmount || !isConnected) return;
    unstakeAction.unstake(withdrawAmount, decimals);
  };

  const handleBurn = () => {
    if (!burnAmount || !isConnected) return;
    if (!hasAllowanceForBurn) {
      approveAction.approve(contractAddress as MoatContractAddress, burnAmount, decimals);
    } else {
      burnAction.burn(burnAmount, decimals);
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
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl skeleton-shimmer shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-7 w-2/3 rounded-md skeleton-shimmer" />
                <div className="h-3 w-1/3 rounded-md skeleton-shimmer" />
                <div className="h-3 w-1/2 rounded-md skeleton-shimmer" />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              <MoatLogo
                meta={getMoatMeta(contractAddress)}
                primaryTokenAddress={
                  moatConfig?.rewardTokens?.filter((t) => t.enabled)[0]?.tokenAddress ||
                  getMoatMeta(contractAddress).tokenAddress
                }
                onChainLogoUrl={onChainLogoUrl ?? undefined}
                size="lg"
              />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-3xl font-bold">
                    {getMoatMeta(contractAddress).name}
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
                <p className="text-xs text-muted-foreground mb-0.5">{getMoatMeta(contractAddress).protocol}</p>
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                {
                  label: "Total Staked",
                  value: totalStakedFormatted,
                  icon: TrendingUp,
                  color: "text-primary",
                  testId: "stat-total-staked",
                },
                {
                  label: "Total Locked",
                  value: totalLockedFormatted,
                  icon: Lock,
                  color: "text-violet-400",
                  testId: "stat-total-locked",
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
                  className="rounded-xl border border-border bg-card/30 p-4 min-w-0 overflow-hidden"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <s.icon size={13} className={s.color} />
                    <span className="text-xs text-muted-foreground truncate">{s.label}</span>
                  </div>
                  <p className="font-bold text-base tabular-nums truncate">{s.value}</p>
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
                  {enabledRewardTokens.map((token) => (
                    <div
                      key={token._id}
                      className="p-4 rounded-xl border border-transparent bg-card/40 backdrop-blur-sm transition-all duration-200"
                      style={{
                        background: "linear-gradient(hsl(var(--card) / 0.5), hsl(var(--card) / 0.5)) padding-box, linear-gradient(135deg, rgba(52,211,153,0.3) 0%, rgba(0,212,255,0.08) 100%) border-box",
                        boxShadow: "0 0 16px rgba(52,211,153,0.04)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-primary">{token.symbol}</span>
                        <span className="text-xs text-muted-foreground">{token.name}</span>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Daily Reward</span>
                          <span className="font-medium text-foreground">
                            {(() => {
                              const est = getEstDaily(token.tokenAddress);
                              const freqH = token.frequencyHours ?? 24;
                              const distsPerDay = freqH > 0 ? 24 / freqH : 1;
                              const amt = token.tokenAmount > 0 ? token.tokenAmount * distsPerDay : est;
                              const prefix = token.tokenAmount > 0 ? "" : est > 0 ? "~" : "";
                              const fmt =
                                amt >= 1_000_000 ? `${(amt / 1_000_000).toFixed(2)}M`
                                : amt >= 1_000 ? `${(amt / 1_000).toFixed(0)}K`
                                : amt >= 1 ? amt.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                : amt > 0 ? parseFloat(amt.toPrecision(4)).toString()
                                : "0";
                              const id = getLlamaId(network, token.tokenAddress);
                              const usd = priceMap?.[id] ?? dexInfoMap?.[token.tokenAddress.toLowerCase()]?.price ?? 0;
                              const dailyUSD = usd && amt > 0 ? amt * usd : 0;
                              return (
                                <>
                                  {prefix}{fmt} {token.symbol}
                                  {dailyUSD > 0 && (
                                    <span className="text-emerald-400 ml-1">
                                      ({formatUSD(dailyUSD)})
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Distributed</span>
                          <span className="font-medium text-foreground">
                            {(() => {
                              const v = token.totalRewardsDeposited;
                              const fmt =
                                v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M`
                                : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K`
                                : v >= 1 ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                : v > 0 ? parseFloat(v.toPrecision(8)).toString()
                                : "0";
                              const usd = getRewardTokenPrice(token.tokenAddress);
                              const totalUSD = usd && v > 0 ? v * usd : 0;
                              return (
                                <>
                                  {fmt} {token.symbol}
                                  {totalUSD > 0 && (
                                    <span className="text-emerald-400 ml-1">
                                      ({formatUSD(totalUSD)})
                                    </span>
                                  )}
                                </>
                              );
                            })()}
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

                {/* Derived yield metrics */}
                {enabledRewardTokens.length > 0 && (() => {
                  const token = enabledRewardTokens[0];
                  if (!token) return null;
                  const estDaily = getEstDaily(token.tokenAddress);
                  const freqH = token.frequencyHours ?? 24;
                  const distsPerDay = freqH > 0 ? 24 / freqH : 1;
                  const dailyAmt = token.tokenAmount > 0 ? token.tokenAmount * distsPerDay : estDaily;
                  const isEstimated = token.tokenAmount === 0 && estDaily > 0;
                  // Prefer the live reward-wallet balance (real funds remaining); fall back
                  // to the on-contract counter (deposited - claimed) if no wallet balance.
                  const livePool = getPoolBalance(token.tokenAddress);
                  const remainingAmt = livePool > 0
                    ? livePool
                    : Math.max(0, token.totalRewardsDeposited - token.totalRewardsClaimed);
                  const daysRemaining = dailyAmt > 0 && remainingAmt > 0
                    ? Math.max(0, Math.round(remainingAmt / dailyAmt))
                    : null;
                  const fmtAmt = (n: number) =>
                    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M`
                    : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K`
                    : n >= 1 ? n.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : n > 0 ? parseFloat(n.toPrecision(4)).toString()
                    : "0";
                  return (
                    <div
                      className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl border border-transparent"
                      style={{
                        background: "linear-gradient(hsl(var(--card) / 0.5), hsl(var(--card) / 0.5)) padding-box, linear-gradient(135deg, rgba(52,211,153,0.5) 0%, rgba(52,211,153,0.1) 100%) border-box",
                        boxShadow: "0 0 18px rgba(52,211,153,0.07)",
                      }}
                    >
                      <div className="text-xs">
                        <p className="text-muted-foreground">
                          Daily Emission{isEstimated && " (est.)"}
                        </p>
                        <p className="font-bold text-emerald-400 mt-0.5 tabular-nums">
                          {isEstimated ? "~" : ""}{fmtAmt(dailyAmt)} {token.symbol}/day
                        </p>
                      </div>
                      <div className="text-xs">
                        <p className="text-muted-foreground">Reward Duration</p>
                        <p className="font-bold text-emerald-400 mt-0.5">
                          {daysRemaining != null ? `~${daysRemaining} days left` : "Ongoing"}
                        </p>
                      </div>
                      <div className="text-xs">
                        <p className="text-muted-foreground">Total Pool</p>
                        <p className="font-bold text-foreground mt-0.5 tabular-nums">
                          {fmtAmt(getPoolBalance(token.tokenAddress) || token.totalRewardsDeposited)} {token.symbol}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Additional moat meta */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  {[
                    { label: "Moat Version", value: `v${moatConfig.moatVersion}` },
                    { label: "Auto Rewards", value: moatConfig.automatedRewards ? "Yes" : "No" },
                    { label: "Time-Weighted", value: moatConfig.timeWeightedPointsEnabled ? `${moatConfig.timeWeightPercentage}%` : "Disabled" },
                    {
                      label: "NFT Boost",
                      value: activeBoosts.length === 0
                        ? "None"
                        : activeBoosts.length === 1
                          ? ((activeBoosts[0].tiers?.length ?? 0) > 0
                              ? `Tiered · up to ${getMaxBoostValue(activeBoosts[0])}%`
                              : `Active · ${activeBoosts[0].boostValue}%`)
                          : `${activeBoosts.length} NFTs · up to ${activeBoosts.map((b: BoostConfig) => `${getMaxBoostValue(b)}%`).join(" / ")}`,
                    },
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

            {/* NFT Boost Tiers */}
            <NftBoostTiers
              boosts={activeBoosts}
              balances={nftBoostBalances}
              isConnected={isConnected}
            />

            {/* User Position */}
            {isConnected && (
              <div className="rounded-2xl border border-border bg-card/30 p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  Your Position
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Staked",
                      value: userStakedFormatted,
                      testId: "user-staked",
                      usd: (() => {
                        if (!userInfo.userInfo || stakingTokenPrice === 0) return 0;
                        return parseFloat(formatUnits(userInfo.userInfo[0], decimals)) * stakingTokenPrice;
                      })(),
                    },
                    {
                      label: "Locked",
                      value: userLockedFormatted,
                      testId: "user-locked",
                      usd: (() => {
                        if (stakingTokenPrice === 0) return 0;
                        return parseFloat(formatUnits(userLockedAmount, decimals)) * stakingTokenPrice;
                      })(),
                    },
                    {
                      label: "Burned",
                      value: userBurnFormatted,
                      testId: "user-burned",
                      usd: (() => {
                        if (!userInfo.userInfo || stakingTokenPrice === 0) return 0;
                        return parseFloat(formatUnits(userInfo.userInfo[1], decimals)) * stakingTokenPrice;
                      })(),
                    },
                    {
                      label: "Moat Points",
                      value: formatPoints(userMoatPointsValue),
                      testId: "user-moat-points",
                      usd: 0,
                      weightedPct: userLeaderboardWeight !== undefined
                        ? userLeaderboardWeight
                        : (totalPoints > 0 ? (userMoatPointsValue / totalPoints) * 100 : 0),
                    },
                  ].map((item) => {
                    const weightedPct = (item as { weightedPct?: number }).weightedPct ?? 0;
                    return (
                      <div key={item.label} data-testid={item.testId}>
                        <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                        <p className="font-bold text-xl tabular-nums">{item.value}</p>
                        {item.usd > 0 && (
                          <p className="text-xs text-emerald-400 tabular-nums">{formatUSD(item.usd)}</p>
                        )}
                        {weightedPct > 0 && (
                          <p
                            data-testid="user-weighted-pct"
                            className="text-xs text-cyan-400 tabular-nums"
                          >
                            {weightedPct >= 1
                              ? weightedPct.toFixed(2)
                              : weightedPct >= 0.01
                              ? weightedPct.toFixed(3)
                              : weightedPct.toPrecision(2)}
                            % of pool
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {userInfo.pendingRewards && userInfo.pendingRewards[0].length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">Pending Rewards</p>
                    <div className="flex flex-wrap gap-2">
                      {userInfo.pendingRewards[0].map((token, i) => {
                        const rewardDec = getPendingRewardDecimals(i);
                        const amount = parseFloat(formatUnits(userInfo.pendingRewards![1][i], rewardDec));
                        const price = getRewardTokenPrice(token);
                        const usdVal = amount * price;
                        const rewardConfig = moatConfig?.rewardTokens.find(
                          (t) => t.tokenAddress?.toLowerCase() === token.toLowerCase()
                        );
                        return (
                          <div
                            key={token}
                            className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400"
                          >
                            <span className="font-bold">
                              {fmtTokenAmt(amount)} {rewardConfig?.symbol ?? formatAddress(token)}
                            </span>
                            {usdVal > 0 && (
                              <span className="ml-1.5 text-emerald-300/70">≈ {formatUSD(usdVal)}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* My Locks */}
            {isConnected && (activeLockCount > 0 || locksLoading) && (
              <div
                data-testid="section-my-locks"
                className="rounded-2xl border border-cyan-500/20 bg-card/30 overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Lock size={16} className="text-cyan-400" />
                    My Locks
                    {locks.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-400">
                        {locks.length} active
                      </span>
                    )}
                  </h3>
                </div>

                {locksLoading ? (
                  <div className="p-6 flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 size={16} className="animate-spin" /> Loading locks…
                  </div>
                ) : locks.length === 0 ? (
                  <div className="p-6 text-center">
                    <Lock size={28} className="mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No active locks found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {locks.map((lock) => {
                      const nowSec = BigInt(Math.floor(Date.now() / 1000));
                      const isMatured = nowSec >= lock.end;
                      const endDate = new Date(Number(lock.end) * 1000);
                      const timeLeft = formatTimeRemaining(lock.end);
                      const durationLabel = getLockDurationLabel(lock.originalDuration);
                      const amountFormatted = parseFloat(
                        formatUnits(lock.amount, decimals)
                      ).toLocaleString(undefined, { maximumFractionDigits: 4 });
                      const isBusy = exitAction.isPending || exitAction.isConfirming;

                      return (
                        <motion.div
                          key={lock.index}
                          data-testid={`lock-row-${lock.index}`}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="px-6 py-5 space-y-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                {isMatured ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                    <Unlock size={10} /> Ready
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                                    <Lock size={10} /> Locked
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  Lock #{lock.index + 1}
                                </span>
                              </div>
                              <p className="text-xl font-bold tabular-nums">
                                {amountFormatted}{" "}
                                <span className="text-sm font-normal text-muted-foreground">
                                  {tokenBalance.symbol}
                                </span>
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground mb-0.5 flex items-center justify-end gap-1">
                                <Clock size={11} /> Unlocks
                              </p>
                              <p className="text-sm font-medium tabular-nums">
                                {endDate.toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                              <p className={`text-xs font-medium ${isMatured ? "text-emerald-400" : "text-cyan-400"}`}>
                                {timeLeft}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-4 text-xs">
                            <div>
                              <p className="text-muted-foreground mb-0.5">Duration</p>
                              <p className="font-semibold">{durationLabel}</p>
                            </div>
                          </div>
                          {isMatured ? (
                            <button
                              data-testid={`btn-exit-lock-${lock.index}`}
                              onClick={() => exitAction.exitLock(lock.index)}
                              disabled={isBusy}
                              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                              {exitAction.isConfirming ? "Confirming…" : exitAction.isPending ? "Submitting…" : "Exit Lock"}
                            </button>
                          ) : earlyExitConfirm === lock.index ? (
                            <div className="space-y-2">
                              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                                <span>
                                  Early exit will forfeit lock point bonuses and may incur a penalty fee set by the Moat owner. This cannot be undone.
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEarlyExitConfirm(null)}
                                  className="flex-1 py-2 rounded-xl border border-border text-muted-foreground text-xs hover:border-primary/50 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  data-testid={`btn-early-exit-confirm-${lock.index}`}
                                  onClick={() => {
                                    exitAction.earlyExitLock(lock.index);
                                    setEarlyExitConfirm(null);
                                  }}
                                  disabled={isBusy}
                                  className="flex-1 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                                >
                                  {isBusy ? <Loader2 size={12} className="animate-spin" /> : <AlertTriangle size={12} />}
                                  Confirm Early Exit
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              data-testid={`btn-early-exit-${lock.index}`}
                              onClick={() => setEarlyExitConfirm(lock.index)}
                              disabled={isBusy}
                              className="w-full py-2.5 px-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-sm font-medium hover:bg-amber-500/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              <AlertTriangle size={14} />
                              Early Exit
                            </button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                <div className="px-6 pb-4">
                  <TxStatus
                    isPending={exitAction.isPending}
                    isConfirming={exitAction.isConfirming}
                    isSuccess={exitAction.isSuccess}
                    error={exitAction.error}
                  />
                </div>
              </div>
            )}

            {/* Top Stakers (from points v2 leaderboard) */}
            {leaderboard.length > 0 && (
              <div className="rounded-2xl border border-border bg-card/30 overflow-hidden">
                <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
                  <h3 className="font-semibold">Top Stakers</h3>
                  <span className="text-xs text-muted-foreground">
                    {participantCount} participants
                  </span>
                </div>
                <div className="divide-y divide-border/50">
                  {[...leaderboard]
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 10)
                    .map((entry, i) => (
                      <div
                        key={entry.address}
                        data-testid={`row-staker-${i}`}
                        className="px-6 py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-muted/50 flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="font-mono text-sm">{formatAddress(entry.address)}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-primary text-sm tabular-nums">
                            {formatPoints(entry.points)} pts
                          </span>
                          {entry.boosted && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {entry.boostMultiplier}x boost
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
                <ActivityFeed events={eventsData.results.slice(0, 8)} moatConfigs={moatConfig ? [moatConfig] : undefined} />
              </div>
            )}

            {/* Similar Moats — discovery section based on shared rewards, tags & activity */}
            {moatConfig && <SimilarMoats currentMoat={moatConfig} />}
          </div>

          {/* Right: Action Panel */}
          <div className="sticky top-24 self-start">
            <div className="rounded-2xl border border-border bg-card/30 backdrop-blur-md overflow-hidden"
              style={{ boxShadow: "0 0 0 1px rgba(0,212,255,0.05), 0 4px 32px rgba(0,0,0,0.3)" }}
            >
              {/* Tabs with animated sliding underline */}
              <div className="flex border-b border-border overflow-x-auto">
                {(["stake", "withdraw", "lock", "burn"] as ActionTab[]).map((t) => {
                  const isActive = activeTab === t;
                  const isBurn = t === "burn";
                  return (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      data-testid={`tab-action-${t}`}
                      className={`relative flex-1 min-w-fit py-3.5 px-2 text-sm font-medium capitalize transition-colors ${
                        isActive
                          ? isBurn
                            ? "text-rose-400 bg-rose-500/5"
                            : "text-primary bg-primary/5"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t === "stake" && <TrendingUp size={14} className="inline mr-1.5" />}
                      {t === "withdraw" && <ArrowLeft size={14} className="inline mr-1.5" />}
                      {t === "lock" && <Lock size={14} className="inline mr-1.5" />}
                      {t === "burn" && <Flame size={14} className="inline mr-1.5" />}
                      {t === "claim" && <Gift size={14} className="inline mr-1.5" />}
                      {t}
                      {isActive && (
                        <motion.div
                          layoutId="action-tab-underline"
                          className={`absolute bottom-0 left-0 right-0 h-0.5 ${isBurn ? "bg-rose-400" : "bg-primary"}`}
                          style={!isBurn ? { boxShadow: "0 0 6px rgba(0,212,255,0.5)" } : undefined}
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="p-6">
                {!isConnected ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground text-sm mb-4">
                      Connect your wallet to interact with this Moat
                    </p>
                    <button
                      onClick={() => open({ view: "Connect" })}
                      data-testid="btn-connect-wallet-actions"
                      className="btn-shimmer inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,212,255,0.35)]"
                    >
                      <Wallet size={15} />
                      Connect Wallet
                    </button>
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
                              type="text"
                              inputMode="decimal"
                              value={fmtAmt(stakeAmount)}
                              onChange={(e) => setStakeAmount(parseAmt(e.target.value))}
                              placeholder="0.00"
                              data-testid="input-stake-amount"
                              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm pr-16"
                            />
                            <button
                              onClick={() => setStakeAmount(parseAmt(tokenBalance.formatted || "0"))}
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
                        </div>
                        <PointsEstimateBox
                          gained={getEstimatedPoints(stakeAmount, 1)}
                          poolShare={getEstimatedPoolShare(stakeAmount, 1)}
                          ready={pointsSim.ready}
                          loading={pointsSim.loading}
                          hasAmount={!!stakeAmount && parseFloat(stakeAmount) > 0}
                        />
                        <button
                          onClick={handleStake}
                          disabled={!stakeAmount || stakeAction.isPending || stakeAction.isConfirming || approveAction.isPending}
                          data-testid="btn-stake"
                          className="btn-shimmer w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-95 hover:shadow-[0_0_20px_rgba(0,212,255,0.35)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
                              type="text"
                              inputMode="decimal"
                              value={fmtAmt(lockAmount)}
                              onChange={(e) => setLockAmount(parseAmt(e.target.value))}
                              placeholder="0.00"
                              data-testid="input-lock-amount"
                              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm pr-16"
                            />
                            <button
                              onClick={() => setLockAmount(parseAmt(tokenBalance.formatted || "0"))}
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
                        <div className="text-xs text-muted-foreground p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 flex justify-between items-center">
                          <span>Selected multiplier</span>
                          <span className="font-medium text-cyan-400" data-testid="lock-multiplier-display">
                            {getLockMultiplierLabel(lockDays)}
                          </span>
                        </div>
                        <PointsEstimateBox
                          gained={getEstimatedPoints(lockAmount, lockWeightForDays(lockDays))}
                          poolShare={getEstimatedPoolShare(lockAmount, lockWeightForDays(lockDays))}
                          ready={pointsSim.ready}
                          loading={pointsSim.loading}
                          hasAmount={!!lockAmount && parseFloat(lockAmount) > 0}
                        />
                        <button
                          onClick={handleLock}
                          disabled={!lockAmount || lockAction.isPending || lockAction.isConfirming || approveAction.isPending}
                          data-testid="btn-lock"
                          className="btn-shimmer w-full py-3.5 rounded-xl bg-cyan-500 text-white font-semibold text-sm hover:opacity-95 hover:shadow-[0_0_20px_rgba(34,211,238,0.35)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                          {approveAction.isPending || approveAction.isConfirming ? (
                            <><Loader2 size={14} className="animate-spin" />Approving...</>
                          ) : lockAction.isPending || lockAction.isConfirming ? (
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

                    {/* Withdraw (Unstake) */}
                    {activeTab === "withdraw" && (
                      <div className="space-y-4">
                        {userInfo.userInfo !== undefined && (
                          <div className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Staked Balance</span>
                            <span className="text-sm font-bold tabular-nums text-primary">
                              {userStakedFormatted} {tokenBalance.symbol}
                            </span>
                          </div>
                        )}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block">
                            Amount to Withdraw
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={fmtAmt(withdrawAmount)}
                              onChange={(e) => setWithdrawAmount(parseAmt(e.target.value))}
                              placeholder="0.00"
                              data-testid="input-withdraw-amount"
                              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-sm pr-16"
                            />
                            <button
                              onClick={() => setWithdrawAmount(parseAmt(userStakedFormatted))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary font-medium hover:text-primary/80"
                            >
                              MAX
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-1">
                          <p className="flex justify-between">
                            <span className="text-amber-400 font-medium">Unstake fee</span>
                            <span className="font-medium text-amber-400">
                              {stats.unstakeFee !== undefined ? `${Number(stats.unstakeFee) / 100}%` : "5%"}
                            </span>
                          </p>
                          <p className="text-amber-400/70">A fee is applied to unstaked tokens.</p>
                        </div>
                        <button
                          onClick={handleWithdraw}
                          disabled={!withdrawAmount || unstakeAction.isPending || unstakeAction.isConfirming}
                          data-testid="btn-withdraw"
                          className="btn-shimmer w-full py-3.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:opacity-95 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                          {unstakeAction.isPending || unstakeAction.isConfirming ? (
                            <><Loader2 size={14} className="animate-spin" />Withdrawing...</>
                          ) : (
                            <><ArrowLeft size={14} />Withdraw Tokens</>
                          )}
                        </button>
                        <TxStatus
                          isPending={unstakeAction.isPending}
                          isConfirming={unstakeAction.isConfirming}
                          isSuccess={unstakeAction.isSuccess}
                          error={unstakeAction.error}
                        />
                      </div>
                    )}

                    {/* Burn */}
                    {activeTab === "burn" && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                          <div className="flex items-center gap-2 mb-2">
                            <Flame size={16} className="text-rose-400" />
                            <span className="text-sm font-medium text-rose-400">Permanent Burn</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Burned tokens are permanently removed from circulation. This action is irreversible and earns bonus burn points toward your Moat score.
                          </p>
                        </div>
                        {userInfo.userInfo !== undefined && (
                          <div className="p-3 rounded-xl bg-muted/20 border border-border/50 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Your Burn Total</span>
                            <span className="text-sm font-bold tabular-nums text-rose-400">
                              {userBurnFormatted} {tokenBalance.symbol}
                            </span>
                          </div>
                        )}
                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 block">
                            Amount to Burn
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={fmtAmt(burnAmount)}
                              onChange={(e) => setBurnAmount(parseAmt(e.target.value))}
                              placeholder="0.00"
                              data-testid="input-burn-amount"
                              className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 text-sm pr-16"
                            />
                            <button
                              onClick={() => setBurnAmount(parseAmt(tokenBalance.formatted || "0"))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-rose-400 font-medium hover:text-rose-300"
                            >
                              MAX
                            </button>
                          </div>
                        </div>
                        <PointsEstimateBox
                          gained={getEstimatedPoints(burnAmount, 10)}
                          poolShare={getEstimatedPoolShare(burnAmount, 10)}
                          ready={pointsSim.ready}
                          loading={pointsSim.loading}
                          hasAmount={!!burnAmount && parseFloat(burnAmount) > 0}
                        />
                        <button
                          onClick={handleBurn}
                          disabled={!burnAmount || burnAction.isPending || burnAction.isConfirming || approveAction.isPending}
                          data-testid="btn-burn"
                          className="btn-shimmer w-full py-3.5 rounded-xl bg-rose-500 text-white font-semibold text-sm hover:opacity-95 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                          {approveAction.isPending || approveAction.isConfirming ? (
                            <><Loader2 size={14} className="animate-spin" />Approving...</>
                          ) : burnAction.isPending || burnAction.isConfirming ? (
                            <><Loader2 size={14} className="animate-spin" />Burning...</>
                          ) : !hasAllowanceForBurn && burnAmount ? (
                            "Approve First"
                          ) : (
                            <><Flame size={14} />Burn Tokens</>
                          )}
                        </button>
                        <TxStatus
                          isPending={burnAction.isPending || approveAction.isPending}
                          isConfirming={burnAction.isConfirming || approveAction.isConfirming}
                          isSuccess={burnAction.isSuccess || approveAction.isSuccess}
                          error={burnAction.error || approveAction.error}
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

            {/* Claim Rewards Card */}
            <div
              className="mt-4 rounded-2xl border border-emerald-500/30 bg-card/40 backdrop-blur-md overflow-hidden"
              style={{ boxShadow: "0 0 0 1px rgba(52,211,153,0.08), 0 4px 24px rgba(52,211,153,0.06)" }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-500/20 bg-emerald-500/5">
                <div className="flex items-center gap-2">
                  <Gift size={15} className="text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-400">Claim Rewards</span>
                </div>
                {(() => {
                  const hasKnownRewards = userInfo.pendingRewards && userInfo.pendingRewards[0].some((_, i) => {
                    const dec = getPendingRewardDecimals(i);
                    return parseFloat(formatUnits(userInfo.pendingRewards![1][i], dec)) > 0;
                  });
                  const couldHaveRewards = !userInfo.pendingRewards && !!userInfo.pendingRewardsError;
                  return (hasKnownRewards || couldHaveRewards) && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-medium animate-pulse">
                      Rewards Ready
                    </span>
                  );
                })()}
              </div>
              <div className="p-5">
                {!isConnected ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground text-sm mb-4">
                      Connect your wallet to view and claim rewards
                    </p>
                    <button
                      onClick={() => open({ view: "Connect" })}
                      data-testid="btn-connect-wallet-rewards"
                      className="btn-shimmer inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,212,255,0.35)]"
                    >
                      <Wallet size={15} />
                      Connect Wallet
                    </button>
                  </div>
                ) : userInfo.isLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((n) => (
                      <div key={n} className="skeleton-shimmer h-10 rounded-lg" />
                    ))}
                  </div>
                ) : (() => {
                  const contractReverted = !userInfo.pendingRewards && !!userInfo.pendingRewardsError;

                  if (contractReverted) {
                    const enabledTokens = enabledRewardTokens;
                    const ui = userInfo.userInfo;
                    const hasAnyPosition = !!ui && (ui[0] > 0n || ui[1] > 0n || ui[4] > 0n);
                    return (
                      <div className="space-y-4">
                        <div className="rounded-xl overflow-hidden border border-emerald-500/20 bg-emerald-500/5">
                          {enabledTokens.length > 0 ? (
                            enabledTokens.map((t, idx) => (
                              <div
                                key={t.tokenAddress}
                                className={`flex items-center justify-between px-4 py-3 ${idx < enabledTokens.length - 1 ? "border-b border-emerald-500/15" : ""}`}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm font-semibold text-foreground">{t.symbol}</span>
                                  <span className="text-xs text-muted-foreground">{t.name}</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold tabular-nums text-emerald-400">—</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="px-4 py-5 text-center">
                              <Gift size={20} className="text-muted-foreground mx-auto mb-2 opacity-50" />
                              <p className="text-sm text-muted-foreground">Rewards may be available</p>
                            </div>
                          )}
                          <div className="px-4 py-2.5 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2">
                            <span className="text-xs text-amber-400/80">Exact amounts calculated on-chain at claim time</span>
                          </div>
                        </div>
                        <button
                          onClick={() => claimAction.claim()}
                          disabled={!hasAnyPosition || claimAction.isPending || claimAction.isConfirming}
                          data-testid="btn-claim"
                          className="btn-shimmer w-full py-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:opacity-95 hover:shadow-[0_0_20px_rgba(52,211,153,0.35)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                          {claimAction.isPending || claimAction.isConfirming ? (
                            <><Loader2 size={14} className="animate-spin" />Claiming...</>
                          ) : (
                            <><Gift size={14} />{hasAnyPosition ? "Claim All Rewards" : "No Rewards to Claim"}</>
                          )}
                        </button>
                        <TxStatus
                          isPending={claimAction.isPending}
                          isConfirming={claimAction.isConfirming}
                          isSuccess={claimAction.isSuccess}
                          error={claimAction.error}
                        />
                      </div>
                    );
                  }

                  const claimRows = (userInfo.pendingRewards?.[0] ?? []).map((token, i) => {
                    const dec = getPendingRewardDecimals(i);
                    const rawAmt = userInfo.pendingRewards?.[1]?.[i] ?? 0n;
                    const amt = parseFloat(formatUnits(rawAmt, dec));
                    const cfg = moatConfig?.rewardTokens.find(
                      (t) => t.tokenAddress?.toLowerCase() === token.toLowerCase()
                    );
                    const usd = amt * getRewardTokenPrice(token);
                    return { token, amt, cfg, usd };
                  }).filter((r) => r.amt > 0);

                  const totalUSD = claimRows.reduce((s, r) => s + r.usd, 0);
                  const hasRewards = claimRows.length > 0;

                  return (
                    <div className="space-y-4">
                      <div className="rounded-xl overflow-hidden border border-emerald-500/20 bg-emerald-500/5">
                        {hasRewards ? (
                          <>
                            {claimRows.map((r, idx) => (
                              <div
                                key={r.token}
                                className={`flex items-center justify-between px-4 py-3 ${idx < claimRows.length - 1 ? "border-b border-emerald-500/15" : ""}`}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-sm font-semibold text-foreground">
                                    {r.cfg?.symbol ?? formatAddress(r.token)}
                                  </span>
                                  {r.cfg?.name && (
                                    <span className="text-xs text-muted-foreground">{r.cfg.name}</span>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold tabular-nums text-emerald-400">
                                    {fmtTokenAmt(r.amt)}
                                  </p>
                                  {r.usd > 0 && (
                                    <p className="text-xs text-emerald-300/70 tabular-nums">
                                      {formatUSD(r.usd)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {totalUSD > 0 && (
                              <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-500/10 border-t border-emerald-500/20">
                                <span className="text-xs font-medium text-muted-foreground">Total value</span>
                                <span className="text-sm font-bold text-emerald-400">{formatUSD(totalUSD)}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="px-4 py-5 text-center">
                            <Gift size={20} className="text-muted-foreground mx-auto mb-2 opacity-50" />
                            <p className="text-sm text-muted-foreground">No pending rewards</p>
                            <p className="text-xs text-muted-foreground/70 mt-1">Rewards accrue as you stake</p>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => claimAction.claim()}
                        disabled={!hasRewards || claimAction.isPending || claimAction.isConfirming}
                        data-testid="btn-claim"
                        className="btn-shimmer w-full py-3.5 rounded-xl bg-emerald-500 text-white font-semibold text-sm hover:opacity-95 hover:shadow-[0_0_20px_rgba(52,211,153,0.35)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                      >
                        {claimAction.isPending || claimAction.isConfirming ? (
                          <><Loader2 size={14} className="animate-spin" />Claiming...</>
                        ) : (
                          <><Gift size={14} />{hasRewards ? `Claim All Rewards${totalUSD > 0 ? ` · ${formatUSD(totalUSD)}` : ""}` : "No Rewards to Claim"}</>
                        )}
                      </button>
                      <TxStatus
                        isPending={claimAction.isPending}
                        isConfirming={claimAction.isConfirming}
                        isSuccess={claimAction.isSuccess}
                        error={claimAction.error}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

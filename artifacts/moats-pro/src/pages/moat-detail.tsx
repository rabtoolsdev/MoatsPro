import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "wouter";
import { useAccount, useReadContracts, useReadContract } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Zap, Users, TrendingUp, Lock, Gift, Flame,
  AlertCircle, CheckCircle, Loader2, Coins, ExternalLink,
  Unlock, Clock, AlertTriangle, Wallet, Sparkles, Trophy, Activity,
  Droplets,
} from "lucide-react";
import { Link } from "wouter";
import { formatUnits, parseUnits } from "viem";
import { useQueryClient } from "@tanstack/react-query";
import { useAllMoatConfigs, useMoatPointsV2, useUserMoatPointsV2, useEvents, useRewardsDepositedEvents, useOnChainRewardsDeposited, useAllOnChainRecentEvents } from "@/hooks/use-moats-api";
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
import { TokenLogo, SYMBOL_LOGOS } from "@/components/swap/token-logo";
import { SimilarMoats } from "@/components/similar-moats";
import { formatAddress, formatPoints, timeAgo, getMoatMeta, formatUSD, getTokenLogoUrl } from "@/lib/moat-metadata";
import { useTokenPrices, getLlamaId } from "@/hooks/use-token-prices";
import { useDexscreenerInfo } from "@/hooks/use-dexscreener";
import { useResolveMoatMetas } from "@/hooks/use-resolve-moat-metas";
import { networkToChainId } from "@/lib/wagmi-config";
import { useDailyRewardEstimates } from "@/hooks/use-daily-reward-estimates";
import { useRewardPoolBalances } from "@/hooks/use-reward-pool-balances";
import { useContractRewardBalances } from "@/hooks/use-contract-reward-balances";
import { useMoatPointsSim, estimateMoatPoints, estimatePoolShare } from "@/hooks/use-moat-points-sim";
import { ERC20_ABI, MOAT_LOGO_ABI, MOAT_V3_ADMIN_ABI } from "@/lib/moat-abi";

type ActionTab = "stake" | "lock" | "claim" | "withdraw" | "burn";

const networkExplorerTx: Record<string, string> = {
  avalanche: "https://snowtrace.io/tx/",
  ethereum: "https://etherscan.io/tx/",
  arbitrum: "https://arbiscan.io/tx/",
  base: "https://basescan.org/tx/",
  optimism: "https://optimistic.etherscan.io/tx/",
  polygon: "https://polygonscan.com/tx/",
};

const statusColors: Record<string, { border: string; badge: string; text: string; hoverGlow: string; icon: string; bgHighlight: string; glow: string }> = {
  Verified: {
    border: "border-emerald-500/30",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.1)]",
    text: "text-emerald-400",
    hoverGlow: "0 0 0 1px rgba(52,211,153,0.4), 0 8px 40px -8px rgba(52,211,153,0.2), inset 0 0 20px rgba(52,211,153,0.05)",
    icon: "text-emerald-400",
    bgHighlight: "from-emerald-500/5",
    glow: "rgba(52,211,153,0.5)",
  },
  Community: {
    border: "border-cyan-500/30",
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(0,212,255,0.1)]",
    text: "text-cyan-400",
    hoverGlow: "0 0 0 1px rgba(0,212,255,0.4), 0 8px 40px -8px rgba(0,212,255,0.2), inset 0 0 20px rgba(0,212,255,0.05)",
    icon: "text-cyan-400",
    bgHighlight: "from-cyan-500/5",
    glow: "rgba(0,212,255,0.5)",
  },
  Deprecated: {
    border: "border-zinc-500/30",
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    text: "text-zinc-400",
    hoverGlow: "0 0 0 1px rgba(161,161,170,0.3), 0 8px 32px rgba(0,0,0,0.4)",
    icon: "text-zinc-400",
    bgHighlight: "from-zinc-500/5",
    glow: "rgba(161,161,170,0.5)",
  },
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

function calculatePoolSharePercent(userPoints: bigint, totalPoints: bigint): number | null {
  if (userPoints <= 0n || totalPoints <= 0n) return null;
  // Keep the ratio exact until the final display conversion. Point counters
  // can grow beyond Number's safe integer range over the life of a Moat.
  const scaledPercent = (userPoints * 1_000_000n) / totalPoints;
  return Number(scaledPercent) / 10_000;
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
    <div className="text-xs p-4 rounded-xl bg-black/40 border border-primary/20 space-y-2 shadow-[inset_0_0_20px_rgba(0,212,255,0.05)] relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <div className="flex justify-between items-center relative z-10">
        <span className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest">
          <Sparkles size={13} className="text-primary" /> Est. Moat Points
        </span>
        <span className="font-bold text-primary tabular-nums tracking-tight text-sm drop-shadow-sm" data-testid="points-estimate">
          {loading && !ready ? "…" : `+${formatPoints(gained)}`}
        </span>
      </div>
      <div className="flex justify-between items-center relative z-10">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Est. % of pool</span>
        <span className="font-bold text-cyan-400 tabular-nums tracking-tight drop-shadow-sm" data-testid="pool-share-estimate">
          {loading && !ready ? "…" : poolShare != null ? `${formatPoolShare(poolShare)}%` : "—"}
        </span>
      </div>
      <p className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest leading-tight relative z-10 pt-1 border-t border-white/5">
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
    <div className="rounded-2xl border border-white/5 bg-card/40 backdrop-blur-xl p-6 relative overflow-hidden shadow-lg cyber-grid">
      <div className="absolute inset-x-0 top-0 h-px cyber-lines opacity-40" />
      <h3 className="font-bold mb-2 flex items-center gap-2 text-white text-lg tracking-tight">
        <Zap size={18} className="text-cyan-400" />
        NFT Boosts
      </h3>
      <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-6 leading-relaxed">
        Hold boost NFTs to multiply your Moat Points. The more you hold, the higher the tier.
      </p>
      <div className="space-y-4 relative z-10">
        {boosts.map((boost, i) => {
          const held = Number(balances[i] ?? 0n);
          const tiers = boost.tiers ?? [];
          const currentTier = getBoostTier(boost, held);
          const effective = isConnected ? getEffectiveBoostValue(boost, held) : 0;
          return (
            <div
              key={boost.contractAddress}
              data-testid={`nft-boost-tiers-${boost.contractAddress.toLowerCase()}`}
              className="rounded-xl border border-white/5 bg-black/20 p-5 group hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono text-white/70 uppercase tracking-widest group-hover:text-primary transition-colors">
                  {multi ? `Collection ${i + 1} · ` : ""}{formatAddress(boost.contractAddress)}
                </span>
                {isConnected ? (
                  <span className={`text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-[4px] font-bold ${held > 0 ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.1)]" : "bg-white/5 text-muted-foreground border border-white/10"}`}>
                    {held} held{held > 0 ? ` · ${effective}% active` : ""}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-[4px] bg-white/5 text-muted-foreground border border-white/10 font-bold">
                    up to {getMaxBoostValue(boost)}%
                  </span>
                )}
              </div>
              {tiers.length > 0 ? (
                <div className="space-y-2">
                  {tiers.map((tier) => {
                    const active = isConnected && currentTier === tier;
                    return (
                      <div
                        key={`${tier.minHolding}-${tier.maxHolding}-${tier.boostValue}`}
                        className={`flex items-center justify-between text-xs rounded-lg px-4 py-2.5 transition-all ${
                          active
                            ? "bg-cyan-500/10 border border-cyan-500/30 shadow-[inset_0_0_15px_rgba(34,211,238,0.05)]"
                            : "bg-white/5 border border-transparent"
                        }`}
                      >
                        <span className={`font-mono uppercase tracking-widest text-[10px] ${active ? "text-cyan-400 font-bold" : "text-muted-foreground"}`}>
                          {formatTierRange(tier)} NFT{tier.maxHolding === 1 ? "" : "s"}
                          {active && " · your tier"}
                        </span>
                        <span className={`tabular-nums font-bold text-sm ${active ? "text-cyan-400 drop-shadow-sm" : "text-white"}`}>
                          {tier.boostValue}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-between text-xs rounded-lg px-4 py-2.5 bg-white/5 border border-white/5">
                  <span className="font-mono uppercase tracking-widest text-[10px] text-muted-foreground">Any holding</span>
                  <span className="tabular-nums font-bold text-sm text-white">{boost.boostValue}%</span>
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
    // Use Math.round so a 2-year lock with ~729 days left shows "2 Years"
    // rather than "1 Year" (730 days = 2 years, but timestamps land 1 day short).
    const y = Math.round(secs / (365 * 24 * 3600));
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
  const params = useParams<{ network: string; address: string }>();
  const urlNetwork = params.network;
  const contractAddress = params.address as MoatContractAddress | undefined;

  const { address: userAddress, isConnected } = useAccount();

  const { open } = useAppKit();

  const [activeTab, setActiveTab] = useState<ActionTab>("stake");
  const [stakeAmount, setStakeAmount] = useState("");
  const [lockAmount, setLockAmount] = useState("");
  const [lockDays, setLockDays] = useState(30);

  const { data: allConfigs, isLoading: configLoading } = useAllMoatConfigs();
  const moatConfig = allConfigs?.find(
    (c) =>
      c.contractAddress.toLowerCase() === (contractAddress ?? "").toLowerCase() &&
      (!urlNetwork || c.network?.toLowerCase() === urlNetwork.toLowerCase()),
  );
  const { data: onChainLogoUrl } = useReadContract({
    address: contractAddress as `0x${string}` | undefined,
    abi: MOAT_LOGO_ABI,
    functionName: "getLogoURL",
    chainId: networkToChainId(urlNetwork),
    query: { enabled: !!contractAddress, staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  });

  // On-chain source of truth for Total Distributed: getRewardTokens().totalDeposited
  // is a storage variable updated on every depositRewards call, so it reflects all
  // deposits regardless of event-indexer lag or getLogs lookback-window limits.
  const { data: onChainRewardTokensRaw } = useReadContract({
    address: contractAddress as `0x${string}` | undefined,
    abi: MOAT_V3_ADMIN_ABI,
    functionName: "getRewardTokens",
    chainId: networkToChainId(urlNetwork),
    query: { enabled: !!contractAddress, staleTime: 2 * 60 * 1000, gcTime: 10 * 60 * 1000 },
  });
  const { data: pointsV2 } = useMoatPointsV2(contractAddress, urlNetwork);
  const { data: userMoatPoints } = useUserMoatPointsV2(userAddress, contractAddress, urlNetwork);
  const { data: eventsData } = useEvents(contractAddress);
  const { data: rewardsDepositedData } = useRewardsDepositedEvents(contractAddress);
  // On-chain fallback: fetch RewardsDeposited logs directly via getLogs so
  // deposits made by automated reward contracts (which the moat-api indexer
  // may miss) still appear in the activity feed and lastDepositedMap.
  const { data: onChainRewards } = useOnChainRewardsDeposited(
    contractAddress,
    networkToChainId(urlNetwork),
    urlNetwork,
  );
  // The detail-page fallback must include user events too (Staked, Locked,
  // Burned, Withdrawn, etc.), not just RewardsDeposited. This keeps Live
  // Activity independent of the API indexer's processing delay.
  const { data: onChainRecentEvents } = useAllOnChainRecentEvents(
    moatConfig ? [moatConfig] : undefined,
  );
  // Per-token last distribution timestamp (ms) — union of API events and
  // on-chain getLogs results so automated deposits are never missed.
  const lastDepositedMap = useMemo((): Record<string, number> => {
    const map: Record<string, number> = {};
    const allDeposits = [
      ...(rewardsDepositedData?.results ?? []),
      ...(onChainRewards ?? []),
    ];
    for (const ev of allDeposits) {
      const tokenAddr = (ev.args.token as string | undefined)?.toLowerCase();
      if (!tokenAddr) continue;
      const ts = new Date(ev.timestamp).getTime();
      if (!map[tokenAddr] || ts > map[tokenAddr]) map[tokenAddr] = ts;
    }
    return map;
  }, [rewardsDepositedData, onChainRewards]);

  // Merge API events with all on-chain MoatV3 events, deduplicating by
  // transactionHash+logIndex. On-chain events go first so the sort puts the
  // most-recent at the top regardless of which source produced them.
  const mergedEvents = useMemo(() => {
    const apiEvents = eventsData?.results ?? [];
    const apiKeys = new Set(apiEvents.map((e) => `${e.transactionHash}-${e.logIndex}`));
    const supplemental = (onChainRecentEvents ?? []).filter(
      (e) => !apiKeys.has(`${e.transactionHash}-${e.logIndex}`),
    );
    if (!supplemental.length) return apiEvents;
    return [...supplemental, ...apiEvents].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [eventsData, onChainRecentEvents]);

  // Extra per-token distributed amounts from on-chain events the backend indexer
  // missed (e.g. deposits via automated reward contracts). Keyed by lowercase
  // token address → extra amount in human-readable units. Added to
  // token.totalRewardsDeposited at render time so "Total Distributed" stays
  // accurate even when the API lags behind.
  const supplementalByToken = useMemo((): Record<string, number> => {
    if (!onChainRewards?.length) return {};
    const apiTxHashes = new Set(
      (rewardsDepositedData?.results ?? []).map((e) => e.transactionHash.toLowerCase()),
    );
    const extras: Record<string, number> = {};
    for (const ev of onChainRewards) {
      if (apiTxHashes.has(ev.transactionHash.toLowerCase())) continue;
      const tokenAddr = (ev.args.token as string | undefined)?.toLowerCase();
      if (!tokenAddr) continue;
      const rtConfig = moatConfig?.rewardTokens.find(
        (t) => t.tokenAddress.toLowerCase() === tokenAddr,
      );
      const decimals = rtConfig?.decimals ?? 18;
      try {
        const human = parseFloat(formatUnits(BigInt(ev.args.amount as string ?? "0"), decimals));
        extras[tokenAddr] = (extras[tokenAddr] ?? 0) + human;
      } catch {
        // malformed amount — skip
      }
    }
    return extras;
  }, [onChainRewards, rewardsDepositedData, moatConfig]);

  // On-chain totalDeposited per token address (lowercase) → human-readable amount.
  // getRewardTokens() reads a storage variable updated on every depositRewards call
  // so it's accurate regardless of event-indexer gaps or getLogs lookback windows.
  // When loaded, this takes priority over the API counter + event supplement.
  const onChainTotalDepositedByToken = useMemo((): Record<string, number> => {
    if (!onChainRewardTokensRaw || !moatConfig) return {};
    const [addresses, totalDeposited] = onChainRewardTokensRaw as unknown as [string[], bigint[], bigint[], bigint[]];
    if (!addresses?.length) return {};
    const result: Record<string, number> = {};
    for (let i = 0; i < addresses.length; i++) {
      const tokenAddr = addresses[i].toLowerCase();
      const rtConfig = moatConfig.rewardTokens.find(
        (t) => t.tokenAddress.toLowerCase() === tokenAddr,
      );
      const decimals = rtConfig?.decimals ?? 18;
      result[tokenAddr] = parseFloat(formatUnits(totalDeposited[i] ?? 0n, decimals));
    }
    return result;
  }, [onChainRewardTokensRaw, moatConfig]);

  const moatChainId = networkToChainId(urlNetwork);
  const stats = useMoatStats(contractAddress as MoatContractAddress | undefined, moatChainId);
  const userInfo = useUserMoatInfo(contractAddress as MoatContractAddress | undefined, moatChainId);
  const tokenBalance = useTokenBalance(stats.stakingToken as MoatContractAddress | undefined, moatChainId);
  const allowance = useTokenAllowance(
    stats.stakingToken as MoatContractAddress | undefined,
    contractAddress as MoatContractAddress | undefined,
    moatChainId,
  );

  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [burnAmount, setBurnAmount] = useState("");
  const [showBurnConfirm, setShowBurnConfirm] = useState(false);

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
  const [stakerPage, setStakerPage] = useState(0);

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
    activeLockCount,
    moatChainId,
  );

  // Moat Points, the leaderboard and the activity feed come from the Moats
  // API, whose indexer lags the chain by a few seconds. After a points-moving
  // transaction we invalidate those queries immediately and again shortly
  // after, so the numbers converge without a manual page refresh.
  const queryClient = useQueryClient();
  const pointsTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const invalidatePointsData = () => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["moats", "points"] });
      // Refresh API activity plus the direct on-chain activity fallback.
      // The latter is what makes Staked/Locked/Burned appear before the API
      // indexer catches up.
      queryClient.invalidateQueries({ queryKey: ["moats", "events"] });
      queryClient.invalidateQueries({ queryKey: ["moats", "events", "onchain-all", "recent"] });
    };
    invalidate();
    // Delayed retries survive follow-up transactions; they are only cleared
    // when the page unmounts. The receipt can arrive just before the new log
    // is visible through an RPC provider, so retry at short intervals.
    pointsTimersRef.current.push(
      setTimeout(invalidate, 2_000),
      setTimeout(invalidate, 6_000),
      setTimeout(invalidate, 15_000),
    );
  };
  useEffect(() => {
    return () => pointsTimersRef.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!exitAction.isSuccess) return;
    refetchLocks();
    userInfo.refetch();
    tokenBalance.refetch();
    stats.refetch();
    invalidatePointsData();
  }, [exitAction.isSuccess]);

  // Refetch everything the panels display after a stake, lock, withdraw or
  // burn confirms: wallet balance, the user's position/pending rewards, the
  // moat's totals (staked/locked/burned), the remaining allowance, and (for
  // locks) the lock list — so the UI updates without a page refresh.
  useEffect(() => {
    if (
      !stakeAction.isSuccess &&
      !lockAction.isSuccess &&
      !unstakeAction.isSuccess &&
      !burnAction.isSuccess
    ) {
      return;
    }
    userInfo.refetch();
    tokenBalance.refetch();
    stats.refetch();
    allowance.refetch();
    refetchLocks();
    invalidatePointsData();
  }, [
    stakeAction.isSuccess,
    lockAction.isSuccess,
    unstakeAction.isSuccess,
    burnAction.isSuccess,
  ]);

  // Refetch allowance immediately after an approval confirms so the
  // action button flips from "Approve First" to the real action (Stake/Lock/Burn).
  useEffect(() => {
    if (approveAction.isSuccess) {
      allowance.refetch();
    }
  }, [approveAction.isSuccess]);

  // Refetch user info after a claim so pendingRewards goes back to 0
  // and the Stake/Lock/Burn buttons unblock immediately. Also refresh the
  // wallet balance in case a reward token is the staking token.
  useEffect(() => {
    if (claimAction.isSuccess) {
      userInfo.refetch();
      tokenBalance.refetch();
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

  // Total supply of the staking token — needed for the hero "Value Moated" /
  // supply % metrics (same computation as the home page's tvmMap/supplyPctMap).
  const { data: stakingTotalSupply } = useReadContract({
    address: stats.stakingToken as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "totalSupply",
    query: { enabled: !!stats.stakingToken },
  });
  // Decimals via a wallet-independent read: tokenBalance.decimals is gated on
  // a connected wallet, which would skew TVL for disconnected visitors.
  const { data: stakingTokenDecimals } = useReadContract({
    address: stats.stakingToken as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: !!stats.stakingToken },
  });

  const { tvlUSD, supplyPct } = useMemo((): { tvlUSD?: number; supplyPct?: number } => {
    const combined =
      (stats.totalStaked ?? 0n) + (stats.totalLocked ?? 0n) + (stats.totalBurned ?? 0n);
    const tokenAddr = stats.stakingToken?.toLowerCase();
    if (!tokenAddr || combined === 0n) return {};
    const supply = stakingTotalSupply as bigint | undefined;
    const dexInfo = dexInfoMap?.[tokenAddr];
    const dec = stakingTokenDecimals !== undefined ? Number(stakingTokenDecimals) : 18;
    let tvl: number | undefined;
    if (dexInfo?.isLpToken) {
      // LP staking tokens: moat's share of the LP supply × the pool's TVL.
      const poolTvl = dexInfo.lpPoolLiquidityUsd ?? dexInfo.liquidityUsd;
      if (poolTvl > 0 && supply && supply > 0n) {
        const shareBp = Number((combined * 1_000_000n) / supply);
        tvl = (shareBp / 1_000_000) * poolTvl;
      }
    } else {
      // Prefer DefiLlama's canonical price, fall back to DexScreener.
      const llama = priceMap?.[getLlamaId(network, tokenAddr).toLowerCase()] ?? 0;
      const price = llama > 0 ? llama : (dexInfo?.price ?? 0);
      if (price > 0) {
        tvl = parseFloat(formatUnits(combined, dec)) * price;
      } else if ((dexInfo?.liquidityUsd ?? 0) > 0 && supply && supply > 0n) {
        const shareBp = Number((combined * 1_000_000n) / supply);
        tvl = (shareBp / 1_000_000) * (dexInfo?.liquidityUsd ?? 0);
      }
    }
    let pct: number | undefined;
    if (supply && supply > 0n) {
      pct = Number((combined * 10000n) / supply) / 100;
    }
    return { tvlUSD: tvl, supplyPct: pct };
  }, [
    stats.totalStaked,
    stats.totalLocked,
    stats.totalBurned,
    stats.stakingToken,
    stakingTotalSupply,
    stakingTokenDecimals,
    dexInfoMap,
    priceMap,
    network,
  ]);

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

  // "Your Moat Weight" = the wallet's actual share of pool rewards.
  //
  // The API leaderboard `weight` field uses a sqrt-points model which
  // significantly under-reports large stakers/burners (e.g. 11.77% when the
  // true reward share is ~22%). We compute from on-chain data instead:
  //
  //   share = (stakingPoints + burnPoints) / totalPoints × 100
  //
  // stakingPoints (userInfo[2]) covers direct staking AND lock contributions
  // (locked amount × lockMultiplier is embedded here by the contract).
  // burnPoints (userInfo[3]) covers burned tokens at the 10× multiplier.
  // totalPoints is the pool-wide sum of all users' positions.
  // This matches the contract's own reward-distribution logic exactly.
  const userLeaderboardEntry = useMemo(() => {
    if (!userAddress) return undefined;
    return leaderboard.find(
      (e) => e.address.toLowerCase() === userAddress.toLowerCase()
    );
  }, [leaderboard, userAddress]);

  const userOnChainPoolShare = useMemo((): number | null => {
    const totalPts = stats.totalPoints;
    const ui = userInfo.userInfo;
    if (!totalPts || totalPts === 0n || !ui) return null;
    const userPts = (ui[2] ?? 0n) + (ui[3] ?? 0n);
    return calculatePoolSharePercent(userPts, totalPts);
  }, [stats.totalPoints, userInfo.userInfo]);

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
  // Estimate pool share after a stake/lock/burn using the same linear on-chain
  // formula as userOnChainPoolShare. The contract tracks two linear counters per
  // wallet — stakingPoints (index 2) and burnPoints (index 3) — and totalPoints()
  // is their pool-wide sum. A stake adds amount×1, a lock adds amount×lockMult,
  // and a burn adds amount×10 to both the user's counter and the total.
  // Falls back to the leaderboard sqrt model only if on-chain data hasn't loaded.
  const getEstimatedPoolShare = (rawAmount: string, actionWeight: number): number | null => {
    const amt = parseFloat(rawAmount);
    if (!amt || amt <= 0) return null;

    // Prefer on-chain: (userPts + delta) / (totalPts + delta)
    const totalPts = stats.totalPoints;
    const ui = userInfo.userInfo;
    if (totalPts && totalPts > 0n && ui !== undefined) {
      const userCurrentPts = Number((ui[2] ?? 0n) + (ui[3] ?? 0n));
      const delta = amt * actionWeight;
      const newUserPts = userCurrentPts + delta;
      const newTotalPts = Number(totalPts) + delta;
      if (newTotalPts <= 0) return null;
      return (newUserPts / newTotalPts) * 100;
    }

    // Fallback: leaderboard-calibrated sqrt model (used before on-chain data loads)
    if (!pointsSim.ready || pointsSim.k == null) return null;
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
      // Require explicit confirmation before the irreversible burn.
      setShowBurnConfirm(true);
    }
  };

  const confirmBurn = () => {
    setShowBurnConfirm(false);
    if (!burnAmount || !isConnected || !hasAllowanceForBurn) return;
    burnAction.burn(burnAmount, decimals);
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
    <div className="min-h-screen bg-background text-foreground flex flex-col relative selection:bg-primary/30">
      <div className="fixed inset-0 cyber-grid opacity-[0.03] pointer-events-none z-0" />
      <div className="fixed top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none z-0" />
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-16 relative z-10">
        {/* Back */}
        <Link
          href="/"
          data-testid="btn-back"
          className="inline-flex items-center gap-2 text-primary/60 hover:text-primary transition-colors mb-8 text-[10px] font-mono uppercase tracking-widest group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Back to Explore
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 rounded-2xl bg-card/40 border border-white/5 backdrop-blur-xl relative overflow-hidden shadow-2xl cyber-grid"
        >
          <div className="absolute inset-x-0 top-0 h-px cyber-lines opacity-50" />
          <div className="absolute inset-x-0 bottom-0 h-px cyber-lines opacity-50" />
          <div className="absolute inset-y-0 left-0 w-[4px] bg-primary/40 shadow-[0_0_12px_var(--color-primary)]" />
          
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
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-start gap-5">
                <div className="relative group">
                  <MoatLogo
                    meta={getMoatMeta(contractAddress, moatConfig?.network)}
                    primaryTokenAddress={
                      moatConfig?.rewardTokens?.filter((t) => t.enabled)[0]?.tokenAddress ||
                      getMoatMeta(contractAddress, moatConfig?.network).tokenAddress
                    }
                    onChainLogoUrl={onChainLogoUrl ?? undefined}
                    size="lg"
                  />
                  <div className="absolute -inset-2 bg-primary/20 rounded-[14px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 -z-10" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white drop-shadow-md">
                      {getMoatMeta(contractAddress, moatConfig?.network).name}
                    </h1>
                    {moatConfig?.status && (
                      <span
                        className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-[4px] border ${
                          moatConfig.status === "Verified"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.1)]"
                            : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(0,212,255,0.1)]"
                        }`}
                      >
                        {moatConfig.status}
                      </span>
                    )}
                    {moatConfig?.network && (
                      <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-[4px] bg-black/40 border border-white/10 text-muted-foreground/80">
                        {moatConfig.network}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-mono text-primary/80 uppercase tracking-widest">{getMoatMeta(contractAddress, moatConfig?.network).protocol}</p>
                    <span className="text-white/20">•</span>
                    <p className="font-mono text-xs text-muted-foreground/50">{contractAddress}</p>
                  </div>
                  {moatConfig?.rewardStrategy && (
                    <div className="text-sm text-muted-foreground/90 max-w-3xl border-l-2 border-primary/30 pl-3 relative">
                      <div className="absolute left-[-2px] top-0 bottom-0 w-[2px] bg-primary opacity-0 hover:opacity-100 transition-opacity duration-500 shadow-[0_0_8px_var(--color-primary)]" />
                      {moatConfig.rewardStrategy}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Highlight metrics right side of header */}
              {((tvlUSD !== undefined && tvlUSD > 0) || (supplyPct !== undefined && supplyPct > 0)) && (
                <div className="flex flex-col items-end gap-1 shrink-0 bg-black/40 p-4 rounded-xl border border-white/5 shadow-inner">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-primary/70 mb-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]" />
                    Value Moated
                  </p>
                  <p
                    data-testid={`text-tvl-${contractAddress}`}
                    className="text-3xl font-black text-white tabular-nums tracking-tight leading-none drop-shadow-md"
                  >
                    {tvlUSD !== undefined && tvlUSD > 0 ? formatUSD(tvlUSD) : "—"}
                  </p>
                  {supplyPct !== undefined && supplyPct > 0 && (
                    <p className="text-xs font-bold text-cyan-400 tabular-nums mt-1 border-t border-white/10 pt-1 w-full text-right">
                      {supplyPct >= 0.01 ? `${supplyPct.toFixed(2)}%` : "<0.01%"} supply
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Stats */}
          <div className="lg:col-span-2 space-y-8">
            {/* On-chain Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                {
                  label: "Total Staked",
                  value: totalStakedFormatted,
                  icon: TrendingUp,
                  color: "text-primary",
                  glow: "shadow-[0_0_15px_rgba(0,212,255,0.15)]",
                  testId: "stat-total-staked",
                },
                {
                  label: "Total Locked",
                  value: totalLockedFormatted,
                  icon: Lock,
                  color: "text-violet-400",
                  glow: "shadow-[0_0_15px_rgba(167,139,250,0.15)]",
                  testId: "stat-total-locked",
                },
                {
                  label: "Total Points",
                  value: formatPoints(totalPoints),
                  icon: Zap,
                  color: "text-cyan-400",
                  glow: "shadow-[0_0_15px_rgba(34,211,238,0.15)]",
                  testId: "stat-total-points",
                },
                {
                  label: "Participants",
                  value: participantCount.toLocaleString(),
                  icon: Users,
                  color: "text-emerald-400",
                  glow: "shadow-[0_0_15px_rgba(52,211,153,0.15)]",
                  testId: "stat-participants",
                },
                {
                  label: "Total Burned",
                  value: totalBurnedFormatted,
                  icon: Zap,
                  color: "text-rose-400",
                  glow: "shadow-[0_0_15px_rgba(244,63,94,0.15)]",
                  testId: "stat-total-burned",
                },
              ].map((s) => (
                <div
                  key={s.label}
                  data-testid={s.testId}
                  className={`rounded-xl border border-white/5 bg-card/40 backdrop-blur-md p-4 min-w-0 relative overflow-hidden group hover:border-white/10 transition-all ${s.glow}`}
                >
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-center gap-1.5 mb-2">
                    <s.icon size={13} className={s.color} />
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest truncate">{s.label}</span>
                  </div>
                  <p className="font-black text-xl tabular-nums tracking-tight truncate text-white drop-shadow-sm">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Moat Config Details */}
            {moatConfig && (
              <div className="rounded-2xl border border-white/5 bg-card/40 backdrop-blur-xl p-8 relative overflow-hidden cyber-grid shadow-2xl flex flex-col gap-8 group/panel">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent opacity-50" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(0,212,255,0.05),transparent_50%)] pointer-events-none" />

                <div className="flex items-center gap-3 relative z-10">
                  <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_15px_rgba(0,212,255,0.15)]">
                    <Coins size={20} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
                  </div>
                  <div>
                    <h3 className="font-black text-white text-xl tracking-tight leading-none drop-shadow-sm">
                      Reward Tokens
                    </h3>
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mt-1">
                      Active Yield Instruments
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
                  {enabledRewardTokens.map((token) => {
                    const dexImg =
                      SYMBOL_LOGOS[token.symbol.toUpperCase()] ||
                      dexInfoMap?.[token.tokenAddress.toLowerCase()]?.imageUrl ||
                      getTokenLogoUrl(token.tokenAddress) ||
                      undefined;
                    return (
                      <div
                        key={token._id}
                        className="group flex flex-col p-5 rounded-xl border border-white/10 bg-black/40 hover:bg-black/60 hover:border-cyan-500/40 transition-all duration-500 relative overflow-hidden"
                        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}
                      >
                        {/* Hover glows */}
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="absolute -inset-1 bg-cyan-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />

                        {/* Top row: Logo & Identity */}
                        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-white/5 relative z-10">
                          {/* Keyed by logo URL: onError mutates DOM styles directly, so a
                              remount is needed when the source changes (e.g. DexScreener
                              image arriving after a 404'd fallback). */}
                          <div className="relative shrink-0" key={dexImg ?? "no-logo"}>
                            {dexImg ? (
                              <img
                                src={dexImg}
                                alt={token.symbol}
                                className="w-12 h-12 rounded-full border-2 border-white/10 bg-black object-cover shadow-[0_0_15px_rgba(0,0,0,0.5)] group-hover:border-cyan-500/50 transition-colors"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  const next = e.currentTarget.nextElementSibling as HTMLElement;
                                  if (next) next.style.display = "flex";
                                }}
                              />
                            ) : null}
                            <div
                              className={`w-12 h-12 rounded-full border-2 border-white/10 bg-gradient-to-br from-cyan-500/20 to-primary/10 shadow-[inset_0_0_15px_rgba(0,212,255,0.2)] items-center justify-center text-cyan-400 font-black text-lg ${dexImg ? "hidden" : "flex"} group-hover:border-cyan-500/50 transition-colors`}
                            >
                              {token.symbol.slice(0, 2)}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-black rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)]" title="Active Emission" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-white text-lg tracking-tight truncate drop-shadow-sm group-hover:text-cyan-300 transition-colors">
                              {token.symbol}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate">{token.name}</p>
                          </div>
                        </div>

                        {/* Stats grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-5 relative z-10">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                              Daily Reward
                            </span>
                            <span className="font-medium text-white tabular-nums tracking-tight">
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
                                  <span className="flex flex-col">
                                    <span className="text-sm font-bold text-emerald-400 drop-shadow-sm">{prefix}{fmt} {token.symbol}</span>
                                    {dailyUSD > 0 && (
                                      <span className="text-xs text-emerald-500/70 font-mono mt-0.5">
                                        ≈ {formatUSD(dailyUSD)}
                                      </span>
                                    )}
                                  </span>
                                );
                              })()}
                            </span>
                          </div>

                          <div className="flex flex-col">
                            <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-1.5">
                              Total Distributed
                            </span>
                            <span className="font-medium text-white tabular-nums tracking-tight">
                              {(() => {
                                const extra = supplementalByToken[token.tokenAddress.toLowerCase()] ?? 0;
                                const apiPlusExtra = token.totalRewardsDeposited + extra;
                                // Prefer on-chain totalDeposited (storage var, always current)
                                // over API counter + event supplement (may lag or have window gaps).
                                const onChainTotal = onChainTotalDepositedByToken[token.tokenAddress.toLowerCase()];
                                const v = onChainTotal !== undefined ? Math.max(onChainTotal, apiPlusExtra) : apiPlusExtra;
                                const fmt =
                                  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2)}M`
                                  : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K`
                                  : v >= 1 ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                  : v > 0 ? parseFloat(v.toPrecision(8)).toString()
                                  : "0";
                                const usd = getRewardTokenPrice(token.tokenAddress);
                                const totalUSD = usd && v > 0 ? v * usd : 0;
                                return (
                                  <span className="flex flex-col">
                                    <span className="text-sm">{fmt} {token.symbol}</span>
                                    {totalUSD > 0 && (
                                      <span className="text-xs text-emerald-500/70 font-mono mt-0.5">
                                        ≈ {formatUSD(totalUSD)}
                                      </span>
                                    )}
                                  </span>
                                );
                              })()}
                            </span>
                          </div>

                          {lastDepositedMap[token.tokenAddress.toLowerCase()] && (
                            <div className="flex flex-col col-span-2 border-t border-white/5 pt-3 mt-1">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-mono text-muted-foreground/60 uppercase tracking-widest text-[10px]">Last Distributed</span>
                                <span className="font-medium text-primary/80 flex items-center gap-1.5">
                                  <Clock size={12} className="text-primary/50" />
                                  {timeAgo(lastDepositedMap[token.tokenAddress.toLowerCase()])}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-4 relative z-10 border-t border-white/5 pt-6 mt-2">
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
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 rounded-xl bg-black/60 border border-emerald-500/20 overflow-hidden shadow-[inset_0_0_30px_rgba(52,211,153,0.03)]">
                        <div className="p-4 border-r border-white/5 flex flex-col justify-center">
                          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1.5 flex items-center gap-1.5">
                            <Activity size={12} className="text-emerald-500" />
                            Daily Emission{isEstimated && " (est.)"}
                          </p>
                          <p className="font-bold text-emerald-400 tabular-nums text-lg drop-shadow-sm">
                            {isEstimated ? "~" : ""}{fmtAmt(dailyAmt)} <span className="text-sm">{token.symbol}/d</span>
                          </p>
                        </div>
                        <div className="p-4 border-r border-white/5 flex flex-col justify-center">
                          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1.5 flex items-center gap-1.5">
                            <Clock size={12} className="text-cyan-500" />
                            Reward Duration
                          </p>
                          <p className="font-bold text-cyan-400 text-lg drop-shadow-sm">
                            {daysRemaining != null ? `~${daysRemaining} days` : "Ongoing"}
                          </p>
                        </div>
                        <div className="p-4 flex flex-col justify-center relative overflow-hidden group">
                          <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1.5 flex items-center gap-1.5 relative z-10">
                            <Droplets size={12} className="text-primary" />
                            Total Pool
                          </p>
                          <p className="font-bold text-white tabular-nums text-lg relative z-10">
                            {fmtAmt(getPoolBalance(token.tokenAddress) || token.totalRewardsDeposited)} <span className="text-sm text-muted-foreground">{token.symbol}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Additional moat meta */}
                  <div className="flex flex-wrap gap-2 mt-2">
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
                      <div key={item.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">{item.label}</span>
                        <span className="text-xs font-semibold text-white/90">{item.value}</span>
                      </div>
                    ))}
                  </div>
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
              <div className="rounded-2xl border border-white/5 bg-card/40 backdrop-blur-xl p-6 relative overflow-hidden shadow-lg cyber-grid group">
                <div className="absolute inset-x-0 top-0 h-px cyber-lines opacity-40" />
                <div className="absolute -inset-2 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                <h3 className="font-bold mb-6 flex items-center gap-2 text-white text-lg tracking-tight">
                  <Users size={18} className="text-primary" />
                  Your Position
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
                      // Only show the contract-derived share. The API
                      // leaderboard weight is an estimate and can be stale.
                      weightedPct: userOnChainPoolShare ?? 0,
                    },
                  ].map((item) => {
                    const weightedPct = (item as { weightedPct?: number }).weightedPct ?? 0;
                    return (
                      <div key={item.label} data-testid={item.testId} className="relative z-10 p-4 rounded-xl bg-black/20 border border-white/5 hover:border-white/10 transition-colors min-w-0 overflow-hidden">
                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">{item.label}</p>
                        <p className="font-bold text-xl tabular-nums tracking-tight text-white drop-shadow-sm truncate" title={item.value}>{item.value}</p>
                        {item.usd > 0 && (
                          <p className="text-xs text-emerald-400/90 font-medium tabular-nums mt-1">{formatUSD(item.usd)}</p>
                        )}
                        {weightedPct > 0 && (
                          <p
                            data-testid="user-weighted-pct"
                            className="text-[11px] text-cyan-400 font-mono tracking-widest uppercase mt-1.5"
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
                  <div className="mt-6 pt-6 border-t border-white/5 relative z-10">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-3">Pending Rewards</p>
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
                            className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                          >
                            <span className="font-bold tracking-tight">
                              {fmtTokenAmt(amount)} <span className="font-normal">{rewardConfig?.symbol ?? formatAddress(token)}</span>
                            </span>
                            {usdVal > 0 && (
                              <span className="text-emerald-500/70 font-mono">({formatUSD(usdVal)})</span>
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
                className="rounded-2xl border border-cyan-500/20 bg-card/40 backdrop-blur-xl overflow-hidden shadow-[0_0_30px_rgba(34,211,238,0.05)] relative cyber-grid"
              >
                <div className="absolute inset-x-0 top-0 h-px cyber-lines opacity-30" />
                <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between relative z-10 bg-black/20">
                  <h3 className="font-bold flex items-center gap-2 text-white tracking-tight">
                    <Lock size={16} className="text-cyan-400" />
                    My Locks
                    {locks.length > 0 && (
                      <span className="px-2 py-0.5 rounded-[4px] bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-mono text-cyan-400 uppercase tracking-widest ml-2">
                        {locks.length} active
                      </span>
                    )}
                  </h3>
                </div>

                {locksLoading ? (
                  <div className="p-8 flex items-center justify-center gap-3 text-cyan-400/50 text-sm font-mono uppercase tracking-widest relative z-10">
                    <Loader2 size={16} className="animate-spin" /> Scanning locks…
                  </div>
                ) : locks.length === 0 ? (
                  <div className="p-8 text-center relative z-10">
                    <Lock size={32} className="mx-auto mb-3 text-cyan-500/20" />
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">No active locks</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5 relative z-10">
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
                          className="px-6 py-5 group hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                {isMatured ? (
                                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest font-bold px-2 py-0.5 rounded-[4px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                    <Unlock size={10} /> Ready
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest font-bold px-2 py-0.5 rounded-[4px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.1)]">
                                    <Lock size={10} /> Locked
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                                  Lock #{lock.index + 1}
                                </span>
                              </div>
                              <p className="text-2xl font-black tabular-nums tracking-tight text-white drop-shadow-sm">
                                {amountFormatted}{" "}
                                <span className="text-sm font-normal text-muted-foreground">
                                  {tokenBalance.symbol}
                                </span>
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1 flex items-center justify-end gap-1.5">
                                <Clock size={11} className={isMatured ? "text-emerald-500/50" : "text-cyan-500/50"} /> Unlocks
                              </p>
                              <p className="text-sm font-bold tabular-nums text-white">
                                {endDate.toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                              <p className={`text-[10px] font-mono uppercase tracking-widest mt-0.5 ${isMatured ? "text-emerald-400" : "text-cyan-400"}`}>
                                {timeLeft}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6 text-xs mb-5 p-3 rounded-xl bg-black/20 border border-white/5">
                            <div>
                              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Duration</p>
                              <p className="font-semibold text-white">{durationLabel}</p>
                            </div>
                          </div>

                          {isMatured ? (
                            <button
                              data-testid={`btn-exit-lock-${lock.index}`}
                              onClick={() => exitAction.exitLock(lock.index)}
                              disabled={isBusy}
                              className="w-full py-3 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold hover:bg-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all disabled:opacity-50 disabled:hover:bg-emerald-500/10 flex items-center justify-center gap-2"
                            >
                              {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                              {exitAction.isConfirming ? "Confirming…" : exitAction.isPending ? "Submitting…" : "Exit Lock"}
                            </button>
                          ) : earlyExitConfirm === lock.index ? (
                            <div className="space-y-3 p-4 rounded-xl bg-black/40 border border-rose-500/20 shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]">
                              <div className="flex items-start gap-3 text-xs text-rose-400/90 leading-relaxed">
                                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-500" />
                                <span>
                                  Early exit forfeits lock point bonuses and may incur a penalty fee set by the protocol. <strong className="text-rose-400 font-bold">This cannot be undone.</strong>
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEarlyExitConfirm(null)}
                                  className="flex-1 py-2.5 rounded-lg border border-white/10 text-muted-foreground text-xs font-bold hover:bg-white/5 hover:text-white transition-colors"
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
                                  className="flex-1 py-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold hover:bg-rose-500/20 hover:shadow-[0_0_15px_rgba(244,63,94,0.15)] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                  {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Flame size={12} />}
                                  Confirm Exit
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              data-testid={`btn-early-exit-${lock.index}`}
                              onClick={() => setEarlyExitConfirm(lock.index)}
                              disabled={isBusy}
                              className="w-full py-3 px-4 rounded-xl border border-rose-500/10 bg-rose-500/5 text-rose-400 text-xs font-bold hover:bg-rose-500/10 hover:border-rose-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 group/btn"
                            >
                              <AlertTriangle size={14} className="group-hover/btn:scale-110 transition-transform" />
                              Emergency Exit
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
            {leaderboard.length > 0 && (() => {
              const sorted = [...leaderboard].sort((a, b) => b.points - a.points);
              const PAGE_SIZE = 10;
              const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
              const pageStart = stakerPage * PAGE_SIZE;
              const pageEntries = sorted.slice(pageStart, pageStart + PAGE_SIZE);
              return (
                <div className="rounded-2xl border border-white/5 bg-card/40 backdrop-blur-xl overflow-hidden relative shadow-lg">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                  <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-black/20">
                    <h3 className="font-bold flex items-center gap-2 text-white tracking-tight">
                      <Trophy size={16} className="text-yellow-400" />
                      Top Stakers
                    </h3>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                      {participantCount} participants
                    </span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {pageEntries.map((entry, i) => {
                      const rank = pageStart + i;
                      return (
                        <div
                          key={entry.address}
                          data-testid={`row-staker-${rank}`}
                          className="px-6 py-3.5 flex items-center justify-between group hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                              rank === 0 ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.2)]" :
                              rank === 1 ? "bg-slate-300/20 text-slate-300 border border-slate-300/30" :
                              rank === 2 ? "bg-amber-700/20 text-amber-600 border border-amber-700/30" :
                              "bg-white/5 text-muted-foreground"
                            }`}>
                              {rank + 1}
                            </span>
                            <span className="font-mono text-sm text-white group-hover:text-primary transition-colors">{formatAddress(entry.address)}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-primary text-sm tabular-nums drop-shadow-sm">
                              {formatPoints(entry.points)} pts
                            </span>
                            {entry.boosted && (
                              <span className="text-[10px] font-mono text-cyan-400/80 uppercase tracking-widest mt-0.5">
                                {entry.boostMultiplier}x boost
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {totalPages > 1 && (
                    <div className="px-6 py-3.5 border-t border-white/5 bg-black/20 flex items-center justify-between">
                      <button
                        onClick={() => setStakerPage((p) => Math.max(0, p - 1))}
                        disabled={stakerPage === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-white/5 hover:border-white/10"
                      >
                        ← Prev
                      </button>
                      <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                        Page {stakerPage + 1} of {totalPages}
                      </span>
                      <button
                        onClick={() => setStakerPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={stakerPage === totalPages - 1}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-white hover:bg-white/5 transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-white/5 hover:border-white/10"
                      >
                        Next →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Recent Events for this contract */}
            {mergedEvents.length > 0 && (
              <div className="relative">
                <div className="absolute -inset-x-6 top-10 bottom-0 bg-black/20 -z-10 rounded-3xl" />
                <h3 className="font-bold mb-6 flex items-center justify-between text-white text-lg tracking-tight">
                  <span className="flex items-center gap-2">
                    <Activity size={18} className="text-primary" />
                    Live Activity
                  </span>
                  <span className="text-[10px] font-mono text-primary/70 uppercase tracking-widest px-3 py-1 rounded-[4px] bg-primary/10 border border-primary/20 shadow-[0_0_10px_rgba(0,212,255,0.1)]">
                    {(eventsData?.total ?? mergedEvents.length).toLocaleString()} total events
                  </span>
                </h3>
                <ActivityFeed events={mergedEvents.slice(0, 8)} moatConfigs={moatConfig ? [moatConfig] : undefined} />
              </div>
            )}

            {/* Similar Moats — discovery section based on shared rewards, tags & activity */}
            {moatConfig && <SimilarMoats currentMoat={moatConfig} />}
          </div>

          {/* Right: Action Panel */}
          <div className="sticky top-24 self-start">
            <div className="rounded-2xl border border-white/5 bg-black/40 backdrop-blur-2xl overflow-hidden shadow-2xl relative cyber-grid">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />
              {/* Tabs with animated sliding underline */}
              <div className="flex border-b border-white/5 bg-black/20 overflow-x-auto no-scrollbar relative z-10">
                {(["stake", "withdraw", "lock", "burn"] as ActionTab[]).map((t) => {
                  const isActive = activeTab === t;
                  const isBurn = t === "burn";
                  return (
                    <button
                      key={t}
                      onClick={() => setActiveTab(t)}
                      data-testid={`tab-action-${t}`}
                      className={`relative flex-1 min-w-fit py-4 px-2 text-[11px] font-mono tracking-widest uppercase transition-colors ${
                        isActive
                          ? isBurn
                            ? "text-rose-400 font-bold"
                            : "text-primary font-bold"
                          : "text-muted-foreground hover:text-white"
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
                          className={`absolute bottom-0 left-0 right-0 h-[2px] ${isBurn ? "bg-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.8)]" : "bg-primary shadow-[0_0_10px_rgba(0,212,255,0.8)]"}`}
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="p-6 relative z-10">
                {!isConnected ? (
                  <div className="text-center py-8">
                    <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mb-6">
                      Connect your wallet to interact with this Moat
                    </p>
                    <button
                      onClick={() => open({ view: "Connect" })}
                      data-testid="btn-connect-wallet-actions"
                      className="btn-shimmer inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-black font-black uppercase tracking-widest text-[11px] hover:bg-primary/90 transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,212,255,0.35)]"
                    >
                      <Wallet size={15} />
                      Connect Wallet
                    </button>
                  </div>
                ) : (
                  <>
                    {tokenBalance.balance !== undefined && (
                      <div className="mb-6 p-4 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between shadow-inner">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Wallet Balance</span>
                        <span className="text-sm font-bold text-white tabular-nums drop-shadow-sm">
                          {parseFloat(tokenBalance.formatted || "0").toFixed(4)}{" "}
                          <span className="font-normal text-muted-foreground">{tokenBalance.symbol}</span>
                        </span>
                      </div>
                    )}

                    {/* Stake */}
                    {activeTab === "stake" && (
                      <div className="space-y-5">
                        <div>
                          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2 block">
                            Amount to Stake
                          </label>
                          <div className="relative group">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={fmtAmt(stakeAmount)}
                              onChange={(e) => setStakeAmount(parseAmt(e.target.value))}
                              placeholder="0.00"
                              data-testid="input-stake-amount"
                              className="w-full px-4 py-4 rounded-xl bg-black/50 border border-white/10 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-lg font-bold text-white tabular-nums pr-16 transition-all group-hover:border-white/20 shadow-inner"
                            />
                            <button
                              onClick={() => setStakeAmount(parseAmt(tokenBalance.formatted || "0"))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            >
                              MAX
                            </button>
                          </div>
                        </div>
                        <div className="text-xs p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                          <p className="flex justify-between items-center">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Points per token</span>
                            <span className="font-bold text-white">1x</span>
                          </p>
                          <p className="flex justify-between items-center">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Unstake fee</span>
                            <span className="font-bold text-white">
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
                          className="btn-shimmer w-full py-4 rounded-xl bg-primary text-black font-black uppercase tracking-widest text-[11px] hover:opacity-95 hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-2"
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
                      <div className="space-y-5">
                        <div>
                          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2 block">
                            Amount to Lock
                          </label>
                          <div className="relative group">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={fmtAmt(lockAmount)}
                              onChange={(e) => setLockAmount(parseAmt(e.target.value))}
                              placeholder="0.00"
                              data-testid="input-lock-amount"
                              className="w-full px-4 py-4 rounded-xl bg-black/50 border border-white/10 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400 text-lg font-bold text-white tabular-nums pr-16 transition-all group-hover:border-white/20 shadow-inner"
                            />
                            <button
                              onClick={() => setLockAmount(parseAmt(tokenBalance.formatted || "0"))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                            >
                              MAX
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2 block">
                            Lock Duration
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                            {lockMultiplierInfo.slice(0, 3).map((option) => (
                              <button
                                key={option.days}
                                onClick={() => setLockDays(option.days)}
                                data-testid={`btn-lock-duration-${option.days}`}
                                className={`p-2.5 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all ${
                                  lockDays === option.days
                                    ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[inset_0_0_15px_rgba(34,211,238,0.1)] font-bold"
                                    : "bg-white/5 border border-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                <div>{option.label}</div>
                                <div className={`mt-1 font-bold text-sm tabular-nums ${lockDays === option.days ? "text-cyan-400" : "text-white"}`}>{option.multiplier}</div>
                              </button>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {lockMultiplierInfo.slice(3).map((option) => (
                              <button
                                key={option.days}
                                onClick={() => setLockDays(option.days)}
                                data-testid={`btn-lock-duration-${option.days}`}
                                className={`p-2.5 rounded-xl text-[10px] font-mono uppercase tracking-widest transition-all ${
                                  lockDays === option.days
                                    ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[inset_0_0_15px_rgba(34,211,238,0.1)] font-bold"
                                    : "bg-white/5 border border-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
                                }`}
                              >
                                <div>{option.label}</div>
                                <div className={`mt-1 font-bold text-sm tabular-nums ${lockDays === option.days ? "text-cyan-400" : "text-white"}`}>{option.multiplier}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="text-xs p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 flex justify-between items-center shadow-[inset_0_0_20px_rgba(34,211,238,0.05)]">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-500/70">Selected multiplier</span>
                          <span className="font-bold text-cyan-400 text-sm" data-testid="lock-multiplier-display">
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
                          className="btn-shimmer w-full py-4 rounded-xl bg-cyan-500 text-black font-black uppercase tracking-widest text-[11px] hover:opacity-95 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-2"
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
                      <div className="space-y-5">
                        {userInfo.userInfo !== undefined && (
                          <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between shadow-inner">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Staked Balance</span>
                            <span className="text-sm font-bold text-white tabular-nums drop-shadow-sm">
                              {userStakedFormatted}{" "}
                              <span className="font-normal text-muted-foreground">{tokenBalance.symbol}</span>
                            </span>
                          </div>
                        )}
                        <div>
                          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2 block">
                            Amount to Withdraw
                          </label>
                          <div className="relative group">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={fmtAmt(withdrawAmount)}
                              onChange={(e) => setWithdrawAmount(parseAmt(e.target.value))}
                              placeholder="0.00"
                              data-testid="input-withdraw-amount"
                              className="w-full px-4 py-4 rounded-xl bg-black/50 border border-white/10 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 text-lg font-bold text-white tabular-nums pr-16 transition-all group-hover:border-white/20 shadow-inner"
                            />
                            <button
                              onClick={() => setWithdrawAmount(parseAmt(userStakedFormatted))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors"
                            >
                              MAX
                            </button>
                          </div>
                        </div>
                        <div className="text-xs p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)]">
                          <p className="flex justify-between items-center">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500/70">Unstake fee</span>
                            <span className="font-bold text-amber-500">
                              {stats.unstakeFee !== undefined ? `${Number(stats.unstakeFee) / 100}%` : "5%"}
                            </span>
                          </p>
                          <p className="text-[9px] font-mono uppercase tracking-widest text-amber-500/50">A fee is applied to unstaked tokens.</p>
                        </div>
                        <button
                          onClick={handleWithdraw}
                          disabled={!withdrawAmount || unstakeAction.isPending || unstakeAction.isConfirming}
                          data-testid="btn-withdraw"
                          className="btn-shimmer w-full py-4 rounded-xl bg-amber-500 text-black font-black uppercase tracking-widest text-[11px] hover:opacity-95 hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-2"
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
                      <div className="space-y-5">
                        <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 shadow-[inset_0_0_20px_rgba(244,63,94,0.05)]">
                          <div className="flex items-center gap-2 mb-2">
                            <Flame size={16} className="text-rose-400 animate-pulse" />
                            <span className="text-sm font-bold text-rose-400 tracking-tight">Permanent Burn</span>
                          </div>
                          <p className="text-[10px] font-mono uppercase tracking-widest text-rose-400/70 leading-relaxed">
                            Burned tokens are permanently removed from circulation. <strong className="text-rose-400 font-bold">This action is irreversible</strong> and earns bonus burn points toward your Moat score.
                          </p>
                        </div>
                        {userInfo.userInfo !== undefined && (
                          <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between shadow-inner">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Your Burn Total</span>
                            <span className="text-sm font-bold text-rose-400 tabular-nums drop-shadow-sm">
                              {userBurnFormatted} <span className="font-normal text-rose-400/50">{tokenBalance.symbol}</span>
                            </span>
                          </div>
                        )}
                        <div>
                          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2 block">
                            Amount to Burn
                          </label>
                          <div className="relative group">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={fmtAmt(burnAmount)}
                              onChange={(e) => setBurnAmount(parseAmt(e.target.value))}
                              placeholder="0.00"
                              data-testid="input-burn-amount"
                              className="w-full px-4 py-4 rounded-xl bg-black/50 border border-white/10 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 text-lg font-bold text-white tabular-nums pr-16 transition-all group-hover:border-white/20 shadow-inner"
                            />
                            <button
                              onClick={() => setBurnAmount(parseAmt(tokenBalance.formatted || "0"))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono uppercase tracking-widest font-bold px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
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
                          className="btn-shimmer w-full py-4 rounded-xl bg-rose-500 text-black font-black uppercase tracking-widest text-[11px] hover:opacity-95 hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-2"
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
            <div className="mt-4 rounded-2xl border border-white/5 bg-black/40 backdrop-blur-2xl overflow-hidden shadow-[0_0_30px_rgba(52,211,153,0.05)] relative cyber-grid">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent opacity-50" />
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 relative z-10">
                <div className="flex items-center gap-2">
                  <Gift size={15} className="text-emerald-400" />
                  <span className="text-[11px] font-mono text-emerald-400 tracking-widest uppercase font-bold">Claim Rewards</span>
                </div>
                {(() => {
                  const hasKnownRewards = userInfo.pendingRewards && userInfo.pendingRewards[0].some((_, i) => {
                    const dec = getPendingRewardDecimals(i);
                    return parseFloat(formatUnits(userInfo.pendingRewards![1][i], dec)) > 0;
                  });
                  const couldHaveRewards = !userInfo.pendingRewards && !!userInfo.pendingRewardsError;
                  return (hasKnownRewards || couldHaveRewards) && (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 uppercase tracking-widest font-bold animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.2)]">
                      Rewards Ready
                    </span>
                  );
                })()}
              </div>
              <div className="p-6 relative z-10">
                {!isConnected ? (
                  <div className="text-center py-6">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-6">
                      Connect your wallet to view and claim rewards
                    </p>
                    <button
                      onClick={() => open({ view: "Connect" })}
                      data-testid="btn-connect-wallet-rewards"
                      className="btn-shimmer inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-black font-black uppercase tracking-widest text-[11px] hover:bg-primary/90 transition-all duration-200 hover:shadow-[0_0_20px_rgba(0,212,255,0.35)]"
                    >
                      <Wallet size={15} />
                      Connect Wallet
                    </button>
                  </div>
                ) : userInfo.isLoading ? (
                  <div className="space-y-2">
                    {[1, 2].map((n) => (
                      <div key={n} className="skeleton-shimmer h-12 rounded-xl bg-white/5" />
                    ))}
                  </div>
                ) : (() => {
                  const contractReverted = !userInfo.pendingRewards && !!userInfo.pendingRewardsError;

                  if (contractReverted) {
                    const enabledTokens = enabledRewardTokens;
                    const ui = userInfo.userInfo;
                    const hasAnyPosition = !!ui && (ui[0] > 0n || ui[1] > 0n || ui[4] > 0n);
                    return (
                      <div className="space-y-5">
                        <div className="rounded-xl overflow-hidden border border-emerald-500/20 bg-emerald-500/5 shadow-[inset_0_0_20px_rgba(52,211,153,0.05)]">
                          {enabledTokens.length > 0 ? (
                            enabledTokens.map((t, idx) => (
                              <div
                                key={t.tokenAddress}
                                className={`flex items-center justify-between px-5 py-4 ${idx < enabledTokens.length - 1 ? "border-b border-emerald-500/15" : ""}`}
                              >
                                <div className="flex items-center gap-3">
                                  <TokenLogo
                                    address={t.tokenAddress}
                                    symbol={t.symbol}
                                    network={moatConfig?.network ?? "avalanche"}
                                    hint={dexInfoMap?.[t.tokenAddress.toLowerCase()]?.imageUrl || getTokenLogoUrl(t.tokenAddress) || undefined}
                                    size={32}
                                    className="ring-1 ring-white/10"
                                  />
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-bold text-white tracking-wide">{t.symbol}</span>
                                    <span className="text-[10px] font-mono text-emerald-500/70 uppercase tracking-widest">{t.name}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold tabular-nums text-emerald-400 drop-shadow-sm">—</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="px-5 py-6 text-center">
                              <Gift size={20} className="text-emerald-500/50 mx-auto mb-3 opacity-50" />
                              <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest">Rewards may be available</p>
                            </div>
                          )}
                          <div className="px-5 py-3 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2">
                            <span className="text-[9px] font-mono uppercase tracking-widest text-amber-500/80 font-bold">Exact amounts calculated on-chain at claim time</span>
                          </div>
                        </div>
                        <button
                          onClick={() => claimAction.claim()}
                          disabled={!hasAnyPosition || claimAction.isPending || claimAction.isConfirming}
                          data-testid="btn-claim"
                          className="btn-shimmer w-full py-4 rounded-xl bg-emerald-500 text-black font-black uppercase tracking-widest text-[11px] hover:opacity-95 hover:shadow-[0_0_20px_rgba(52,211,153,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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
                    <div className="space-y-5">
                      <div className="rounded-xl overflow-hidden border border-emerald-500/20 bg-emerald-500/5 shadow-[inset_0_0_20px_rgba(52,211,153,0.05)]">
                        {hasRewards ? (
                          <>
                            {claimRows.map((r, idx) => (
                              <div
                                key={r.token}
                                className={`flex items-center justify-between px-5 py-4 ${idx < claimRows.length - 1 ? "border-b border-emerald-500/15" : ""}`}
                              >
                                <div className="flex items-center gap-3">
                                  <TokenLogo
                                    address={r.token}
                                    symbol={r.cfg?.symbol ?? formatAddress(r.token)}
                                    network={moatConfig?.network ?? "avalanche"}
                                    hint={dexInfoMap?.[r.token.toLowerCase()]?.imageUrl || getTokenLogoUrl(r.token) || undefined}
                                    size={32}
                                    className="ring-1 ring-white/10"
                                  />
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-bold text-white tracking-wide">
                                      {r.cfg?.symbol ?? formatAddress(r.token)}
                                    </span>
                                    {r.cfg?.name && (
                                      <span className="text-[10px] font-mono text-emerald-500/70 uppercase tracking-widest">{r.cfg.name}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold tabular-nums text-emerald-400 drop-shadow-sm">
                                    {fmtTokenAmt(r.amt)}
                                  </p>
                                  {r.usd > 0 && (
                                    <p className="text-[10px] font-mono text-emerald-300/70 tabular-nums uppercase mt-0.5">
                                      {formatUSD(r.usd)}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                            {totalUSD > 0 && (
                              <div className="flex items-center justify-between px-5 py-3 bg-emerald-500/10 border-t border-emerald-500/20">
                                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500/70 font-bold">Total value</span>
                                <span className="text-sm font-bold text-emerald-400 drop-shadow-sm">{formatUSD(totalUSD)}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="px-5 py-6 text-center">
                            <Gift size={20} className="text-emerald-500/30 mx-auto mb-3" />
                            <p className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest font-bold">No pending rewards</p>
                            <p className="text-[9px] font-mono text-emerald-500/50 uppercase tracking-widest mt-1">Rewards accrue as you stake</p>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => claimAction.claim()}
                        disabled={!hasRewards || claimAction.isPending || claimAction.isConfirming}
                        data-testid="btn-claim"
                        className="btn-shimmer w-full py-4 rounded-xl bg-emerald-500 text-black font-black uppercase tracking-widest text-[11px] hover:opacity-95 hover:shadow-[0_0_20px_rgba(52,211,153,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
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

      {/* Burn confirmation */}
      <AnimatePresence>
        {showBurnConfirm && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowBurnConfirm(false)}
            />
            <motion.div
              className="relative z-10 w-full max-w-md rounded-2xl border border-rose-500/30 bg-card shadow-2xl shadow-black/50 overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              data-testid="modal-burn-confirm"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/30">
                    <Flame size={20} className="text-rose-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Confirm Permanent Burn</h3>
                    <p className="text-xs text-rose-400 font-medium">This action cannot be undone</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Burning permanently removes{" "}
                  <span className="font-semibold text-foreground">
                    {burnAmount || "0"} {tokenBalance.symbol}
                  </span>{" "}
                  from circulation. These tokens cannot be recovered. Do you want to continue?
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setShowBurnConfirm(false)}
                    data-testid="btn-burn-cancel"
                    className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBurn}
                    data-testid="btn-burn-confirm"
                    className="flex-1 py-3 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:opacity-95 hover:shadow-[0_0_20px_rgba(239,68,68,0.35)] transition-all flex items-center justify-center gap-2"
                  >
                    <Flame size={14} />Burn Tokens
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}

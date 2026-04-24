import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useAccount, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, Award, AlertCircle, ArrowDownRight, Lock, DollarSign, ArrowUpRight, Flame, Gift } from "lucide-react";
import { useMapsScore, useAllMoatConfigs, useUserEvents } from "@/hooks/use-moats-api";
import { useTokenPrices, getLlamaId } from "@/hooks/use-token-prices";
import { useDexscreenerInfo } from "@/hooks/use-dexscreener";
import { useDailyRewardEstimates } from "@/hooks/use-daily-reward-estimates";
import { MOAT_V3_ABI, ERC20_ABI, MOAT_LOGO_ABI } from "@/lib/moat-abi";
import { moatsApi } from "@/lib/moats-api";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { formatAddress, formatPoints, getEventTypeLabel, getEventTypeColor, getExplorerUrl, timeAgo, formatUSD, getMoatMeta } from "@/lib/moat-metadata";
import { Link } from "wouter";

function formatTokenAmount(raw: bigint, decimals: number = 18): string {
  const val = parseFloat(formatUnits(raw, decimals));
  if (val >= 1) {
    return val.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return val.toLocaleString("en-US", { maximumFractionDigits: 4 });
}


export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const { data: mapsScore, isLoading: scoreLoading } = useMapsScore(address);
  const { data: configs, isLoading: configsLoading } = useAllMoatConfigs();
  const { data: userEvents, isLoading: eventsLoading } = useUserEvents(address);

  // ── Step 1: batch userInfo(wallet) for ALL moats ──────────────────────────
  // userInfo returns: (stakedAmount, totalUserBurn, stakingPoints, burnPoints, activeLockCount)
  const userInfoContracts = useMemo(() => {
    if (!configs || !address) return [];
    return configs.map((c) => ({
      address: c.contractAddress as `0x${string}`,
      abi: MOAT_V3_ABI,
      functionName: "userInfo" as const,
      args: [address as `0x${string}`],
    }));
  }, [configs, address]);

  const { data: userInfoResults, isLoading: infoLoading } = useReadContracts({
    contracts: userInfoContracts,
    query: { enabled: userInfoContracts.length > 0 },
  });

  // ── Logo batch read ───────────────────────────────────────────────────────
  const logoContracts = useMemo(() => {
    if (!configs) return [];
    return configs.map((c) => ({
      address: c.contractAddress as `0x${string}`,
      abi: MOAT_LOGO_ABI,
      functionName: "getLogoURL" as const,
    }));
  }, [configs]);

  const { data: logoData } = useReadContracts({
    contracts: logoContracts,
    query: { enabled: logoContracts.length > 0, staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  });

  const logoMap = useMemo((): Record<string, string> => {
    if (!logoData || !configs) return {};
    const m: Record<string, string> = {};
    configs.forEach((c, i) => {
      const r = logoData[i];
      if (r?.status === "success" && typeof r.result === "string" && r.result.length > 0) {
        m[c.contractAddress.toLowerCase()] = r.result;
      }
    });
    return m;
  }, [logoData, configs]);

  // Build active positions: include staked, locked, OR burn/staking points
  const activePositions = useMemo(() => {
    if (!userInfoResults || !configs) return [];
    return configs
      .map((config, i) => {
        const r = userInfoResults[i];
        if (r?.status !== "success") return null;
        const [stakedAmount, totalUserBurn, stakingPoints, burnPoints, activeLockCount] =
          r.result as [bigint, bigint, bigint, bigint, bigint];
        // Skip deprecated moats
        if (config.status === "Deprecated") return null;
        // Show if any kind of participation exists
        if (
          stakedAmount === 0n &&
          activeLockCount === 0n &&
          stakingPoints === 0n &&
          burnPoints === 0n &&
          totalUserBurn === 0n
        ) return null;
        return { config, stakedAmount, totalUserBurn, stakingPoints, burnPoints, activeLockCount };
      })
      .filter(Boolean) as Array<{
        config: NonNullable<typeof configs>[0];
        stakedAmount: bigint;
        totalUserBurn: bigint;
        stakingPoints: bigint;
        burnPoints: bigint;
        activeLockCount: bigint;
      }>;
  }, [userInfoResults, configs]);

  // ── Step 2: batch getUserLock for all active locks ─────────────────────────
  const lockContracts = useMemo(() => {
    if (!address) return [];
    const calls: Array<{
      address: `0x${string}`;
      abi: typeof MOAT_V3_ABI;
      functionName: "getUserLock";
      args: [`0x${string}`, bigint];
    }> = [];
    activePositions.forEach((pos) => {
      const count = Number(pos.activeLockCount);
      for (let i = 0; i < count; i++) {
        calls.push({
          address: pos.config.contractAddress as `0x${string}`,
          abi: MOAT_V3_ABI,
          functionName: "getUserLock" as const,
          args: [address as `0x${string}`, BigInt(i)],
        });
      }
    });
    return calls;
  }, [activePositions, address]);

  const { data: lockResults } = useReadContracts({
    contracts: lockContracts,
    query: { enabled: lockContracts.length > 0 },
  });

  const lockedMap = useMemo((): Record<string, bigint> => {
    const m: Record<string, bigint> = {};
    let idx = 0;
    activePositions.forEach((pos) => {
      const count = Number(pos.activeLockCount);
      let total = 0n;
      for (let i = 0; i < count; i++) {
        const r = lockResults?.[idx];
        if (r?.status === "success") {
          const [amount, , , , , active] = r.result as [bigint, bigint, bigint, bigint, bigint, boolean];
          if (active) total += amount;
        }
        idx++;
      }
      m[pos.config.contractAddress.toLowerCase()] = total;
    });
    return m;
  }, [lockResults, activePositions]);

  // ── Step 3: staking token + decimals for token amounts ────────────────────
  const stakingTokenContracts = useMemo(() => {
    return activePositions.map((pos) => ({
      address: pos.config.contractAddress as `0x${string}`,
      abi: MOAT_V3_ABI,
      functionName: "stakingToken" as const,
    }));
  }, [activePositions]);

  const { data: stakingTokenResults } = useReadContracts({
    contracts: stakingTokenContracts,
    query: { enabled: stakingTokenContracts.length > 0 },
  });

  const positionStakingTokens = useMemo(() => {
    return activePositions.map((_, i) => {
      const r = stakingTokenResults?.[i];
      return r?.status === "success" ? (r.result as string) : "";
    });
  }, [stakingTokenResults, activePositions]);

  const uniqueStakingTokens = useMemo(
    () => [...new Set(positionStakingTokens.filter(Boolean))],
    [positionStakingTokens]
  );

  const { data: decimalsData } = useReadContracts({
    contracts: uniqueStakingTokens.map((addr) => ({
      address: addr as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals" as const,
    })),
    query: { enabled: uniqueStakingTokens.length > 0 },
  });

  const decimalsMap = useMemo((): Record<string, number> => {
    const m: Record<string, number> = {};
    uniqueStakingTokens.forEach((addr, i) => {
      const r = decimalsData?.[i];
      m[addr.toLowerCase()] = r?.status === "success" ? Number(r.result) : 18;
    });
    return m;
  }, [uniqueStakingTokens, decimalsData]);

  const allLlamaIds = useMemo(() => {
    if (!configs) return [];
    const ids = new Set<string>();
    for (const c of configs) {
      for (const t of c.rewardTokens) {
        if (t.enabled && t.tokenAddress && c.network) {
          ids.add(getLlamaId(c.network, t.tokenAddress));
        }
      }
    }
    positionStakingTokens.forEach((addr, i) => {
      const net = activePositions[i]?.config.network;
      if (addr && net) ids.add(getLlamaId(net, addr));
    });
    return [...ids];
  }, [configs, positionStakingTokens, activePositions]);

  const { data: priceMap } = useTokenPrices(allLlamaIds);
  const { data: dexInfoMap } = useDexscreenerInfo(uniqueStakingTokens);
  const dailyEstimates = useDailyRewardEstimates(configs);

  const getPositionValueUSD = (pos: typeof activePositions[0], idx: number): number => {
    const tokenAddr = positionStakingTokens[idx];
    if (!tokenAddr) return 0;
    const dec = decimalsMap[tokenAddr.toLowerCase()] ?? 18;
    const price = dexInfoMap?.[tokenAddr.toLowerCase()]?.price ?? 0;
    if (price === 0) return 0;
    const locked = lockedMap[pos.config.contractAddress.toLowerCase()] ?? 0n;
    return parseFloat(formatUnits(pos.stakedAmount + locked + pos.totalUserBurn, dec)) * price;
  };

  const getDailyRewardUSD = (pos: typeof activePositions[0]): number => {
    const moatLower = pos.config.contractAddress.toLowerCase();
    return pos.config.rewardTokens
      .filter((t) => t.enabled && t.tokenAddress && pos.config.network)
      .reduce((sum, t) => {
        const id = getLlamaId(pos.config.network, t.tokenAddress);
        const price =
          priceMap?.[id] ?? dexInfoMap?.[t.tokenAddress.toLowerCase()]?.price ?? 0;
        if (price === 0) return sum;
        const est = dailyEstimates[`${moatLower}_${t.tokenAddress.toLowerCase()}`] ?? 0;
        const freqH = t.frequencyHours ?? 24;
        const distsPerDay = freqH > 0 ? 24 / freqH : 1;
        const dailyAmt = t.tokenAmount > 0 ? t.tokenAmount * distsPerDay : est;
        return sum + dailyAmt * price;
      }, 0);
  };

  // ── Pending rewards per active position ──────────────────────────────────
  const pendingRewardsContracts = useMemo(() => {
    if (!address) return [];
    return activePositions.map((pos) => ({
      address: pos.config.contractAddress as `0x${string}`,
      abi: MOAT_V3_ABI,
      functionName: "getAllPendingRewards" as const,
      args: [address as `0x${string}`],
    }));
  }, [activePositions, address]);

  const { data: pendingRewardsResults } = useReadContracts({
    contracts: pendingRewardsContracts,
    query: { enabled: pendingRewardsContracts.length > 0 },
  });

  const hasRewardsMap = useMemo((): Record<string, boolean> => {
    const m: Record<string, boolean> = {};
    activePositions.forEach((pos, i) => {
      const r = pendingRewardsResults?.[i];
      if (r?.status === "success") {
        const [, amounts] = r.result as [readonly string[], readonly bigint[]];
        m[pos.config.contractAddress.toLowerCase()] = amounts.some((a) => a > 0n);
      } else {
        m[pos.config.contractAddress.toLowerCase()] = false;
      }
    });
    return m;
  }, [pendingRewardsResults, activePositions]);

  const totalPortfolioValueUSD = activePositions.reduce((sum, pos, i) => sum + getPositionValueUSD(pos, i), 0);
  const totalDailyUSD = activePositions.reduce((sum, pos) => sum + getDailyRewardUSD(pos), 0);
  const isPositionsLoading = configsLoading || (userInfoContracts.length > 0 && infoLoading);

  // ── Step 5: fetch per-moat MAPS points from the API ──────────────────────
  const moatPointsResults = useQueries({
    queries: activePositions.map((pos) => ({
      queryKey: ["moats", "points", "v2", "user", address, pos.config.contractAddress],
      queryFn: () => moatsApi.getUserMoatPointsV2(address!, pos.config.contractAddress),
      enabled: !!address,
      staleTime: 60_000,
    })),
  });

  const moatPointsMap = useMemo((): Record<string, number> => {
    const m: Record<string, number> = {};
    activePositions.forEach((pos, i) => {
      const result = moatPointsResults[i];
      if (result?.data?.points != null) {
        m[pos.config.contractAddress.toLowerCase()] = result.data.points;
      }
    });
    return m;
  }, [moatPointsResults, activePositions]);

  // Transaction history: only this wallet's own actions
  const ownTransactions = useMemo(() => {
    if (!userEvents || !address) return [];
    const lowerAddr = address.toLowerCase();
    const userActionTypes = new Set(["Staked", "Withdrawn", "Locked", "LockExited", "EarlyExit", "Burned", "RewardClaimed"]);
    return userEvents.filter(
      (ev) =>
        userActionTypes.has(ev.eventType) &&
        ev.args?.user?.toLowerCase() === lowerAddr
    );
  }, [userEvents, address]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-28 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">Portfolio</h1>
          <p className="text-muted-foreground">
            {isConnected && address
              ? `Positions for ${formatAddress(address)}`
              : "Connect your wallet to view your positions"}
          </p>
        </motion.div>

        {!isConnected ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-border bg-card/30 p-16 text-center"
            data-testid="wallet-connect-prompt"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Wallet size={28} className="text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Connect Your Wallet</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Connect your wallet to view your Moats positions and MAPS score.
            </p>
            <w3m-connect-button />
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Stats row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                data-testid="stat-maps-score"
                className="rounded-2xl border border-border bg-card/30 p-6 flex items-center gap-4"
              >
                <div className="p-3 rounded-xl bg-violet-400/10 shrink-0">
                  <Award className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <p className="text-3xl font-bold tabular-nums">
                    {scoreLoading ? "..." : mapsScore?.points != null ? mapsScore.points.toLocaleString() : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">MAPS Score</p>
                  {mapsScore?.rank && (
                    <p className="text-xs text-primary mt-0.5">Rank #{mapsScore.rank}</p>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                data-testid="stat-active-positions"
                className="rounded-2xl border border-border bg-card/30 p-6 flex items-center gap-4"
              >
                <div className="p-3 rounded-xl bg-cyan-400/10 shrink-0">
                  <TrendingUp className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-3xl font-bold tabular-nums">
                    {isPositionsLoading ? "..." : activePositions.length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active Positions</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                data-testid="stat-total-moats"
                className="rounded-2xl border border-border bg-card/30 p-6 flex items-center gap-4"
              >
                <div className="p-3 rounded-xl bg-emerald-400/10 shrink-0">
                  <Lock className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-3xl font-bold tabular-nums">
                    {configsLoading ? "..." : (configs?.length || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Available Moats</p>
                </div>
              </motion.div>

              {totalPortfolioValueUSD > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  data-testid="stat-portfolio-value-usd"
                  className="rounded-2xl border border-primary/20 bg-primary/5 p-6 flex items-center gap-4"
                >
                  <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold tabular-nums text-primary">
                      {formatUSD(totalPortfolioValueUSD)}
                    </p>
                    <p className="text-sm text-muted-foreground">Portfolio Value</p>
                  </div>
                </motion.div>
              )}

              {totalDailyUSD > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  data-testid="stat-daily-rewards-usd"
                  className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 flex items-center gap-4"
                >
                  <div className="p-3 rounded-xl bg-emerald-400/10 shrink-0">
                    <DollarSign className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold tabular-nums text-emerald-400">
                      {formatUSD(totalDailyUSD)}
                    </p>
                    <p className="text-sm text-muted-foreground">Est. Daily Rewards</p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* No MAPS score notice */}
            {!scoreLoading && !mapsScore && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-400">No MAPS Score Found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your wallet hasn't earned MAPS points yet. Stake, lock, or burn tokens in a Moat to start earning.
                  </p>
                </div>
              </div>
            )}

            {/* Active Positions */}
            <div>
              <h2 className="text-xl font-bold mb-4">My Positions</h2>
              {isPositionsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-24 rounded-2xl skeleton-shimmer border border-border" />
                  ))}
                </div>
              ) : activePositions.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card/30 p-10 text-center text-muted-foreground">
                  <p className="text-sm">No active positions found for this wallet.</p>
                  <p className="text-xs mt-1">Stake, lock, or burn tokens in a Moat to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...activePositions.keys()]
                    .sort((a, b) => {
                      const ptsA = moatPointsMap[activePositions[a].config.contractAddress.toLowerCase()] ?? 0;
                      const ptsB = moatPointsMap[activePositions[b].config.contractAddress.toLowerCase()] ?? 0;
                      return ptsB - ptsA;
                    })
                    .map((i) => {
                    const pos = activePositions[i];
                    const meta = getMoatMeta(pos.config.contractAddress);
                    const tokenAddr = positionStakingTokens[i];
                    const dec = decimalsMap[tokenAddr?.toLowerCase()] ?? 18;
                    const locked = lockedMap[pos.config.contractAddress.toLowerCase()] ?? 0n;
                    const posVal = getPositionValueUSD(pos, i);
                    const dailyUSD = getDailyRewardUSD(pos);
                    const mapsPoints = moatPointsMap[pos.config.contractAddress.toLowerCase()] ?? 0;
                    const logoUrl = logoMap[pos.config.contractAddress.toLowerCase()];
                    const hasRewards = hasRewardsMap[pos.config.contractAddress.toLowerCase()];

                    return (
                      <motion.div
                        key={pos.config.contractAddress}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="rounded-2xl border border-border bg-card/30 p-5"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Logo */}
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={meta.name}
                                className="w-9 h-9 rounded-xl object-cover shrink-0 border border-border/30"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                                {meta.tokenSymbol.slice(0, 2)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <Link
                                href={`/moat/${pos.config.contractAddress}`}
                                className="font-semibold text-foreground hover:text-primary transition-colors text-sm"
                              >
                                {meta.name}
                              </Link>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {meta.protocol} · {pos.config.status} · {pos.config.network}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {hasRewards && (
                              <Link
                                href={`/moat/${pos.config.contractAddress}`}
                                data-testid={`badge-rewards-pending-${pos.config.contractAddress}`}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/15 transition-colors"
                                title="You have unclaimed rewards"
                              >
                                <Gift size={12} />
                                <span className="hidden sm:inline">Rewards Pending</span>
                              </Link>
                            )}
                            <Link
                              href={`/moat/${pos.config.contractAddress}`}
                              className="px-4 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                            >
                              Manage
                            </Link>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-x-6 gap-y-3 mt-4">
                          {pos.stakedAmount > 0n && (
                            <div className="flex items-center gap-2">
                              <ArrowUpRight size={14} className="text-emerald-400" />
                              <div>
                                <p className="text-sm font-bold">{formatTokenAmount(pos.stakedAmount, dec)}</p>
                                <p className="text-xs text-muted-foreground">Staked</p>
                              </div>
                            </div>
                          )}
                          {locked > 0n && (
                            <div className="flex items-center gap-2">
                              <Lock size={14} className="text-cyan-400" />
                              <div>
                                <p className="text-sm font-bold">{formatTokenAmount(locked, dec)}</p>
                                <p className="text-xs text-muted-foreground">Locked</p>
                              </div>
                            </div>
                          )}
                          {pos.activeLockCount > 0n && locked === 0n && (
                            <div className="flex items-center gap-2">
                              <Lock size={14} className="text-cyan-400" />
                              <div>
                                <p className="text-sm font-bold">{Number(pos.activeLockCount)}</p>
                                <p className="text-xs text-muted-foreground">Active Locks</p>
                              </div>
                            </div>
                          )}
                          {pos.totalUserBurn > 0n && (
                            <div className="flex items-center gap-2">
                              <Flame size={14} className="text-rose-400" />
                              <div>
                                <p className="text-sm font-bold">{formatTokenAmount(pos.totalUserBurn, dec)}</p>
                                <p className="text-xs text-muted-foreground">Burned</p>
                              </div>
                            </div>
                          )}
                          {mapsPoints > 0 && (
                            <div className="flex items-center gap-2">
                              <Award size={14} className="text-violet-400" />
                              <div>
                                <p className="text-sm font-bold text-violet-400">
                                  {formatPoints(mapsPoints)}
                                </p>
                                <p className="text-xs text-muted-foreground">Moat Points</p>
                              </div>
                            </div>
                          )}
                          {posVal > 0 && (
                            <div className="flex items-center gap-2">
                              <DollarSign size={14} className="text-primary" />
                              <div>
                                <p className="text-sm font-bold text-primary">{formatUSD(posVal)}</p>
                                <p className="text-xs text-muted-foreground">Position Value</p>
                              </div>
                            </div>
                          )}
                          {dailyUSD > 0 && (
                            <div className="flex items-center gap-2">
                              <DollarSign size={14} className="text-emerald-400" />
                              <div>
                                <p className="text-sm font-bold text-emerald-400">{formatUSD(dailyUSD)}/day</p>
                                <p className="text-xs text-muted-foreground">Est. Rewards</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Transaction History — only this wallet's own transactions */}
            {!eventsLoading && (
              <div>
                <h2 className="text-xl font-bold mb-4">Transaction History</h2>
                {ownTransactions.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-card/30 p-8 text-center text-muted-foreground text-sm">
                    No personal transactions found.
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-card/30 divide-y divide-border/50 overflow-hidden">
                    {ownTransactions.slice(0, 20).map((ev, i) => (
                      <motion.div
                        key={ev._id || i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="px-5 py-3 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`text-sm font-semibold shrink-0 ${getEventTypeColor(ev.eventType)}`}>
                            {getEventTypeLabel(ev.eventType)}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {getMoatMeta(ev.contractAddress).name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs text-muted-foreground">{timeAgo(new Date(ev.timestamp).getTime())}</span>
                          <a
                            href={`${getExplorerUrl(ev.network)}/tx/${ev.transactionHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary/60 hover:text-primary transition-colors"
                          >
                            <ArrowDownRight size={12} />
                            {ev.transactionHash.slice(0, 8)}…
                          </a>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

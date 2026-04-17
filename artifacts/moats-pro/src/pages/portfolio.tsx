import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, Award, AlertCircle, ArrowDownRight, ArrowUpRight, Lock, DollarSign } from "lucide-react";
import { useMapsScore, useAllMoatConfigs, useUserEvents } from "@/hooks/use-moats-api";
import { useTokenPrices, getLlamaId } from "@/hooks/use-token-prices";
import { MOAT_V3_ABI, ERC20_ABI } from "@/lib/moat-abi";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { formatAddress, getEventTypeLabel, getEventTypeColor, getExplorerUrl, timeAgo, formatUSD, getMoatMeta } from "@/lib/moat-metadata";
import { Link } from "wouter";
import type { MoatEvent } from "@/lib/moats-api";

function derivePositions(events: MoatEvent[]) {
  const moatMap: Record<
    string,
    { contractAddress: string; network: string; staked: bigint; locked: bigint; claimed: bigint; lastActivity: string }
  > = {};

  for (const ev of events) {
    const key = ev.contractAddress.toLowerCase();
    if (!moatMap[key]) {
      moatMap[key] = {
        contractAddress: ev.contractAddress,
        network: ev.network,
        staked: 0n,
        locked: 0n,
        claimed: 0n,
        lastActivity: ev.timestamp,
      };
    }
    const entry = moatMap[key];
    const amt = ev.args.amount ? BigInt(ev.args.amount) : 0n;
    if (ev.timestamp > entry.lastActivity) entry.lastActivity = ev.timestamp;

    if (ev.eventType === "Staked") entry.staked += amt;
    if (ev.eventType === "Withdrawn") entry.staked -= amt < entry.staked ? amt : entry.staked;
    if (ev.eventType === "Locked") entry.locked += amt;
    if (ev.eventType === "LockExited" || ev.eventType === "EarlyExit") entry.locked -= amt < entry.locked ? amt : entry.locked;
    if (ev.eventType === "RewardClaimed") entry.claimed += amt;
  }

  return Object.values(moatMap).filter(
    (p) => p.staked > 0n || p.locked > 0n
  );
}

function formatTokens(raw: bigint): string {
  const val = Number(raw) / 1e18;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toFixed(2);
}

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const { data: mapsScore, isLoading: scoreLoading } = useMapsScore(address);
  const { data: configs, isLoading: configsLoading } = useAllMoatConfigs();
  const { data: userEvents, isLoading: eventsLoading } = useUserEvents(address);

  const positions = userEvents ? derivePositions(userEvents) : [];

  const enrichedPositions = positions.map((pos) => {
    const config = configs?.find(
      (c) => c.contractAddress.toLowerCase() === pos.contractAddress.toLowerCase()
    );
    return { ...pos, config };
  });

  const stakingTokenContracts = useMemo(() => {
    return positions.map((pos) => ({
      address: pos.contractAddress as `0x${string}`,
      abi: MOAT_V3_ABI,
      functionName: "stakingToken" as const,
    }));
  }, [positions]);

  const { data: stakingTokenResults } = useReadContracts({
    contracts: stakingTokenContracts,
    query: { enabled: stakingTokenContracts.length > 0 },
  });

  const positionStakingTokens = useMemo(() => {
    return positions.map((_, i) => {
      const r = stakingTokenResults?.[i];
      return r?.status === "success" ? (r.result as string) : "";
    });
  }, [stakingTokenResults, positions]);

  const uniquePosStakingTokens = useMemo(
    () => [...new Set(positionStakingTokens.filter(Boolean))],
    [positionStakingTokens]
  );

  const { data: posDecimalsData } = useReadContracts({
    contracts: uniquePosStakingTokens.map((addr) => ({
      address: addr as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals" as const,
    })),
    query: { enabled: uniquePosStakingTokens.length > 0 },
  });

  const posDecimalsMap = useMemo((): Record<string, number> => {
    const m: Record<string, number> = {};
    uniquePosStakingTokens.forEach((addr, i) => {
      const r = posDecimalsData?.[i];
      m[addr.toLowerCase()] = r?.status === "success" ? Number(r.result) : 18;
    });
    return m;
  }, [uniquePosStakingTokens, posDecimalsData]);

  const allLlamaIds = useMemo(() => {
    if (!configs) return [];
    const ids = new Set<string>();
    for (const c of configs) {
      for (const t of c.rewardTokens) {
        if (t.enabled && t.tokenAddress) {
          ids.add(getLlamaId(c.network, t.tokenAddress));
        }
      }
    }
    positionStakingTokens.forEach((addr, i) => {
      if (addr && positions[i]) ids.add(getLlamaId(positions[i].network, addr));
    });
    return [...ids];
  }, [configs, positionStakingTokens, positions]);

  const { data: priceMap } = useTokenPrices(allLlamaIds);

  const getDailyRewardUSD = (pos: (typeof enrichedPositions)[0]): number => {
    if (!pos.config || !priceMap) return 0;
    return pos.config.rewardTokens
      .filter((t) => t.enabled && t.tokenAddress)
      .reduce((sum, t) => {
        const id = getLlamaId(pos.config!.network, t.tokenAddress);
        return sum + t.tokenAmount * (priceMap[id] ?? 0);
      }, 0);
  };

  const totalDailyUSD = enrichedPositions.reduce((sum, pos) => sum + getDailyRewardUSD(pos), 0);

  const getPositionValueUSD = (pos: (typeof positions)[0], idx: number): number => {
    const tokenAddr = positionStakingTokens[idx];
    if (!tokenAddr || !priceMap) return 0;
    const dec = posDecimalsMap[tokenAddr.toLowerCase()] ?? 18;
    const llamaId = getLlamaId(pos.network, tokenAddr);
    const price = priceMap[llamaId] ?? 0;
    if (price === 0) return 0;
    const total = pos.staked + pos.locked;
    return parseFloat(formatUnits(total, dec)) * price;
  };

  const totalPortfolioValueUSD = positions.reduce(
    (sum, pos, i) => sum + getPositionValueUSD(pos, i),
    0
  );

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
            <w3m-button />
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
                    {eventsLoading ? "..." : positions.length}
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
                    Your wallet hasn't earned MAPS points yet. Stake or lock tokens in a Moat below
                    to start earning points and appear on the leaderboard.
                  </p>
                </div>
              </div>
            )}

            {/* Active Positions */}
            <div>
              <h2 className="text-xl font-bold mb-4">My Positions</h2>
              {eventsLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-24 rounded-2xl bg-card/50 animate-pulse border border-border" />
                  ))}
                </div>
              ) : enrichedPositions.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card/30 p-10 text-center text-muted-foreground">
                  <p className="text-sm">No active positions found for this wallet.</p>
                  <p className="text-xs mt-1">Stake or lock tokens in a Moat below to get started.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {enrichedPositions.map((pos, i) => (
                    <motion.div
                      key={pos.contractAddress}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-2xl border border-border bg-card/30 p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <Link
                            href={`/moat/${pos.contractAddress}`}
                            className="font-semibold text-foreground hover:text-primary transition-colors text-sm"
                          >
                            {getMoatMeta(pos.contractAddress).name}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {getMoatMeta(pos.contractAddress).protocol} · {pos.config?.status ?? pos.network} · Last: {timeAgo(new Date(pos.lastActivity).getTime())}
                          </p>
                        </div>
                        <Link
                          href={`/moat/${pos.contractAddress}`}
                          className="shrink-0 px-4 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                        >
                          Manage
                        </Link>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                        {pos.staked > 0n && (
                          <div className="flex items-center gap-2">
                            <ArrowUpRight size={14} className="text-emerald-400" />
                            <div>
                              <p className="text-sm font-bold">{formatTokens(pos.staked)}</p>
                              <p className="text-xs text-muted-foreground">Staked</p>
                            </div>
                          </div>
                        )}
                        {pos.locked > 0n && (
                          <div className="flex items-center gap-2">
                            <Lock size={14} className="text-cyan-400" />
                            <div>
                              <p className="text-sm font-bold">{formatTokens(pos.locked)}</p>
                              <p className="text-xs text-muted-foreground">Locked</p>
                            </div>
                          </div>
                        )}
                        {(() => {
                          const posVal = getPositionValueUSD(pos, i);
                          return posVal > 0 ? (
                            <div className="flex items-center gap-2">
                              <DollarSign size={14} className="text-primary" />
                              <div>
                                <p className="text-sm font-bold text-primary">{formatUSD(posVal)}</p>
                                <p className="text-xs text-muted-foreground">Position Value</p>
                              </div>
                            </div>
                          ) : null;
                        })()}
                        {(() => {
                          const dailyUSD = getDailyRewardUSD(pos);
                          return dailyUSD > 0 ? (
                            <div className="flex items-center gap-2">
                              <DollarSign size={14} className="text-emerald-400" />
                              <div>
                                <p className="text-sm font-bold text-emerald-400">{formatUSD(dailyUSD)}/day</p>
                                <p className="text-xs text-muted-foreground">Est. Rewards</p>
                              </div>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Transaction History */}
            {userEvents && userEvents.length > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4">Transaction History</h2>
                <div className="rounded-2xl border border-border bg-card/30 divide-y divide-border/50 overflow-hidden">
                  {userEvents.slice(0, 10).map((ev, i) => (
                    <motion.div
                      key={ev._id || i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="px-5 py-3 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-sm font-semibold shrink-0 ${getEventTypeColor(ev.eventType)}`}>
                          {getEventTypeLabel(ev.eventType)}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono truncate">
                          {formatAddress(ev.contractAddress)}
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
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

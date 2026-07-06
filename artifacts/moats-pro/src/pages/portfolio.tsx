import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { useAccount, useReadContracts } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { formatUnits } from "viem";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, Award, AlertCircle, ArrowDownRight, Lock, DollarSign, ArrowUpRight, Flame, Gift, Zap, Sparkles, ArrowUpDown, ArrowRight, Activity } from "lucide-react";
import btcbLogo from "@assets/logobtc_1777735570322.png";

const USDC_LOGO_URL =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/assets/0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E/logo.png";
const WAVAX_LOGO_URL =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png";

const NETWORK_TO_CHAIN_ID: Record<string, number> = {
  avax: 43114, avalanche: 43114,
  ethereum: 1,
  base: 8453,
  optimism: 10,
  arbitrum: 42161,
  polygon: 137,
  bsc: 56,
  sonic: 146,
};
function llamaIconUrl(network: string, address: string): string {
  const chainId = NETWORK_TO_CHAIN_ID[network.toLowerCase()] ?? 43114;
  return `https://token-icons.llamao.fi/icons/tokens/${chainId}/${address.toLowerCase()}?h=64&w=64`;
}
const USDC_ADDR = "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e";
const WAVAX_ADDR = "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7";
const BTCB_ADDR = "0x152b9d0fdc40c096757f570a51e494bd4b943e50";
import { useMapsScore, useAllMoatConfigs, useUserEvents, useSwapPoints } from "@/hooks/use-moats-api";
import { useTokenPrices, getLlamaId } from "@/hooks/use-token-prices";
import { useDexscreenerInfo } from "@/hooks/use-dexscreener";
import { useDailyRewardEstimates } from "@/hooks/use-daily-reward-estimates";
import { MOAT_V3_ABI, ERC20_ABI, MOAT_LOGO_ABI } from "@/lib/moat-abi";
import { moatsApi } from "@/lib/moats-api";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { formatAddress, formatPoints, getEventTypeLabel, getEventTypeColor, getExplorerUrl, timeAgo, formatUSD, getMoatMeta, MOAT_METADATA } from "@/lib/moat-metadata";
import { Link } from "wouter";
import { PortfolioReports } from "@/components/portfolio-reports";

function formatTokenAmount(raw: bigint, decimals: number = 18): string {
  const val = parseFloat(formatUnits(raw, decimals));
  if (val >= 1) {
    return val.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return val.toLocaleString("en-US", { maximumFractionDigits: 4 });
}


export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const [sortBy, setSortBy] = useState<"points" | "value" | "name">("points");
  const { data: mapsScore, isLoading: scoreLoading } = useMapsScore(address);
  const { data: configs, isLoading: configsLoading } = useAllMoatConfigs();
  const { data: userEvents, isLoading: eventsLoading } = useUserEvents(address);
  const { data: swapPoints, isLoading: swapPointsLoading } = useSwapPoints(address);

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
  // The contract's `activeLockCount` is the count of *currently active* locks,
  // but lock slots are stored sparsely — exiting a lock leaves its slot in
  // place with active=false. A user who has exited slot 2 and then opened a
  // new lock will have a fresh active lock at slot index ≥ activeLockCount, so
  // iterating 0..activeLockCount-1 silently undercounts. We probe a wider
  // range with allowFailure (out-of-range slots come back as failed entries).
  const lockProbePerPos = useMemo(
    () =>
      activePositions.map((pos) => {
        const c = Number(pos.activeLockCount);
        return c === 0 ? 0 : Math.max(c * 8, 128);
      }),
    [activePositions],
  );

  const lockContracts = useMemo(() => {
    if (!address) return [];
    const calls: Array<{
      address: `0x${string}`;
      abi: typeof MOAT_V3_ABI;
      functionName: "getUserLock";
      args: [`0x${string}`, bigint];
    }> = [];
    activePositions.forEach((pos, posIdx) => {
      const probe = lockProbePerPos[posIdx] ?? 0;
      for (let i = 0; i < probe; i++) {
        calls.push({
          address: pos.config.contractAddress as `0x${string}`,
          abi: MOAT_V3_ABI,
          functionName: "getUserLock" as const,
          args: [address as `0x${string}`, BigInt(i)],
        });
      }
    });
    return calls;
  }, [activePositions, address, lockProbePerPos]);

  const { data: lockResults } = useReadContracts({
    contracts: lockContracts,
    allowFailure: true,
    query: { enabled: lockContracts.length > 0 },
  });

  const lockedMap = useMemo((): Record<string, bigint> => {
    const m: Record<string, bigint> = {};
    let idx = 0;
    activePositions.forEach((pos, posIdx) => {
      const probe = lockProbePerPos[posIdx] ?? 0;
      let total = 0n;
      for (let i = 0; i < probe; i++) {
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
  }, [lockResults, activePositions, lockProbePerPos]);

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

  // Token-meta registry built from every moat's rewardTokens[]: address ->
  // { symbol, decimals, network }. Used to price/label RewardClaimed events.
  const rewardTokenMeta = useMemo(() => {
    const m = new Map<string, { symbol: string; decimals: number; network: string }>();
    if (!configs) return m;
    for (const c of configs) {
      for (const t of c.rewardTokens ?? []) {
        if (!t.tokenAddress || !t.symbol) continue;
        const k = t.tokenAddress.toLowerCase();
        if (!m.has(k)) {
          m.set(k, {
            symbol: t.symbol,
            decimals: Number(t.decimals) || 18,
            network: c.network || "avax",
          });
        }
      }
    }
    return m;
  }, [configs]);

  const rewardTokenAddrs = useMemo(() => [...rewardTokenMeta.keys()], [rewardTokenMeta]);
  const { data: rewardDexInfoMap } = useDexscreenerInfo(rewardTokenAddrs);

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

  // Aggregate this wallet's lifetime RewardClaimed events per token.
  // Buckets: USDC, WAVAX, BTC.b are always shown (even if zero). Every other
  // token (community asset) gets its own row, sorted by USD value desc.
  type ClaimedRow = {
    address: string;
    symbol: string;
    amount: number;
    usd: number;
    price: number;
    logoUrl?: string;
    network?: string;
    dexLogoUrl?: string;
  };
  const claimedAggregate = useMemo(() => {
    const featured: Record<"usdc" | "wavax" | "btcb", ClaimedRow> = {
      usdc: { address: USDC_ADDR, symbol: "USDC", amount: 0, usd: 0, price: 0, logoUrl: USDC_LOGO_URL },
      wavax: { address: WAVAX_ADDR, symbol: "WAVAX", amount: 0, usd: 0, price: 0, logoUrl: WAVAX_LOGO_URL },
      btcb: { address: BTCB_ADDR, symbol: "BTC.b", amount: 0, usd: 0, price: 0, logoUrl: btcbLogo },
    };
    const community = new Map<string, ClaimedRow>();
    if (!userEvents || !address) {
      return { featured, community: [] as ClaimedRow[], totalUsd: 0 };
    }
    const lowerAddr = address.toLowerCase();

    // Sum raw wei per token from this user's RewardClaimed events
    const perTokenWei = new Map<string, bigint>();
    for (const ev of userEvents) {
      if (ev.eventType !== "RewardClaimed") continue;
      if (ev.args?.user?.toLowerCase() !== lowerAddr) continue;
      const tok = (ev.args?.token as string | undefined)?.toLowerCase();
      const amt = ev.args?.amount as string | undefined;
      if (!tok || !amt) continue;
      try {
        perTokenWei.set(tok, (perTokenWei.get(tok) ?? 0n) + BigInt(amt));
      } catch {
        // skip malformed amount
      }
    }

    let totalUsd = 0;
    for (const [addr, wei] of perTokenWei.entries()) {
      const meta = rewardTokenMeta.get(addr);
      const decimals = meta?.decimals ?? 18;
      const symbol = meta?.symbol ?? addr.slice(0, 6);
      const network = meta?.network ?? "avax";
      const amount = Number(wei) / 10 ** decimals;
      if (amount <= 0) continue;

      const llamaPrice = priceMap?.[getLlamaId(network, addr).toLowerCase()] ?? 0;
      const dexPrice = rewardDexInfoMap?.[addr]?.price ?? dexInfoMap?.[addr]?.price ?? 0;
      let price = llamaPrice || dexPrice || 0;
      if (price === 0 && addr === USDC_ADDR) price = 1;
      const usd = amount * price;
      totalUsd += usd;

      if (addr === USDC_ADDR) {
        featured.usdc.amount += amount;
        featured.usdc.usd += usd;
        featured.usdc.price = price;
      } else if (addr === WAVAX_ADDR) {
        featured.wavax.amount += amount;
        featured.wavax.usd += usd;
        featured.wavax.price = price;
      } else if (addr === BTCB_ADDR) {
        featured.btcb.amount += amount;
        featured.btcb.usd += usd;
        featured.btcb.price = price;
      } else {
        // Priority: our system (MOAT_METADATA by tokenAddress) → DexScreener → DefiLlama
        const metaLogo = Object.values(MOAT_METADATA).find(
          m => m.tokenAddress?.toLowerCase() === addr
        )?.logoUrl ?? "";
        const dexImg = rewardDexInfoMap?.[addr]?.imageUrl ?? "";
        const logoUrl = metaLogo || dexImg || llamaIconUrl(network, addr);
        community.set(addr, { address: addr, symbol, amount, usd, price, logoUrl, dexLogoUrl: dexImg, network });
      }
    }

    const communitySorted = [...community.values()].sort((a, b) => b.usd - a.usd);
    return { featured, community: communitySorted, totalUsd };
  }, [userEvents, address, rewardTokenMeta, priceMap, rewardDexInfoMap, dexInfoMap]);

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
    <div className="min-h-screen bg-background text-foreground flex flex-col cyber-grid relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10 mix-blend-screen" />
      <div className="absolute top-1/2 right-1/4 w-[600px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none -z-10 mix-blend-screen" />
      <div className="absolute bottom-0 left-1/3 w-[700px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none -z-10 mix-blend-screen" />

      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-28 sm:pt-32 pb-24 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
          className="mb-10 relative"
        >
          {/* Decorative cyber line */}
          <div className="absolute -left-4 sm:-left-8 top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-primary/50 to-transparent" />
          
          <h1 className="text-4xl sm:text-5xl font-black mb-3 tracking-tight text-white drop-shadow-md flex items-center gap-4">
            Portfolio
            {isConnected && (
              <span className="inline-block px-3 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono uppercase tracking-widest text-primary/80 align-middle">
                Live
              </span>
            )}
          </h1>
          <p className="text-muted-foreground/80 font-mono text-sm tracking-wide">
            {isConnected && address
              ? <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                  Positions for <span className="text-white">{formatAddress(address)}</span>
                </span>
              : "Connect your wallet to view your positions"}
          </p>
        </motion.div>

        {!isConnected ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.25, 1, 0.5, 1] }}
            className="rounded-2xl border border-primary/20 bg-black/40 backdrop-blur-xl p-16 text-center shadow-[0_0_40px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(0,212,255,0.05)] relative overflow-hidden group"
            data-testid="wallet-connect-prompt"
          >
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,212,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,212,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="relative w-24 h-24 mb-8 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-primary/30 animate-[spin_10s_linear_infinite] border-t-primary" />
                <div className="absolute inset-2 rounded-full border border-primary/20 animate-[spin_15s_linear_infinite_reverse] border-r-primary" />
                <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse" />
                <Wallet size={32} className="text-primary relative z-10" />
              </div>
              <h2 className="text-2xl font-bold mb-4 tracking-wide text-white drop-shadow">Connect Your Wallet</h2>
              <p className="text-muted-foreground/80 mb-10 max-w-md mx-auto font-mono text-sm leading-relaxed">
                Connect your wallet to view your Moats positions and MAPS score.
              </p>
              <button
                onClick={() => open({ view: "Connect" })}
                data-testid="btn-connect-wallet-portfolio"
                className="btn-shimmer relative overflow-hidden group inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-primary/10 border border-primary/50 text-primary font-bold hover:bg-primary/20 hover:border-primary transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,255,0.3)] hover:-translate-y-1"
              >
                <Wallet size={18} className="group-hover:scale-110 transition-transform" />
                <span className="tracking-widest uppercase">Connect Wallet</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-10">
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                data-testid="stat-maps-score"
                className="rounded-xl border border-violet-500/20 bg-black/40 backdrop-blur-md p-5 flex flex-col justify-between relative overflow-hidden group hover:border-violet-500/40 transition-colors"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Award className="w-16 h-16 text-violet-400" />
                </div>
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
                
                <p className="text-[10px] font-mono text-violet-400/80 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)]" />
                  MAPS Score
                </p>
                <div>
                  <p className="text-3xl font-black tabular-nums text-white drop-shadow-md tracking-tight">
                    {scoreLoading ? "..." : mapsScore?.points != null ? mapsScore.points.toLocaleString() : "—"}
                  </p>
                  {mapsScore?.rank && (
                    <p className="text-xs text-violet-400 mt-1 font-mono uppercase tracking-wider">Rank #{mapsScore.rank}</p>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                data-testid="stat-active-positions"
                className="rounded-xl border border-cyan-500/20 bg-black/40 backdrop-blur-md p-5 flex flex-col justify-between relative overflow-hidden group hover:border-cyan-500/40 transition-colors"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <TrendingUp className="w-16 h-16 text-cyan-400" />
                </div>
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

                <p className="text-[10px] font-mono text-cyan-400/80 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                  Active Positions
                </p>
                <p className="text-3xl font-black tabular-nums text-white drop-shadow-md tracking-tight">
                  {isPositionsLoading ? "..." : activePositions.length}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                data-testid="stat-total-moats"
                className="rounded-xl border border-emerald-500/20 bg-black/40 backdrop-blur-md p-5 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/40 transition-colors"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Lock className="w-16 h-16 text-emerald-400" />
                </div>
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

                <p className="text-[10px] font-mono text-emerald-400/80 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  Available Moats
                </p>
                <p className="text-3xl font-black tabular-nums text-white drop-shadow-md tracking-tight">
                  {configsLoading ? "..." : (configs?.length || 0)}
                </p>
              </motion.div>

              {totalPortfolioValueUSD > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  data-testid="stat-portfolio-value-usd"
                  className="rounded-xl border border-primary/20 bg-black/40 backdrop-blur-md p-5 flex flex-col justify-between relative overflow-hidden group hover:border-primary/40 transition-colors"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <DollarSign className="w-16 h-16 text-primary" />
                  </div>
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

                  <p className="text-[10px] font-mono text-primary/80 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(0,212,255,0.8)] animate-pulse" />
                    Portfolio Value
                  </p>
                  <p className="text-3xl font-black tabular-nums text-white drop-shadow-[0_0_10px_rgba(0,212,255,0.3)] tracking-tight">
                    {formatUSD(totalPortfolioValueUSD)}
                  </p>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.18 }}
                data-testid="stat-swap-points"
                className="rounded-xl border border-amber-500/20 bg-black/40 backdrop-blur-md p-5 flex flex-col justify-between relative overflow-hidden group hover:border-amber-500/40 transition-colors"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Zap className="w-16 h-16 text-amber-400" />
                </div>
                <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

                <p className="text-[10px] font-mono text-amber-400/80 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                  Swap Points
                </p>
                <div>
                  <p className="text-3xl font-black tabular-nums text-white drop-shadow-md tracking-tight">
                    {swapPointsLoading
                      ? "..."
                      : Math.floor(swapPoints?.points ?? 0).toLocaleString()}
                  </p>
                  {!swapPointsLoading && (swapPoints?.swapCount ?? 0) > 0 && (
                    <p className="text-xs text-amber-400/80 mt-1 font-mono uppercase tracking-wider">
                      {swapPoints!.swapCount} swap{swapPoints!.swapCount === 1 ? "" : "s"}
                    </p>
                  )}
                </div>
              </motion.div>

              {totalDailyUSD > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  data-testid="stat-daily-rewards-usd"
                  className="rounded-xl border border-emerald-500/20 bg-black/40 backdrop-blur-md p-5 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-500/40 transition-colors"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <DollarSign className="w-16 h-16 text-emerald-400" />
                  </div>
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

                  <p className="text-[10px] font-mono text-emerald-400/80 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    Est. Daily Rewards
                  </p>
                  <p className="text-3xl font-black tabular-nums text-white drop-shadow-md tracking-tight">
                    {formatUSD(totalDailyUSD)}
                  </p>
                </motion.div>
              )}
            </div>

            {/* No MAPS score notice */}
            {!scoreLoading && !mapsScore && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 flex items-start gap-4 shadow-[0_0_15px_rgba(251,191,36,0.1)] relative overflow-hidden"
              >
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />
                <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-400 uppercase tracking-widest mb-1">No MAPS Score Found</p>
                  <p className="text-xs text-amber-100/70 font-mono tracking-wide leading-relaxed">
                    Your wallet hasn't earned MAPS points yet. Stake, lock, or burn tokens in a Moat to start earning.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Active Positions */}
            <div className="relative">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 relative z-10">
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                    <div className="p-1.5 rounded bg-primary/20 border border-primary/30">
                      <TrendingUp size={16} className="text-primary" />
                    </div>
                    My Positions
                  </h2>
                </div>
                {!isPositionsLoading && activePositions.length > 1 && (
                  <div role="group" aria-label="Sort positions" className="flex items-center gap-3 bg-black/40 backdrop-blur-sm p-1.5 rounded-xl border border-white/5 shadow-inner">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest pl-2">Sort</span>
                    <div className="flex gap-1">
                      {([
                        ["points", "Points"],
                        ["value", "Value"],
                        ["name", "Name"],
                      ] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setSortBy(key)}
                          data-testid={`sort-positions-${key}`}
                          aria-pressed={sortBy === key}
                          className={`px-4 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-widest transition-all ${
                            sortBy === key
                              ? "bg-primary/20 border border-primary/50 text-primary shadow-[0_0_10px_rgba(0,212,255,0.2)] font-bold"
                              : "bg-transparent border border-transparent text-muted-foreground hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isPositionsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-40 rounded-2xl bg-card/30 border border-border relative overflow-hidden">
                       <div className="absolute inset-0 skeleton-shimmer opacity-20" />
                    </div>
                  ))}
                </div>
              ) : activePositions.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-12 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[300px] cyber-grid">
                  <TrendingUp size={32} className="text-white/20 mb-4" />
                  <p className="text-lg font-bold text-white/80 mb-2 tracking-tight">NO ACTIVE POSITIONS</p>
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60 max-w-sm">Scan the markets and stake tokens in a Moat to establish a position.</p>
                </div>
              ) : (
                <div className="space-y-4 relative z-10">
                  {[...activePositions.keys()]
                    .sort((a, b) => {
                      if (sortBy === "value") {
                        return getPositionValueUSD(activePositions[b], b) - getPositionValueUSD(activePositions[a], a);
                      }
                      if (sortBy === "name") {
                        return getMoatMeta(activePositions[a].config.contractAddress).name
                          .localeCompare(getMoatMeta(activePositions[b].config.contractAddress).name);
                      }
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
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.005, y: -2 }}
                        transition={{ duration: 0.3 }}
                        className="rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl p-5 sm:p-6 hover:border-primary/40 transition-all duration-300 relative group overflow-hidden cyber-grid shadow-lg"
                      >
                        {/* Interactive hover glows */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
                          
                          {/* Left: Identity */}
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="relative shrink-0">
                              {logoUrl ? (
                                <img
                                  src={logoUrl}
                                  alt={meta.name}
                                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover border border-white/20 shadow-md group-hover:border-primary/50 transition-colors bg-black"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                              ) : (
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-black text-xl shrink-0 shadow-[inset_0_0_15px_rgba(0,212,255,0.1)] group-hover:border-primary/60 transition-colors">
                                  {meta.tokenSymbol.slice(0, 2)}
                                </div>
                              )}
                              <div className="absolute -inset-2 bg-primary/20 rounded-[1rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
                            </div>
                            <div className="min-w-0 py-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Link
                                  href={`/moat/${pos.config.contractAddress}`}
                                  className="font-black text-xl text-white hover:text-primary transition-colors tracking-tight drop-shadow-sm truncate"
                                >
                                  {meta.name}
                                </Link>
                                <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-[4px] border border-white/10 bg-white/5 text-muted-foreground shrink-0`}>
                                  {pos.config.network}
                                </span>
                              </div>
                              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest truncate">
                                {meta.protocol} <span className="mx-1 opacity-50">/</span> <span className="text-primary/70">{pos.config.status}</span>
                              </p>
                            </div>
                          </div>

                          {/* Center: Financials */}
                          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-1 px-2 sm:px-6 sm:border-x border-white/10 min-w-[200px]">
                            <div className="text-left sm:text-right">
                              <p className="text-[9px] font-mono text-muted-foreground/80 uppercase tracking-widest mb-1">Position Value</p>
                              <p className="text-2xl font-black text-white tabular-nums tracking-tight drop-shadow-sm">
                                {posVal > 0 ? formatUSD(posVal) : "—"}
                              </p>
                            </div>
                            {dailyUSD > 0 && (
                              <div className="text-right">
                                <p className="text-sm font-bold text-emerald-400 tabular-nums bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 inline-block shadow-[inset_0_0_8px_rgba(52,211,153,0.1)]">
                                  +{formatUSD(dailyUSD)}<span className="text-[10px] text-emerald-400/70 ml-1 uppercase">/day</span>
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 mt-2 sm:mt-0">
                            {hasRewards && (
                              <Link
                                href={`/moat/${pos.config.contractAddress}`}
                                data-testid={`badge-rewards-pending-${pos.config.contractAddress}`}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-all shadow-[0_0_15px_rgba(52,211,153,0.2)] animate-pulse hover:animate-none"
                                title="You have unclaimed rewards"
                              >
                                <Gift size={14} />
                                <span className="hidden sm:inline tracking-wide uppercase font-mono text-[10px]">Rewards Ready</span>
                              </Link>
                            )}
                            <Link
                              href={`/moat/${pos.config.contractAddress}`}
                              className="btn-shimmer relative overflow-hidden group inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary/20 border border-primary/50 text-primary font-bold hover:bg-primary/30 hover:border-primary transition-all shadow-[0_0_20px_rgba(0,212,255,0.15)]"
                            >
                              <span className="tracking-widest uppercase text-xs font-mono">Manage</span>
                              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                          </div>
                        </div>

                        {/* Metric Chips */}
                        <div className="flex flex-wrap items-center gap-2 mt-5 pt-5 border-t border-white/5">
                          {pos.stakedAmount > 0n && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/40 border border-emerald-500/20">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                              <span className="text-[10px] font-mono text-emerald-400/80 uppercase tracking-widest">Staked</span>
                              <span className="text-xs font-bold text-white tabular-nums ml-1">{formatTokenAmount(pos.stakedAmount, dec)}</span>
                            </div>
                          )}
                          {locked > 0n && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/40 border border-cyan-500/20">
                              <Lock size={10} className="text-cyan-400" />
                              <span className="text-[10px] font-mono text-cyan-400/80 uppercase tracking-widest">Locked</span>
                              <span className="text-xs font-bold text-white tabular-nums ml-1">{formatTokenAmount(locked, dec)}</span>
                            </div>
                          )}
                          {pos.activeLockCount > 0n && locked === 0n && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/40 border border-cyan-500/20">
                              <Lock size={10} className="text-cyan-400" />
                              <span className="text-[10px] font-mono text-cyan-400/80 uppercase tracking-widest">Locks</span>
                              <span className="text-xs font-bold text-white tabular-nums ml-1">{Number(pos.activeLockCount)}</span>
                            </div>
                          )}
                          {pos.totalUserBurn > 0n && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/40 border border-rose-500/20">
                              <Flame size={10} className="text-rose-400" />
                              <span className="text-[10px] font-mono text-rose-400/80 uppercase tracking-widest">Burned</span>
                              <span className="text-xs font-bold text-white tabular-nums ml-1">{formatTokenAmount(pos.totalUserBurn, dec)}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rewards Claimed */}
            <div className="relative pt-6">
              <div className="flex items-baseline justify-between mb-6 relative z-10">
                <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-3">
                  <div className="p-1.5 rounded bg-emerald-500/20 border border-emerald-500/30">
                    <Gift size={16} className="text-emerald-400" />
                  </div>
                  Rewards Claimed
                </h2>
                {claimedAggregate.totalUsd > 0 && (
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                    LIFETIME <span className="text-emerald-400 font-bold ml-1">{formatUSD(claimedAggregate.totalUsd)}</span>
                  </span>
                )}
              </div>

              {/* Featured tokens */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 relative z-10">
                {([
                  { key: "usdc", row: claimedAggregate.featured.usdc, label: "USDC" },
                  { key: "wavax", row: claimedAggregate.featured.wavax, label: "WAVAX" },
                  { key: "btcb", row: claimedAggregate.featured.btcb, label: "BTC.b" },
                ] as const).map(({ key, row, label }) => {
                  const dust = row.symbol === "BTC.b" ? 0.0001 : 0.01;
                  const amtStr =
                    row.amount === 0
                      ? "0"
                      : row.amount < dust
                      ? row.amount.toLocaleString("en-US", { maximumFractionDigits: 6 })
                      : row.amount.toLocaleString("en-US", { maximumFractionDigits: 4 });
                  return (
                    <motion.div
                      key={key}
                      whileHover={{ y: -4 }}
                      data-testid={`stat-claimed-${key}`}
                      className="rounded-xl border border-white/10 bg-black/50 backdrop-blur-md p-5 flex flex-col items-center sm:items-start text-center sm:text-left gap-4 relative overflow-hidden group shadow-lg"
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      
                      <div className="flex items-center gap-3 w-full justify-center sm:justify-start border-b border-white/5 pb-3">
                        {row.logoUrl ? (
                          <img
                            src={row.logoUrl}
                            alt={row.symbol}
                            className="w-7 h-7 rounded-full shadow-md"
                            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20" />
                        )}
                        <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest font-bold">{label}</p>
                      </div>
                      
                      <div className="w-full">
                        <p className="text-2xl font-black text-white tabular-nums drop-shadow-sm leading-none mb-2">{amtStr}</p>
                        {row.usd > 0 ? (
                          <p className="text-[11px] font-mono font-bold text-emerald-400 tabular-nums uppercase tracking-widest">{formatUSD(row.usd)} <span className="text-emerald-500/50">USD</span></p>
                        ) : (
                          <p className="text-[11px] font-mono text-muted-foreground/40 tabular-nums uppercase tracking-widest">—</p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Community tokens */}
              <div className="relative z-10">
                {claimedAggregate.community.length === 0 ? (
                  <div className="rounded-xl border border-white/5 bg-black/30 p-6 text-center text-muted-foreground/60 font-mono text-xs uppercase tracking-widest">
                    No community asset rewards claimed yet
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden shadow-lg">
                    <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-primary/70" />
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest font-bold">Community Assets</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                        {claimedAggregate.community.length} token{claimedAggregate.community.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {claimedAggregate.community.map((row) => {
                        const amtStr =
                          row.amount < 0.01
                            ? row.amount.toLocaleString("en-US", { maximumFractionDigits: 6 })
                            : row.amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
                        return (
                          <div
                            key={row.address}
                            data-testid={`row-claimed-${row.symbol.toLowerCase()}`}
                            className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-white/[0.03] transition-colors group"
                          >
                            <span className="text-xs font-bold text-white/90 group-hover:text-primary transition-colors tracking-wide">{row.symbol}</span>
                            <div className="flex items-center gap-6 shrink-0">
                              <span className="text-xs font-mono text-white tabular-nums tracking-wider">{amtStr}</span>
                              <span className="text-[11px] font-mono font-bold text-emerald-400 tabular-nums w-20 text-right">
                                {row.usd > 0 ? formatUSD(row.usd) : "—"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Reports & Analytics */}
            {!eventsLoading && ownTransactions.length > 0 && (
              <PortfolioReports
                address={address}
                mapsScore={mapsScore}
                totalPortfolioValueUSD={totalPortfolioValueUSD}
                swapPoints={swapPoints?.points}
                ownTransactions={ownTransactions}
                claimedAggregate={claimedAggregate}
                activePositionCount={activePositions.length}
              />
            )}

            {/* Transaction History */}
            {!eventsLoading && (
              <div className="relative pt-6">
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="p-1.5 rounded bg-white/5 border border-white/10">
                    <Activity size={16} className="text-white/60" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight text-white">Transaction History</h2>
                </div>

                {ownTransactions.length === 0 ? (
                  <div className="rounded-xl border border-white/5 bg-black/30 p-8 text-center text-muted-foreground/60 font-mono text-xs uppercase tracking-widest">
                    No personal transactions found.
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-md overflow-hidden shadow-lg relative z-10">
                    <div className="divide-y divide-white/5">
                      {ownTransactions.slice(0, 20).map((ev, i) => (
                        <motion.div
                          key={ev._id || i}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors group"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className="w-24 shrink-0 flex items-center">
                              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-current/20 ${
                                ev.eventType.includes('Lock') ? 'text-cyan-400 bg-cyan-400/10' :
                                ev.eventType.includes('Burn') ? 'text-rose-400 bg-rose-400/10' :
                                ev.eventType.includes('Stak') ? 'text-emerald-400 bg-emerald-400/10' :
                                ev.eventType.includes('Claim') ? 'text-primary bg-primary/10' :
                                'text-muted-foreground bg-white/5'
                              }`}>
                                {getEventTypeLabel(ev.eventType)}
                              </span>
                            </div>
                            <span className="text-xs font-medium text-white/80 truncate">
                              {getMoatMeta(ev.contractAddress).name}
                            </span>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 pl-14 sm:pl-0">
                            <span className="text-[10px] font-mono text-muted-foreground/60 tracking-widest">{timeAgo(new Date(ev.timestamp).getTime())}</span>
                            <a
                              href={`${getExplorerUrl(ev.network)}/tx/${ev.transactionHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[10px] font-mono text-primary/60 hover:text-primary transition-colors border border-primary/20 hover:border-primary/50 bg-primary/5 px-2 py-1 rounded"
                            >
                              TX:{ev.transactionHash.slice(0, 6)}
                              <ArrowUpRight size={10} />
                            </a>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    {ownTransactions.length > 20 && (
                      <div className="px-5 py-3 bg-white/[0.02] border-t border-white/5 flex items-center justify-between gap-2">
                        <span className="text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">Displaying 20 of {ownTransactions.length} operations</span>
                        <a
                          href={`${getExplorerUrl(ownTransactions[0].network)}/address/${address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[10px] font-mono text-white/50 hover:text-white transition-colors uppercase tracking-widest font-bold"
                        >
                          Launch Block Explorer
                          <ArrowRight size={10} />
                        </a>
                      </div>
                    )}
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

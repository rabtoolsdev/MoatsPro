import { useState, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useReadContracts, useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { Wallet, ArrowRight, Zap } from "lucide-react";
import { formatUnits } from "viem";
import { useAllMoatConfigs, useMapsLeaderboard, useEvents } from "@/hooks/use-moats-api";
import { useTokenPrices, getLlamaId } from "@/hooks/use-token-prices";
import { useDexscreenerPrices } from "@/hooks/use-dexscreener";
import { MOAT_V3_ABI, ERC20_ABI, MOAT_LOGO_ABI } from "@/lib/moat-abi";
import { getMoatMeta } from "@/lib/moat-metadata";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { MoatCard } from "@/components/moat-card";
import { StatsBar } from "@/components/stats-bar";
import { ActivityFeed } from "@/components/activity-feed";

const heroWords = ["Stake.", "Lock.", "Burn.", "Earn."];

export default function Home() {
  const [statusFilter, setStatusFilter] = useState<string>("Verified");
  const { isConnected, address } = useAccount();
  const { open } = useAppKit();
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
  const { data: configs, isLoading: configsLoading } = useAllMoatConfigs();
  const { data: leaderboard } = useMapsLeaderboard();
  const { data: eventsData } = useEvents();

  const moatOnchainContracts = useMemo(() => {
    if (!configs) return [];
    return configs.flatMap((c) => [
      { address: c.contractAddress as `0x${string}`, abi: MOAT_V3_ABI, functionName: "totalStaked" as const },
      { address: c.contractAddress as `0x${string}`, abi: MOAT_V3_ABI, functionName: "stakingToken" as const },
      { address: c.contractAddress as `0x${string}`, abi: MOAT_V3_ABI, functionName: "totalLocked" as const },
      { address: c.contractAddress as `0x${string}`, abi: MOAT_V3_ABI, functionName: "totalBurned" as const },
    ]);
  }, [configs]);

  const { data: moatOnchainData } = useReadContracts({
    contracts: moatOnchainContracts,
    query: { enabled: moatOnchainContracts.length > 0 },
  });

  const stakingTokenAddrs = useMemo(() => {
    if (!moatOnchainData || !configs) return [] as string[];
    return configs.map((_, i) => {
      const r = moatOnchainData[i * 4 + 1];
      return r?.status === "success" ? (r.result as string) : "";
    });
  }, [moatOnchainData, configs]);

  const uniqueStakingTokens = useMemo(
    () => [...new Set(stakingTokenAddrs.filter(Boolean))],
    [stakingTokenAddrs]
  );

  const { data: decimalsData } = useReadContracts({
    contracts: uniqueStakingTokens.map((addr) => ({
      address: addr as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals" as const,
    })),
    query: { enabled: uniqueStakingTokens.length > 0 },
  });

  const { data: totalSupplyData } = useReadContracts({
    contracts: uniqueStakingTokens.map((addr) => ({
      address: addr as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "totalSupply" as const,
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

  const totalSupplyMap = useMemo((): Record<string, bigint> => {
    const m: Record<string, bigint> = {};
    uniqueStakingTokens.forEach((addr, i) => {
      const r = totalSupplyData?.[i];
      if (r?.status === "success") m[addr.toLowerCase()] = r.result as unknown as bigint;
    });
    return m;
  }, [uniqueStakingTokens, totalSupplyData]);

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

  const allLlamaIds = useMemo(() => {
    if (!configs) return [];
    const ids = new Set<string>();
    for (const c of configs) {
      for (const t of c.rewardTokens) {
        if (t.enabled && t.tokenAddress) {
          ids.add(getLlamaId(c.network, t.tokenAddress));
        }
      }
      const meta = getMoatMeta(c.contractAddress);
      if (meta.tokenAddress && c.network) {
        ids.add(getLlamaId(c.network, meta.tokenAddress));
      }
    }
    stakingTokenAddrs.forEach((addr, i) => {
      if (addr && configs[i]?.network) ids.add(getLlamaId(configs[i].network, addr));
    });
    return [...ids];
  }, [configs, stakingTokenAddrs]);

  const { data: priceMap } = useTokenPrices(allLlamaIds);

  const allTokenAddrs = useMemo(() => {
    const addrs = new Set<string>();
    if (configs) {
      for (const c of configs) {
        const meta = getMoatMeta(c.contractAddress);
        if (meta.tokenAddress) addrs.add(meta.tokenAddress.toLowerCase());
      }
    }
    stakingTokenAddrs.forEach((addr) => { if (addr) addrs.add(addr.toLowerCase()); });
    return [...addrs];
  }, [configs, stakingTokenAddrs]);

  const { data: dexPriceMap } = useDexscreenerPrices(allTokenAddrs);

  const getTokenPrice = (network: string, tokenAddr: string): number => {
    const dex = dexPriceMap?.[tokenAddr.toLowerCase()];
    if (dex && dex > 0) return dex;
    return priceMap?.[getLlamaId(network, tokenAddr)] ?? 0;
  };

  const tvmMap = useMemo((): Record<string, number> => {
    if (!moatOnchainData || !configs) return {};
    const m: Record<string, number> = {};
    configs.forEach((c, i) => {
      const stakedResult = moatOnchainData[i * 4];
      const tokenResult = moatOnchainData[i * 4 + 1];
      const lockedResult = moatOnchainData[i * 4 + 2];
      const burnedResult = moatOnchainData[i * 4 + 3];
      if (stakedResult?.status !== "success" || tokenResult?.status !== "success") return;
      const totalStaked = stakedResult.result as bigint;
      const totalLocked = lockedResult?.status === "success" ? (lockedResult.result as bigint) : 0n;
      const totalBurned = burnedResult?.status === "success" ? (burnedResult.result as bigint) : 0n;
      const tokenAddr = (tokenResult.result as string).toLowerCase();
      const dec = decimalsMap[tokenAddr] ?? 18;
      const price = getTokenPrice(c.network, tokenAddr);
      if (price > 0) {
        m[c.contractAddress.toLowerCase()] =
          parseFloat(formatUnits(totalStaked + totalLocked + totalBurned, dec)) * price;
      }
    });
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moatOnchainData, configs, priceMap, dexPriceMap, decimalsMap]);

  const supplyPctMap = useMemo((): Record<string, number> => {
    if (!moatOnchainData || !configs) return {};
    const m: Record<string, number> = {};
    configs.forEach((c, i) => {
      const stakedResult = moatOnchainData[i * 4];
      const tokenResult = moatOnchainData[i * 4 + 1];
      const lockedResult = moatOnchainData[i * 4 + 2];
      const burnedResult = moatOnchainData[i * 4 + 3];
      if (stakedResult?.status !== "success" || tokenResult?.status !== "success") return;
      const totalStaked = stakedResult.result as bigint;
      const totalLocked = lockedResult?.status === "success" ? (lockedResult.result as bigint) : 0n;
      const totalBurned = burnedResult?.status === "success" ? (burnedResult.result as bigint) : 0n;
      const tokenAddr = (tokenResult.result as string).toLowerCase();
      const supply = totalSupplyMap[tokenAddr];
      if (supply && supply > 0n) {
        const pct = Number(((totalStaked + totalLocked + totalBurned) * 10000n) / supply) / 100;
        m[c.contractAddress.toLowerCase()] = pct;
      }
    });
    return m;
  }, [moatOnchainData, configs, totalSupplyMap]);

  const statusOptions = configs
    ? ["all", ...new Set(configs.map((c) => c.status))]
    : ["all"];

  const moatsWithMeta = (configs || []).map((config) => ({
    ...config,
    meta: getMoatMeta(config.contractAddress),
  }));

  const filteredMoats = (
    statusFilter === "all"
      ? moatsWithMeta
      : moatsWithMeta.filter((c) => c.status === statusFilter)
  ).sort((a, b) => {
    const tvmA = tvmMap[a.contractAddress.toLowerCase()] ?? 0;
    const tvmB = tvmMap[b.contractAddress.toLowerCase()] ?? 0;
    return tvmB - tvmA;
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        {/* Animated grid background */}
        <div className="absolute inset-0 bg-grid-animated opacity-60 pointer-events-none" />
        {/* Radial vignette over grid */}
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-background pointer-events-none" />

        {/* Floating orbs */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[380px] bg-primary/8 rounded-full blur-[140px] pointer-events-none float-slow" />
        <div className="absolute top-32 left-1/4 w-[280px] h-[280px] bg-cyan-500/6 rounded-full blur-[90px] pointer-events-none float-slow-alt" />
        <div className="absolute top-20 right-1/5 w-[200px] h-[200px] bg-violet-500/5 rounded-full blur-[80px] pointer-events-none animate-float-alt" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-xs font-medium text-primary"
          >
            <Zap size={12} />
            Premium DeFi Liquidity — Powered by FortiFi
          </motion.div>

          {/* Staggered headline words */}
          <div className="text-5xl md:text-7xl font-bold tracking-tight mb-4 flex flex-wrap justify-center gap-x-4">
            {heroWords.map((word, i) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.1 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className={i < heroWords.length - 1 ? "text-foreground" : "text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400"}
              >
                {word}
              </motion.span>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Stake, lock, burn and earn real yield from the most powerful DeFi liquidity positions. Premium analytics. On-chain forever.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            {isConnected && address ? (
              <button
                onClick={() => open({ view: "Account" })}
                className="flex items-center gap-2 px-6 py-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-all duration-200 text-sm font-medium hover:shadow-[0_0_20px_rgba(0,212,255,0.2)]"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 live-dot" />
                <Wallet size={14} className="text-primary shrink-0" />
                <span className="font-mono text-foreground">{shortAddress}</span>
              </button>
            ) : (
              <button
                onClick={() => open({ view: "Connect" })}
                className="btn-shimmer px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all duration-200 hover:shadow-[0_0_24px_rgba(0,212,255,0.4)]"
              >
                Connect Wallet
              </button>
            )}
            <Link
              href="/leaderboard"
              data-testid="btn-leaderboard"
              className="group inline-flex items-center gap-2 px-8 py-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 text-foreground font-medium"
            >
              View Leaderboard
              <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Stats Bar ─────────────────────────────────────────────── */}
      <StatsBar moatConfigs={configs} leaderboard={leaderboard} />

      {/* ── Moats Grid ────────────────────────────────────────────── */}
      <section className="flex-1 px-4 py-16 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold" data-testid="section-moats">Active Moats</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {filteredMoats.length} active{" "}
              {filteredMoats.length === 1 ? "moat" : "moats"}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {statusOptions.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                data-testid={`filter-${status}`}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${
                  statusFilter === status
                    ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(0,212,255,0.3)]"
                    : "border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {configsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-72 rounded-2xl skeleton-shimmer border border-border"
              />
            ))}
          </div>
        ) : filteredMoats.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">No Moats found</p>
            <p className="text-sm mt-2">
              Check back soon or connect your wallet to explore positions
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredMoats.map((moat) => (
              <motion.div key={moat.contractAddress} variants={itemVariants}>
                <MoatCard
                  moat={moat}
                  tvlUSD={tvmMap[moat.contractAddress.toLowerCase()]}
                  supplyPct={supplyPctMap[moat.contractAddress.toLowerCase()]}
                  logoUrl={logoMap[moat.contractAddress.toLowerCase()]}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* ── Activity Feed ─────────────────────────────────────────── */}
      {eventsData && eventsData.results.length > 0 && (
        <section className="px-4 py-12 max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <div />
            <span className="text-sm text-muted-foreground">
              {eventsData.total.toLocaleString()} total events
            </span>
          </div>
          <ActivityFeed
            events={eventsData.results.slice(0, 12)}
            moatConfigs={configs}
            showLiveBadge
          />
        </section>
      )}

      <Footer />
    </div>
  );
}

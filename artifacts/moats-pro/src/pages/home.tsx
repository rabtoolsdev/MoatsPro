import { useState, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useReadContracts, useAccount } from "wagmi";
import { useAppKit, useAppKitNetwork } from "@reown/appkit/react";
import { CHAIN_DISPLAY } from "@/lib/wagmi-config";
import { Wallet, ArrowRight } from "lucide-react";
import { formatUnits } from "viem";
import { useAllMoatConfigs, useMapsLeaderboard, useEvents, useAllRewardsDeposited } from "@/hooks/use-moats-api";
import { BASE_TOKENS_BY_CHAIN } from "@/lib/moat-tokens";
import { useTokenPrices, getLlamaId } from "@/hooks/use-token-prices";
import { useDexscreenerInfo } from "@/hooks/use-dexscreener";
import { MOAT_V3_ABI, ERC20_ABI, MOAT_LOGO_ABI } from "@/lib/moat-abi";
import { getMoatMeta } from "@/lib/moat-metadata";
import { useResolveMoatMetas } from "@/hooks/use-resolve-moat-metas";
import { useDailyRewardEstimates } from "@/hooks/use-daily-reward-estimates";
import { useRewardPoolBalances } from "@/hooks/use-reward-pool-balances";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { MoatCard } from "@/components/moat-card";
import { StatsBar } from "@/components/stats-bar";
import { RewardsBar, type RewardBucketRow } from "@/components/rewards-bar";
import { ActivityFeed } from "@/components/activity-feed";
import btcbLogo from "@assets/logobtc_1777735570322.png";

const USDC_LOGO_URL =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/assets/0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E/logo.png";
const WAVAX_LOGO_URL =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png";

const heroWords = ["Stake.", "Lock.", "Burn.", "Earn."];

export default function Home() {
  const [statusFilter, setStatusFilter] = useState<string>("Verified");
  const { isConnected, address } = useAccount();
  const { open } = useAppKit();
  const { chainId } = useAppKitNetwork();
  const activeNetwork =
    typeof chainId === "number" ? CHAIN_DISPLAY[chainId]?.network : undefined;
  const activeChainLabel =
    typeof chainId === "number" ? CHAIN_DISPLAY[chainId]?.label : undefined;
  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
  const { data: configs, isLoading: configsLoading } = useAllMoatConfigs();
  const { data: leaderboard } = useMapsLeaderboard();
  const { data: eventsData } = useEvents();
  const { data: rewardsDepositedEvents } = useAllRewardsDeposited();

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
        // Include reward token addresses so Dexscreener can price them when
        // DefiLlama is silent (community reward tokens often only have DEX data).
        for (const t of c.rewardTokens ?? []) {
          if (t.tokenAddress) addrs.add(t.tokenAddress.toLowerCase());
        }
      }
    }
    stakingTokenAddrs.forEach((addr) => { if (addr) addrs.add(addr.toLowerCase()); });
    return [...addrs];
  }, [configs, stakingTokenAddrs]);

  const { data: dexInfoMap } = useDexscreenerInfo(allTokenAddrs);

  // Aggregate lifetime rewards distributed by summing every on-chain
  // `RewardsDeposited` event per token address, then bucket into
  // USDC / WAVAX / BTC.b / Community. This matches the on-chain truth
  // moats.app uses, including moats that have historically deposited a
  // token but no longer list it in their current rewardTokens[] config.
  const rewardsAggregate = useMemo(() => {
    const empty = {
      usdc: { symbol: "USDC", amount: 0, usd: 0, price: 0, logoUrl: USDC_LOGO_URL } as RewardBucketRow,
      wavax: { symbol: "WAVAX", amount: 0, usd: 0, price: 0, logoUrl: WAVAX_LOGO_URL } as RewardBucketRow,
      btcb: { symbol: "BTC.b", amount: 0, usd: 0, price: 0, logoUrl: btcbLogo } as RewardBucketRow,
      community: { usd: 0, tokenCount: 0 },
    };

    // Build a token-meta registry: address -> { symbol, decimals, network }.
    // Source 1: every moat's rewardTokens[] (covers the long tail).
    // Source 2: BASE_TOKENS_BY_CHAIN (covers tokens removed from configs).
    type TokenMeta = { symbol: string; decimals: number; network: string };
    const tokenMeta = new Map<string, TokenMeta>();
    if (configs) {
      for (const c of configs) {
        for (const t of c.rewardTokens ?? []) {
          if (!t.tokenAddress || !t.symbol) continue;
          const k = t.tokenAddress.toLowerCase();
          if (!tokenMeta.has(k)) {
            tokenMeta.set(k, {
              symbol: t.symbol,
              decimals: Number(t.decimals) || 18,
              network: c.network || "avax",
            });
          }
        }
      }
    }
    for (const tokens of Object.values(BASE_TOKENS_BY_CHAIN)) {
      for (const t of tokens) {
        const k = t.address.toLowerCase();
        if (!tokenMeta.has(k)) {
          tokenMeta.set(k, { symbol: t.symbol, decimals: t.decimals, network: "avax" });
        }
      }
    }

    const events = rewardsDepositedEvents?.results ?? [];
    if (!configs || events.length === 0) return empty;

    // Sum raw wei per token from RewardsDeposited events
    const perTokenWei = new Map<string, bigint>();
    for (const e of events) {
      const tok = (e.args?.token as string | undefined)?.toLowerCase();
      const amt = e.args?.amount as string | undefined;
      if (!tok || !amt) continue;
      try {
        const cur = perTokenWei.get(tok) ?? 0n;
        perTokenWei.set(tok, cur + BigInt(amt));
      } catch {
        // skip malformed amount
      }
    }

    const normSym = (s: string) => s.toLowerCase().replace(/\./g, "");
    const isUsdc = (s: string) => normSym(s) === "usdc";
    const isWavax = (s: string) => normSym(s) === "wavax";
    const isBtcb = (s: string) => {
      const n = normSym(s);
      return n === "btcb" || n === "btc";
    };

    const out = {
      usdc: { symbol: "USDC", amount: 0, usd: 0, price: 0, logoUrl: USDC_LOGO_URL } as RewardBucketRow,
      wavax: { symbol: "WAVAX", amount: 0, usd: 0, price: 0, logoUrl: WAVAX_LOGO_URL } as RewardBucketRow,
      btcb: { symbol: "BTC.b", amount: 0, usd: 0, price: 0, logoUrl: btcbLogo } as RewardBucketRow,
      community: { usd: 0, tokenCount: 0 },
    };

    for (const [addr, wei] of perTokenWei.entries()) {
      const meta = tokenMeta.get(addr);
      if (!meta) {
        // Unknown token (no config or registry entry) — treat as community
        // with 18 decimals so we at least count something; no USD though.
        out.community.tokenCount += 1;
        continue;
      }
      // Convert wei -> human units
      const divisor = 10 ** meta.decimals;
      const amount = Number(wei) / divisor;
      if (amount <= 0) continue;

      const llamaPrice = priceMap?.[getLlamaId(meta.network, addr).toLowerCase()] ?? 0;
      const dexPrice = dexInfoMap?.[addr]?.price ?? 0;
      const price = llamaPrice || dexPrice || 0;
      const usd = amount * price;

      if (isUsdc(meta.symbol)) {
        out.usdc.amount += amount;
        out.usdc.usd += usd;
        if (price > 0) out.usdc.price = price;
      } else if (isWavax(meta.symbol)) {
        out.wavax.amount += amount;
        out.wavax.usd += usd;
        if (price > 0) out.wavax.price = price;
      } else if (isBtcb(meta.symbol)) {
        out.btcb.amount += amount;
        out.btcb.usd += usd;
        if (price > 0) out.btcb.price = price;
      } else {
        out.community.usd += usd;
        out.community.tokenCount += 1;
      }
    }

    // USDC is ~$1 even if oracle is silent; fall back so the card never looks broken
    if (out.usdc.price === 0 && out.usdc.amount > 0) {
      out.usdc.price = 1;
      out.usdc.usd = out.usdc.amount;
    }

    return out;
  }, [configs, rewardsDepositedEvents, priceMap, dexInfoMap]);

  useResolveMoatMetas(
    (configs ?? []).map((c, i) => ({
      contractAddress: c.contractAddress,
      stakingToken: stakingTokenAddrs[i] || undefined,
      network: c.network,
    })),
  );

  const dailyEstimates = useDailyRewardEstimates(configs);
  const poolBalances = useRewardPoolBalances(configs);

  const getTokenPrice = (_network: string, tokenAddr: string): number => {
    return dexInfoMap?.[tokenAddr.toLowerCase()]?.price ?? 0;
  };

  // Sum of liquidity across all DexScreener pools per moat (keyed by moat addr)
  const liquidityTvlMap = useMemo((): Record<string, { liquidityUsd: number; pairCount: number }> => {
    if (!configs || !dexInfoMap) return {};
    const m: Record<string, { liquidityUsd: number; pairCount: number }> = {};
    configs.forEach((c, i) => {
      const tokenAddr = stakingTokenAddrs[i]?.toLowerCase();
      if (!tokenAddr) return;
      const info = dexInfoMap[tokenAddr];
      if (info && info.liquidityUsd > 0) {
        m[c.contractAddress.toLowerCase()] = {
          liquidityUsd: info.liquidityUsd,
          pairCount: info.pairCount,
        };
      }
    });
    return m;
  }, [configs, stakingTokenAddrs, dexInfoMap]);

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
      const dexInfo = dexInfoMap?.[tokenAddr];
      // LP staking tokens (e.g. Pharaoh hCASH/WAVAX): the moat holds a share
      // of the LP supply, not bare ERC-20 units, so DexScreener's per-pair
      // priceUsd (which is the BASE token price, not per-LP-unit) gives the
      // wrong TVM. Compute moat's share × pool TVL instead.
      if (dexInfo?.isLpToken) {
        // Use the LP's OWN pool TVL (not the aggregated underlying-token
        // liquidity), since the LP token only represents a share of that
        // single pool. Falls back to aggregated liquidity if the per-pool
        // value is unavailable.
        const poolTvl = dexInfo.lpPoolLiquidityUsd ?? dexInfo.liquidityUsd;
        const supply = totalSupplyMap[tokenAddr];
        if (poolTvl > 0 && supply && supply > 0n) {
          const moatShareBp = Number(((totalStaked + totalLocked + totalBurned) * 1_000_000n) / supply);
          m[c.contractAddress.toLowerCase()] = (moatShareBp / 1_000_000) * poolTvl;
        }
        return;
      }
      const dec = decimalsMap[tokenAddr] ?? 18;
      const price = getTokenPrice(c.network, tokenAddr);
      if (price > 0) {
        m[c.contractAddress.toLowerCase()] =
          parseFloat(formatUnits(totalStaked + totalLocked + totalBurned, dec)) * price;
        return;
      }
      // Fallback: token has no price source but DOES have DEX liquidity.
      // Estimate moat's TVM as its share of total supply × aggregated DEX liquidity.
      const aggLiq = dexInfo?.liquidityUsd ?? 0;
      const supply = totalSupplyMap[tokenAddr];
      if (aggLiq > 0 && supply && supply > 0n) {
        const moatShareBp = Number(((totalStaked + totalLocked + totalBurned) * 1_000_000n) / supply);
        m[c.contractAddress.toLowerCase()] = (moatShareBp / 1_000_000) * aggLiq;
      }
    });
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moatOnchainData, configs, priceMap, dexInfoMap, decimalsMap, totalSupplyMap]);

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

  const networkFiltered = activeNetwork
    ? moatsWithMeta.filter(
        (c) => (c.network ?? "").toLowerCase() === activeNetwork,
      )
    : moatsWithMeta;

  const filteredMoats = (
    statusFilter === "all"
      ? networkFiltered
      : networkFiltered.filter((c) => c.status === statusFilter)
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
    hidden: { opacity: 0, y: 24, scale: 0.93 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring" as const, stiffness: 260, damping: 18, mass: 0.8 },
    },
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      {/* Hero */}
      <section className="relative pt-32 pb-24 px-4 overflow-hidden">
        {/* Animated grid background */}
        <div className="absolute inset-0 bg-grid-animated opacity-60 pointer-events-none" />
        {/* Radial vignette over grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, hsl(var(--background)) 100%)" }}
        />

        {/* Floating orbs */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[380px] bg-primary/8 rounded-full blur-[140px] pointer-events-none float-slow" />
        <div className="absolute top-32 left-1/4 w-[280px] h-[280px] bg-cyan-500/6 rounded-full blur-[90px] pointer-events-none float-slow-alt" />
        <div className="absolute top-20 right-1/5 w-[200px] h-[200px] bg-violet-500/5 rounded-full blur-[80px] pointer-events-none float-slow-alt" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
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
          >Earn real yield from the most powerful DeFi liquidity positions. Premium analytics. On chain forever.</motion.p>

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
      {/* Stats Bar */}
      <StatsBar
        moatConfigs={configs}
        leaderboard={leaderboard}
        totalTvmUsd={Object.values(tvmMap).reduce((s, v) => s + v, 0)}
      />
      {/* Rewards Distributed Bar */}
      <RewardsBar
        usdc={rewardsAggregate.usdc}
        wavax={rewardsAggregate.wavax}
        btcb={rewardsAggregate.btcb}
        community={rewardsAggregate.community}
      />
      {/* Moats Grid */}
      <section className="flex-1 px-4 py-16 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold" data-testid="section-moats">Active Moats</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {filteredMoats.length} active{" "}
              {filteredMoats.length === 1 ? "moat" : "moats"}
              {activeChainLabel ? ` on ${activeChainLabel}` : ""}
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
            <p className="text-lg">
              No Moats found{activeChainLabel ? ` on ${activeChainLabel}` : ""}
            </p>
            <p className="text-sm mt-2">
              Try switching networks from the chain selector at the top right.
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
                  dexLiquidityUSD={liquidityTvlMap[moat.contractAddress.toLowerCase()]?.liquidityUsd}
                  dexPairCount={liquidityTvlMap[moat.contractAddress.toLowerCase()]?.pairCount}
                  dailyEstimates={dailyEstimates}
                  poolBalances={poolBalances}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
      {/* Activity Feed */}
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

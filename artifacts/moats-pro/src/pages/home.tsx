import { useState, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useReadContracts, useAccount } from "wagmi";
import { useAppKit, useAppKitNetwork } from "@reown/appkit/react";
import { CHAIN_DISPLAY } from "@/lib/wagmi-config";
import { Wallet, ArrowRight, Search, ArrowUpDown, X } from "lucide-react";
import { formatUnits } from "viem";
import { useAllMoatConfigs, useMapsLeaderboard, useEvents, useAllRewardsDeposited } from "@/hooks/use-moats-api";
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
import { TrendingMoatsCarousel } from "@/components/trending-moats-carousel";
import { RewardsBar, type RewardBucketRow } from "@/components/rewards-bar";
import { ActivityFeed } from "@/components/activity-feed";
import btcbLogo from "@assets/logobtc_1777735570322.png";

const USDC_LOGO_URL =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/assets/0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E/logo.png";
const WAVAX_LOGO_URL =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png";

const heroWords = ["Stake.", "Lock.", "Burn.", "Earn."];

// Reverse of CHAIN_DISPLAY: API network slug -> numeric chain id, so each
// Moat's on-chain reads target its OWN chain rather than the wallet's
// currently-connected chain (otherwise cross-chain reads silently fail).
const NETWORK_TO_CHAIN_ID: Record<string, number> = Object.fromEntries(
  Object.entries(CHAIN_DISPLAY).map(([id, d]) => [d.network.toLowerCase(), Number(id)]),
);

export default function Home() {
  const [statusFilter, setStatusFilter] = useState<string>("Verified");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"tvm" | "name" | "supply">("tvm");
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
    return configs.flatMap((c) => {
      const chainId = NETWORK_TO_CHAIN_ID[(c.network ?? "").toLowerCase()];
      return [
        { address: c.contractAddress as `0x${string}`, abi: MOAT_V3_ABI, functionName: "totalStaked" as const, chainId },
        { address: c.contractAddress as `0x${string}`, abi: MOAT_V3_ABI, functionName: "stakingToken" as const, chainId },
        { address: c.contractAddress as `0x${string}`, abi: MOAT_V3_ABI, functionName: "totalLocked" as const, chainId },
        { address: c.contractAddress as `0x${string}`, abi: MOAT_V3_ABI, functionName: "totalBurned" as const, chainId },
      ];
    });
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

  // Dedupe staking tokens by address while keeping each token's own chainId so
  // ERC20 reads target the right chain (not the wallet's connected one).
  const uniqueStakingTokens = useMemo(() => {
    const m = new Map<string, { address: string; chainId?: number }>();
    stakingTokenAddrs.forEach((addr, i) => {
      if (!addr) return;
      const key = addr.toLowerCase();
      if (!m.has(key)) {
        m.set(key, {
          address: addr,
          chainId: NETWORK_TO_CHAIN_ID[(configs?.[i]?.network ?? "").toLowerCase()],
        });
      }
    });
    return [...m.values()];
  }, [stakingTokenAddrs, configs]);

  const { data: decimalsData } = useReadContracts({
    contracts: uniqueStakingTokens.map((t) => ({
      address: t.address as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals" as const,
      chainId: t.chainId,
    })),
    query: { enabled: uniqueStakingTokens.length > 0 },
  });

  const { data: totalSupplyData } = useReadContracts({
    contracts: uniqueStakingTokens.map((t) => ({
      address: t.address as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "totalSupply" as const,
      chainId: t.chainId,
    })),
    query: { enabled: uniqueStakingTokens.length > 0 },
  });

  const decimalsMap = useMemo((): Record<string, number> => {
    const m: Record<string, number> = {};
    uniqueStakingTokens.forEach((t, i) => {
      const r = decimalsData?.[i];
      m[t.address.toLowerCase()] = r?.status === "success" ? Number(r.result) : 18;
    });
    return m;
  }, [uniqueStakingTokens, decimalsData]);

  const totalSupplyMap = useMemo((): Record<string, bigint> => {
    const m: Record<string, bigint> = {};
    uniqueStakingTokens.forEach((t, i) => {
      const r = totalSupplyData?.[i];
      if (r?.status === "success") m[t.address.toLowerCase()] = r.result as unknown as bigint;
    });
    return m;
  }, [uniqueStakingTokens, totalSupplyData]);

  const logoContracts = useMemo(() => {
    if (!configs) return [];
    return configs.map((c) => ({
      address: c.contractAddress as `0x${string}`,
      abi: MOAT_LOGO_ABI,
      functionName: "getLogoURL" as const,
      chainId: NETWORK_TO_CHAIN_ID[(c.network ?? "").toLowerCase()],
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
        const key = `${(c.network ?? "avalanche").toLowerCase()}:${c.contractAddress.toLowerCase()}`;
        m[key] = r.result;
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
      const meta = getMoatMeta(c.contractAddress, c.network);
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
        const meta = getMoatMeta(c.contractAddress, c.network);
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

  // Aggregate lifetime rewards distributed per token, bucketed into
  // USDC / WAVAX / BTC.b / Community.
  //
  // Default source: each moat's MoatConfig.rewardTokens[].totalRewardsDeposited.
  // WAVAX override: sum from on-chain `RewardsDeposited` events so that
  // historical deposits from moats that no longer list WAVAX in their reward
  // config (e.g. 0x3399d035, 0x3693df1d) are still counted — matches the
  // figure moats.app reports.
  const rewardsAggregate = useMemo(() => {
    const empty = {
      usdc: { symbol: "USDC", amount: 0, usd: 0, price: 0, logoUrl: USDC_LOGO_URL } as RewardBucketRow,
      wavax: { symbol: "WAVAX", amount: 0, usd: 0, price: 0, logoUrl: WAVAX_LOGO_URL } as RewardBucketRow,
      btcb: { symbol: "BTC.b", amount: 0, usd: 0, price: 0, logoUrl: btcbLogo } as RewardBucketRow,
      community: { usd: 0, tokenCount: 0 },
    };
    if (!configs) return empty;

    const WAVAX_ADDR = "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7";
    const WAVAX_DECIMALS = 18;

    // ---- Config-based aggregation (original) for USDC / BTC.b / Community ----
    type TokenAgg = {
      symbol: string;
      network: string;
      address: string;
      amount: number;
    };
    const perToken = new Map<string, TokenAgg>();
    for (const c of configs) {
      if (!c.rewardTokens) continue;
      for (const t of c.rewardTokens) {
        if (!t.tokenAddress || !t.symbol) continue;
        const deposited = Number(t.totalRewardsDeposited) || 0;
        if (deposited <= 0) continue;
        const key = `${(c.network || "avax").toLowerCase()}|${t.tokenAddress.toLowerCase()}`;
        const cur = perToken.get(key);
        if (cur) cur.amount += deposited;
        else
          perToken.set(key, {
            symbol: t.symbol,
            network: c.network || "avax",
            address: t.tokenAddress,
            amount: deposited,
          });
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

    for (const tok of perToken.values()) {
      // Skip WAVAX here — it's computed from on-chain events below.
      if (tok.address.toLowerCase() === WAVAX_ADDR) continue;

      const llamaPrice = priceMap?.[getLlamaId(tok.network, tok.address).toLowerCase()] ?? 0;
      const dexPrice = dexInfoMap?.[tok.address.toLowerCase()]?.price ?? 0;
      const price = llamaPrice || dexPrice || 0;
      const usd = tok.amount * price;

      if (isUsdc(tok.symbol)) {
        out.usdc.amount += tok.amount;
        out.usdc.usd += usd;
        if (price > 0) out.usdc.price = price;
      } else if (isWavax(tok.symbol)) {
        // (unreachable — guarded above by WAVAX_ADDR check)
        continue;
      } else if (isBtcb(tok.symbol)) {
        out.btcb.amount += tok.amount;
        out.btcb.usd += usd;
        if (price > 0) out.btcb.price = price;
      } else {
        out.community.usd += usd;
        out.community.tokenCount += 1;
      }
    }

    // ---- WAVAX: events-based override ----
    let wavaxWei = 0n;
    for (const e of rewardsDepositedEvents?.results ?? []) {
      const tok = (e.args?.token as string | undefined)?.toLowerCase();
      const amt = e.args?.amount as string | undefined;
      if (tok !== WAVAX_ADDR || !amt) continue;
      try {
        wavaxWei += BigInt(amt);
      } catch {
        // skip malformed amount
      }
    }
    if (wavaxWei > 0n) {
      const wavaxAmount = Number(wavaxWei) / 10 ** WAVAX_DECIMALS;
      const wavaxPrice =
        (priceMap?.[getLlamaId("avax", WAVAX_ADDR).toLowerCase()] ?? 0) ||
        dexInfoMap?.[WAVAX_ADDR]?.price ||
        0;
      out.wavax.amount = wavaxAmount;
      out.wavax.price = wavaxPrice;
      out.wavax.usd = wavaxAmount * wavaxPrice;
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

  const getTokenPrice = (network: string, tokenAddr: string): number => {
    // Prefer DefiLlama's canonical price (this is what moats.app shows). It
    // aggregates across sources and filters outlier/illiquid pools, whereas a
    // raw DexScreener liquidity-weighted average can be skewed by a stale or
    // thin pool — e.g. MYST had a vapordex pool ~3x the real price that
    // inflated the moat's TVM. Fall back to DexScreener only when DefiLlama has
    // no price for the token.
    const llama = priceMap?.[getLlamaId(network, tokenAddr).toLowerCase()] ?? 0;
    if (llama > 0) return llama;
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
    meta: getMoatMeta(config.contractAddress, config.network),
  }));

  const networkFiltered = activeNetwork
    ? moatsWithMeta.filter(
        (c) => (c.network ?? "").toLowerCase() === activeNetwork,
      )
    : moatsWithMeta;

  const statusFilteredMoats =
    statusFilter === "all"
      ? networkFiltered
      : networkFiltered.filter((c) => c.status === statusFilter);

  // Tag options: derived from the status-filtered set so counts reflect
  // what's currently visible. Sorted by descending count, then name.
  const tagOptions = useMemo(() => {
    const counts = new Map<string, { name: string; color?: string; count: number }>();
    for (const c of statusFilteredMoats) {
      for (const t of c.tags ?? []) {
        if (!t?.name) continue;
        const cur = counts.get(t.name);
        if (cur) cur.count += 1;
        else counts.set(t.name, { name: t.name, color: t.color, count: 1 });
      }
    }
    return [...counts.values()].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
  }, [statusFilteredMoats]);

  const filteredMoats = (
    selectedTags.length === 0
      ? statusFilteredMoats
      : statusFilteredMoats.filter((c) => {
          const names = new Set((c.tags ?? []).map((t) => t.name));
          // OR semantics: show moat if it carries ANY of the selected tags.
          return selectedTags.some((t) => names.has(t));
        })
  )
    .filter((c) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        c.meta.name.toLowerCase().includes(q) ||
        (c.meta.protocol ?? "").toLowerCase().includes(q) ||
        (c.meta.tokenSymbol ?? "").toLowerCase().includes(q) ||
        c.contractAddress.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.meta.name.localeCompare(b.meta.name);
      if (sortBy === "supply") {
        const sa = supplyPctMap[a.contractAddress.toLowerCase()] ?? 0;
        const sb = supplyPctMap[b.contractAddress.toLowerCase()] ?? 0;
        return sb - sa;
      }
      const tvmA = tvmMap[a.contractAddress.toLowerCase()] ?? 0;
      const tvmB = tvmMap[b.contractAddress.toLowerCase()] ?? 0;
      return tvmB - tvmA;
    });

  const toggleTag = (name: string) =>
    setSelectedTags((cur) =>
      cur.includes(name) ? cur.filter((t) => t !== name) : [...cur, name],
    );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.04 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
    },
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      {/* Hero */}
      <section className="relative pt-32 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Animated grid background */}
        <div className="absolute inset-0 bg-grid-animated opacity-30 pointer-events-none" />
        {/* Radial vignette over grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, hsl(var(--background)) 100%)" }}
        />
        
        {/* Floating orbs — static: animating huge blur layers forces full-page
            recompositing on every frame and causes scroll jank on mobile */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0" />
        <div className="absolute top-32 left-1/4 w-[350px] h-[350px] bg-cyan-500/8 rounded-full blur-[80px] pointer-events-none z-0" />
        <div className="absolute top-20 right-1/5 w-[250px] h-[250px] bg-violet-500/8 rounded-full blur-[70px] pointer-events-none z-0" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary mb-6 shadow-[0_0_15px_rgba(0,212,255,0.2)] backdrop-blur-md"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
            <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Moats Pro Terminal</span>
          </motion.div>

          {/* Staggered headline words */}
          <div className="text-5xl md:text-7xl font-black tracking-tight mb-4 flex flex-wrap justify-center gap-x-4">
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
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8"
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
      {/* Trending Moats — auto-scrolling carousel sits above the stats bar */}
      <TrendingMoatsCarousel configs={configs} tvmMap={tvmMap} logoUrls={logoMap} />
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
      {/* Tag Filters — sit between Rewards Distributed and Active Moats */}
      {tagOptions.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 pt-10 max-w-7xl mx-auto w-full relative z-10">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <h3 className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <span className="w-1 h-3 bg-primary shadow-[0_0_8px_rgba(0,212,255,0.8)]" /> Filter by Tag
            </h3>
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                data-testid="btn-clear-tags"
                className="text-xs text-primary hover:text-primary/80 underline-offset-2 hover:underline font-mono"
              >
                Clear ({selectedTags.length})
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2" data-testid="tag-filters">
            {tagOptions.map((t) => {
              const active = selectedTags.includes(t.name);
              return (
                <button
                  key={t.name}
                  onClick={() => toggleTag(t.name)}
                  data-testid={`tag-${t.name}`}
                  className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] text-[10px] font-mono uppercase tracking-widest border transition-all ${
                    active
                      ? "bg-primary/20 border-primary text-primary shadow-[0_0_12px_rgba(0,212,255,0.4)] backdrop-blur-sm"
                      : "bg-black/40 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground backdrop-blur-sm"
                  }`}
                >
                  {t.color && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0 shadow-[0_0_4px_currentColor]"
                      style={{ backgroundColor: t.color, color: t.color }}
                    />
                  )}
                  <span>{t.name}</span>
                  <span className={`tabular-nums ${active ? "text-primary font-bold" : "text-muted-foreground/50"}`}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {/* Moats Grid */}
      <section className="flex-1 px-4 sm:px-6 lg:px-8 py-16 max-w-7xl mx-auto w-full relative z-10">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4 border-b border-white/5 pb-4 relative">
          <div className="absolute bottom-0 left-0 w-32 h-[2px] bg-primary shadow-[0_0_10px_rgba(0,212,255,0.8)]" />
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3 text-white" data-testid="section-moats">
              Active Moats
            </h2>
            <p className="text-muted-foreground text-[11px] font-mono tracking-widest uppercase mt-1">
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
                className={`px-4 py-1.5 rounded-[4px] text-[10px] font-mono uppercase tracking-widest transition-all ${
                  statusFilter === status
                    ? "bg-primary text-black font-bold shadow-[0_0_15px_rgba(0,212,255,0.5)]"
                    : "border border-border bg-black/40 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Search + sort controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
          <div className="relative flex-1 sm:max-w-sm group">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none group-focus-within:text-primary transition-colors"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search moats, tokens, protocols…"
              data-testid="input-search-moats"
              aria-label="Search moats, tokens, and protocols"
              className="w-full pl-9 pr-9 py-2 rounded-[4px] bg-black/40 border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:shadow-[0_0_15px_rgba(0,212,255,0.3)] transition-all font-mono backdrop-blur-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                data-testid="btn-clear-search"
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div
            role="group"
            aria-label="Sort moats"
            className="flex items-center gap-2 sm:ml-auto"
          >
            <ArrowUpDown size={14} className="text-primary/70 shrink-0" />
            <div className="flex gap-1.5 flex-wrap">
              {([
                ["tvm", "TVM"],
                ["name", "Name"],
                ["supply", "% Supply"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  data-testid={`sort-${key}`}
                  aria-pressed={sortBy === key}
                  className={`px-3 py-1.5 rounded-[4px] text-[10px] font-mono uppercase tracking-widest transition-all ${
                    sortBy === key
                      ? "bg-primary/20 border border-primary text-primary shadow-[0_0_10px_rgba(0,212,255,0.2)]"
                      : "border border-border bg-black/40 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {configsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-80 rounded-2xl skeleton-shimmer border border-border"
              />
            ))}
          </div>
        ) : filteredMoats.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            {searchQuery ? (
              <>
                <p className="text-lg">No moats match "{searchQuery}"</p>
                <p className="text-sm mt-2">
                  Try a different search or{" "}
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-primary hover:underline underline-offset-2"
                  >
                    clear the search
                  </button>
                  .
                </p>
              </>
            ) : (
              <>
                <p className="text-lg">
                  No Moats found{activeChainLabel ? ` on ${activeChainLabel}` : ""}
                </p>
                <p className="text-sm mt-2">
                  Try switching networks from the chain selector at the top right.
                </p>
              </>
            )}
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
                  logoUrl={logoMap[`${(moat.network ?? "avalanche").toLowerCase()}:${moat.contractAddress.toLowerCase()}`]}
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
        <section className="px-4 sm:px-6 lg:px-8 py-12 max-w-7xl mx-auto w-full relative z-10">
          <div className="bg-card/30 backdrop-blur-xl border border-white/5 rounded-2xl p-6 relative overflow-hidden cyber-grid">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="flex items-center justify-between mb-6">
              <div />
              <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                {eventsData.total.toLocaleString()} total events
              </span>
            </div>
            <ActivityFeed
              events={eventsData.results.slice(0, 12)}
              moatConfigs={configs}
              showLiveBadge
            />
          </div>
        </section>
      )}
      <Footer />
    </div>
  );
}

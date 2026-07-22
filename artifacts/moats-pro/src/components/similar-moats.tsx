import { useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useReadContracts } from "wagmi";
import { MoatCard } from "@/components/moat-card";
import { useAllMoatConfigs } from "@/hooks/use-moats-api";
import { useTrendingMoats } from "@/hooks/use-trending-moats";
import { useDailyRewardEstimates } from "@/hooks/use-daily-reward-estimates";
import { useRewardPoolBalances } from "@/hooks/use-reward-pool-balances";
import { MOAT_LOGO_ABI } from "@/lib/moat-abi";
import { networkToChainId } from "@/lib/wagmi-config";
import type { MoatConfig } from "@/lib/moats-api";

const MAX_RESULTS = 3;

function enabledRewardAddrs(c: MoatConfig): Set<string> {
  const s = new Set<string>();
  for (const t of c.rewardTokens ?? []) {
    if (t.enabled && t.tokenAddress) s.add(t.tokenAddress.toLowerCase());
  }
  return s;
}

function tagNames(c: MoatConfig): Set<string> {
  const s = new Set<string>();
  for (const t of c.tags ?? []) {
    if (t.name) s.add(t.name.toLowerCase());
  }
  return s;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const v of a) if (b.has(v)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Proximity in a scalar signal: 1 when identical, →0 as the gap widens.
// "No data on either side" (incl. while streams are still loading) is treated as
// a neutral 0 so it never inflates the score for otherwise-unrelated moats.
function proximity(a: number, b: number, max: number): number {
  if (a === 0 && b === 0) return 0;
  return Math.max(0, Math.min(1, 1 - Math.abs(a - b) / max));
}

/**
 * Discovery section shown below the activity feed on a Moat detail page.
 * Recommends related moats scored by a weighted blend of:
 *   - overlapping enabled reward tokens (which rewards are distributed)
 *   - shared tags and matching status category (tagging system)
 *   - proximity in 7d rewards distributed, USD (reward-distribution scale)
 *   - proximity in 7d active wallets (active users)
 *   - same network
 * Reward-token / tag / status / network signals come from config alone; the
 * rewards-scale and active-users signals reuse the same cached aggregation that
 * powers the trending feed, so the numbers stay consistent across the app.
 */
export function SimilarMoats({ currentMoat }: { currentMoat: MoatConfig }) {
  const { data: configs } = useAllMoatConfigs();
  // Reuse the trending aggregation (cached protocol events + pricing) to get
  // per-moat 7d rewards distributed (USD) and 7d active wallets for every moat.
  const { trending } = useTrendingMoats({ configs, limit: 9999 });

  const rewards7dUsd = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of trending) m[t.config.contractAddress.toLowerCase()] = t.rewards7dUsd;
    return m;
  }, [trending]);

  const activeWallets7d = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of trending) m[t.config.contractAddress.toLowerCase()] = t.activeWallets7d;
    return m;
  }, [trending]);

  const similar = useMemo<MoatConfig[]>(() => {
    if (!configs) return [];
    const currentKey = currentMoat.contractAddress.toLowerCase();
    const curRewards = enabledRewardAddrs(currentMoat);
    const curTags = tagNames(currentMoat);
    const curActive = activeWallets7d[currentKey] ?? 0;
    const curRewUsd = rewards7dUsd[currentKey] ?? 0;
    const maxActive = Math.max(1, ...Object.values(activeWallets7d));
    const maxRewUsd = Math.max(1, ...Object.values(rewards7dUsd));

    const scored = configs
      .filter(
        (c) =>
          c.contractAddress.toLowerCase() !== currentKey &&
          c.status !== "Deprecated",
      )
      .map((c) => {
        const key = c.contractAddress.toLowerCase();
        const rewardSim = jaccard(curRewards, enabledRewardAddrs(c));
        const tagSim = jaccard(curTags, tagNames(c));
        const sameStatus = c.status === currentMoat.status ? 1 : 0;
        const sameNetwork =
          (c.network ?? "").toLowerCase() ===
          (currentMoat.network ?? "").toLowerCase()
            ? 1
            : 0;
        const activeSim = proximity(curActive, activeWallets7d[key] ?? 0, maxActive);
        const rewardScaleSim = proximity(curRewUsd, rewards7dUsd[key] ?? 0, maxRewUsd);

        const score =
          rewardSim * 5 +
          tagSim * 3 +
          rewardScaleSim * 2 +
          activeSim * 2 +
          sameStatus * 1 +
          sameNetwork * 1;

        return { config: c, score };
      })
      // Require genuine relatedness: same network + same status alone (=2) is not
      // enough — a result needs real reward/tag/scale/activity overlap on top.
      .filter((r) => r.score > 2)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((r) => r.config);

    return scored;
  }, [configs, currentMoat, activeWallets7d, rewards7dUsd]);

  // Light on-chain reads (balanceOf) only for the few recommended moats, so
  // their reward labels and "Total Pool" render the same as on Explore.
  const dailyEstimates = useDailyRewardEstimates(similar);
  const poolBalances = useRewardPoolBalances(similar);

  // On-chain getLogoURL() for just the recommended moats, so the cards show the
  // real moat logos (matching Explore) instead of falling back to initials.
  const logoContracts = useMemo(
    () =>
      similar.map((c) => ({
        address: c.contractAddress as `0x${string}`,
        abi: MOAT_LOGO_ABI,
        functionName: "getLogoURL" as const,
        chainId: networkToChainId(c.network),
      })),
    [similar],
  );
  const { data: logoData } = useReadContracts({
    contracts: logoContracts,
    query: {
      enabled: logoContracts.length > 0,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  });
  const logoMap = useMemo((): Record<string, string> => {
    const m: Record<string, string> = {};
    if (!logoData) return m;
    similar.forEach((c, i) => {
      const r = logoData[i];
      if (r?.status === "success" && typeof r.result === "string" && r.result.length > 0) {
        const key = `${(c.network ?? "avalanche").toLowerCase()}:${c.contractAddress.toLowerCase()}`;
        m[key] = r.result;
      }
    });
    return m;
  }, [logoData, similar]);

  if (!configs) {
    return (
      <div>
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <span>Similar Moats</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-56 rounded-2xl border border-border bg-card/30 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (similar.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <span>Similar Moats</span>
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          Related moats with shared rewards, tags, and activity
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {similar.map((moat) => (
          <MoatCard
            key={moat.contractAddress}
            moat={moat}
            logoUrl={logoMap[`${(moat.network ?? "avalanche").toLowerCase()}:${moat.contractAddress.toLowerCase()}`]}
            dailyEstimates={dailyEstimates}
            poolBalances={poolBalances}
          />
        ))}
      </div>
    </motion.div>
  );
}

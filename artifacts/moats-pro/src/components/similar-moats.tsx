import { useMemo } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { MoatCard } from "@/components/moat-card";
import { useAllMoatConfigs } from "@/hooks/use-moats-api";
import { useProtocolEvents } from "@/hooks/use-protocol-events";
import { useDailyRewardEstimates } from "@/hooks/use-daily-reward-estimates";
import { useRewardPoolBalances } from "@/hooks/use-reward-pool-balances";
import type { MoatConfig, MoatEvent } from "@/lib/moats-api";

const SEVEN_DAYS_MS = 7 * 86400_000;
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

function eventMs(e: MoatEvent): number {
  const t = new Date(e.timestamp).getTime();
  return isFinite(t) ? t : 0;
}

/**
 * Discovery section shown below the activity feed on a Moat detail page.
 * Recommends related moats scored by a weighted blend of:
 *   - overlapping enabled reward tokens (reward-distribution similarity)
 *   - shared tags and matching status category (tagging system)
 *   - proximity in 7d active wallets (active users)
 *   - same network
 * Reward-token / tag / status / network signals come from config alone; the
 * active-users signal reuses the app-wide, react-query-cached event streams.
 */
export function SimilarMoats({ currentMoat }: { currentMoat: MoatConfig }) {
  const { data: configs } = useAllMoatConfigs();
  const ev = useProtocolEvents();

  // Unique active wallets over the last 7d per moat (Staked|Locked|Burned|
  // RewardClaimed|LockExited) — same definition used by the trending feed.
  const activeWallets7d = useMemo(() => {
    const sinceMs = Date.now() - SEVEN_DAYS_MS;
    const m: Record<string, Set<string>> = {};
    const sources = [ev.staked, ev.locked, ev.burned, ev.rewardClaimed, ev.lockExited];
    for (const arr of sources) {
      for (const e of arr) {
        const ms = eventMs(e);
        if (!ms || ms < sinceMs) continue;
        const moat = e.contractAddress.toLowerCase();
        const user = (e.args?.user as string | undefined)?.toLowerCase();
        if (!user) continue;
        (m[moat] ??= new Set<string>()).add(user);
      }
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(m)) out[k] = v.size;
    return out;
  }, [ev.staked, ev.locked, ev.burned, ev.rewardClaimed, ev.lockExited]);

  const similar = useMemo<MoatConfig[]>(() => {
    if (!configs) return [];
    const currentKey = currentMoat.contractAddress.toLowerCase();
    const curRewards = enabledRewardAddrs(currentMoat);
    const curTags = tagNames(currentMoat);
    const curActive = activeWallets7d[currentKey] ?? 0;
    const maxActive = Math.max(1, ...Object.values(activeWallets7d));

    const scored = configs
      .filter(
        (c) =>
          c.contractAddress.toLowerCase() !== currentKey &&
          c.status !== "Deprecated",
      )
      .map((c) => {
        const rewardSim = jaccard(curRewards, enabledRewardAddrs(c));
        const tagSim = jaccard(curTags, tagNames(c));
        const sameStatus = c.status === currentMoat.status ? 1 : 0;
        const sameNetwork =
          (c.network ?? "").toLowerCase() ===
          (currentMoat.network ?? "").toLowerCase()
            ? 1
            : 0;
        const other = activeWallets7d[c.contractAddress.toLowerCase()] ?? 0;
        // Proximity in active users: 1 when identical, →0 as the gap widens.
        // Treat "no activity on either side" (including while the event streams
        // are still loading) as a neutral 0 so it never inflates the score for
        // otherwise-unrelated moats.
        const activeSim =
          curActive === 0 && other === 0
            ? 0
            : Math.max(0, Math.min(1, 1 - Math.abs(curActive - other) / maxActive));

        const score =
          rewardSim * 5 +
          tagSim * 3 +
          activeSim * 2 +
          sameStatus * 1 +
          sameNetwork * 1;

        return { config: c, score };
      })
      // Keep meaningfully related moats: real reward/tag overlap, or at least
      // the same network so the list stays relevant rather than random.
      .filter((r) => r.score > 1)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((r) => r.config);

    return scored;
  }, [configs, currentMoat, activeWallets7d]);

  // Light on-chain reads (balanceOf) only for the few recommended moats, so
  // their reward labels and "Total Pool" render the same as on Explore.
  const dailyEstimates = useDailyRewardEstimates(similar);
  const poolBalances = useRewardPoolBalances(similar);

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
            dailyEstimates={dailyEstimates}
            poolBalances={poolBalances}
          />
        ))}
      </div>
    </motion.div>
  );
}

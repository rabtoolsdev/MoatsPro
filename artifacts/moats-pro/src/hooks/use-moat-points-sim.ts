import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { moatsApi } from "@/lib/moats-api";

/**
 * Moat Points simulation calibration.
 *
 * How Moat Points work (empirically derived & verified against the Fortifi
 * leaderboard): a wallet's points are a quadratic ("square-root") function of
 * its weighted position within the current epoch:
 *
 *     points = sqrt(k * weighted)
 *     weighted = staked * 1 + locked * lockMultiplier + burned * 10
 *
 * where `lockMultiplier` depends on the lock duration (2x..5x) and `k` is a
 * per-moat / per-epoch scalar that captures epoch progress. `k` is highly
 * consistent across wallets within the same moat+epoch, so we calibrate it
 * live from the leaderboard rather than hardcoding it.
 *
 * To calibrate `k` we only use wallets with NO locked tokens — their weights
 * (stake = 1, burn = 10) are unambiguous, whereas locked tokens carry an
 * unknown per-wallet duration multiplier. k = points^2 / weighted.
 */

const STAKE_WEIGHT = 1;
const BURN_WEIGHT = 10;
const SAMPLE_SIZE = 6;

export interface MoatPointsSim {
  /** Calibration scalar; null until enough clean samples are available. */
  k: number | null;
  ready: boolean;
  loading: boolean;
}

export function useMoatPointsSim(
  contractAddress: string | undefined,
  leaderboard: { address: string }[] | undefined,
): MoatPointsSim {
  const sampleAddrs = useMemo(
    () => (leaderboard ?? []).slice(0, SAMPLE_SIZE).map((e) => e.address),
    [leaderboard],
  );

  const results = useQueries({
    queries: sampleAddrs.map((addr) => ({
      queryKey: ["moats", "points", "v2", "user", addr, contractAddress],
      queryFn: () => moatsApi.getUserMoatPointsV2(addr, contractAddress!),
      enabled: !!contractAddress && !!addr,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const loading = results.some((r) => r.isLoading);

  const k = useMemo(() => {
    const ks: number[] = [];
    for (const r of results) {
      const data = r.data;
      const f = data?.fallbackInfo;
      const pts = data?.points ?? 0;
      const ta = f?.tokenAmounts;
      if (!f || !ta || pts <= 0) continue;
      // Skip wallets with locked tokens — lock weight is duration-dependent.
      if ((ta.locked ?? 0) > 0) continue;
      const weighted = (ta.staked ?? 0) * STAKE_WEIGHT + (ta.burnt ?? 0) * BURN_WEIGHT;
      if (weighted <= 0) continue;
      ks.push((pts * pts) / weighted);
    }
    if (ks.length === 0) return null;
    ks.sort((a, b) => a - b);
    const median = ks[Math.floor(ks.length / 2)];
    // Sanity: if the clean samples disagree wildly the sqrt model likely does
    // not apply to this moat (e.g. an unusual time-weighting config) — bail
    // rather than show a misleading number.
    if (ks.length >= 2 && ks[ks.length - 1] / ks[0] > 3) return null;
    return median;
  }, [results]);

  return { k, ready: k != null, loading };
}

/**
 * Estimate the Moat Points a position change would yield.
 *
 * Because points scale as sqrt(k * weighted), the marginal gain depends on the
 * wallet's existing position. We recover the wallet's current weighted total
 * from its current points (weighted = points^2 / k) so we never need its lock
 * breakdown.
 */
export function estimateMoatPoints(
  k: number,
  currentPoints: number,
  amount: number,
  actionWeight: number,
): { gained: number; newTotal: number } {
  if (k <= 0 || amount <= 0) return { gained: 0, newTotal: currentPoints };
  const currentWeighted = currentPoints > 0 ? (currentPoints * currentPoints) / k : 0;
  const newWeighted = currentWeighted + amount * actionWeight;
  const newTotal = Math.sqrt(k * newWeighted);
  return { gained: Math.max(0, newTotal - currentPoints), newTotal };
}

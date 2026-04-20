import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { ERC20_ABI } from "@/lib/moat-abi";
import type { MoatConfig } from "@/lib/moats-api";

/**
 * For Moats that distribute a *percentage* of an off-chain reward wallet's
 * token balance on a fixed cadence (e.g. Bensi: 5% of WAVAX every 24h),
 * compute an estimated daily emission so the card / detail page can show
 * "X/day" instead of just the cumulative deposited amount.
 *
 * Returns a map keyed by `${moatAddrLower}_${tokenAddrLower}` → estimated
 * tokens per day.
 */
export function useDailyRewardEstimates(configs?: MoatConfig[]) {
  // Pairs that need a balanceOf(publicAddress) read.
  const pairs = useMemo(() => {
    if (!configs) return [];
    const out: { moat: string; token: string; pub: string; pct: number; freqH: number; decimals: number }[] = [];
    for (const c of configs) {
      const pub = c.publicAddress;
      if (!pub) continue;
      for (const t of c.rewardTokens) {
        if (!t.enabled) continue;
        if (t.tokenAmount > 0) continue; // already has a fixed daily amount
        const pct = t.percentage ?? 0;
        const freqH = t.frequencyHours ?? 24;
        if (pct <= 0 || freqH <= 0) continue;
        out.push({
          moat: c.contractAddress.toLowerCase(),
          token: t.tokenAddress.toLowerCase(),
          pub,
          pct,
          freqH,
          decimals: t.decimals ?? 18,
        });
      }
    }
    return out;
  }, [configs]);

  const contracts = useMemo(
    () =>
      pairs.map((p) => ({
        address: p.token as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf" as const,
        args: [p.pub as `0x${string}`],
      })),
    [pairs],
  );

  const { data } = useReadContracts({
    contracts,
    query: { enabled: contracts.length > 0, staleTime: 60_000 },
  });

  return useMemo((): Record<string, number> => {
    const m: Record<string, number> = {};
    if (!data) return m;
    pairs.forEach((p, i) => {
      const r = data[i];
      if (r?.status !== "success") return;
      const balance = parseFloat(formatUnits(r.result as bigint, p.decimals));
      // Per-distribution payout × distributions per day
      const perDistribution = (balance * p.pct) / 100;
      const perDay = perDistribution * (24 / p.freqH);
      if (perDay > 0) m[`${p.moat}_${p.token}`] = perDay;
    });
    return m;
  }, [data, pairs]);
}

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { ERC20_ABI } from "@/lib/moat-abi";
import type { MoatConfig } from "@/lib/moats-api";

/**
 * For each enabled reward token across the supplied Moat configs, read the
 * current `balanceOf(publicAddress)` of the off-chain reward wallet so the
 * UI can show "Total Pool = live wallet balance" instead of the static
 * `totalRewardsDeposited` counter (which is often 0 for moats funded
 * externally, e.g. BENSI).
 *
 * Returns a map keyed by `${moatAddrLower}_${tokenAddrLower}` → tokens held
 * by the reward wallet.
 */
export function useRewardPoolBalances(configs?: MoatConfig[]) {
  const pairs = useMemo(() => {
    if (!configs) return [];
    const out: { moat: string; token: string; pub: string; decimals: number }[] = [];
    for (const c of configs) {
      const pub = c.publicAddress;
      if (!pub) continue;
      for (const t of c.rewardTokens) {
        if (!t.enabled) continue;
        if (!t.tokenAddress) continue;
        out.push({
          moat: c.contractAddress.toLowerCase(),
          token: t.tokenAddress.toLowerCase(),
          pub,
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
      m[`${p.moat}_${p.token}`] = balance;
    });
    return m;
  }, [data, pairs]);
}

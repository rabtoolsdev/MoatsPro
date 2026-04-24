import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { ERC20_ABI } from "@/lib/moat-abi";
import type { MoatConfig } from "@/lib/moats-api";

/**
 * Reads `balanceOf(moatContract)` of each enabled reward token. This represents
 * tokens that have already been pushed into the Moat for distribution but
 * have not yet been claimed by stakers.
 *
 * Combined with `totalRewardsClaimed`, this lets us compute an accurate
 * "% claimed of distributed rewards" — useful when `totalRewardsDeposited`
 * is unreliable (e.g. externally-funded moats where the counter is 0).
 *
 * Returns a map keyed by `${moatAddrLower}_${tokenAddrLower}` → tokens held
 * by the Moat contract.
 */
export function useContractRewardBalances(configs?: MoatConfig[]) {
  const pairs = useMemo(() => {
    if (!configs) return [];
    const out: { moat: string; token: string; decimals: number }[] = [];
    for (const c of configs) {
      for (const t of c.rewardTokens) {
        if (!t.enabled || !t.tokenAddress) continue;
        out.push({
          moat: c.contractAddress.toLowerCase(),
          token: t.tokenAddress.toLowerCase(),
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
        args: [p.moat as `0x${string}`],
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

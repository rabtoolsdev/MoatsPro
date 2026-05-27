import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { useProtocolEvents } from "@/hooks/use-protocol-events";
import { useTokenPrices, getLlamaId } from "@/hooks/use-token-prices";
import { useDexscreenerInfo } from "@/hooks/use-dexscreener";
import { MOAT_V3_ABI, ERC20_ABI } from "@/lib/moat-abi";
import type { MoatConfig, MoatEvent } from "@/lib/moats-api";

const SEVEN_DAYS_MS = 7 * 86400_000;
const USDC_ADDR = "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e";
const WAVAX_ADDR = "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7";

export interface TrendingMoat {
  rank: number;
  config: MoatConfig;
  tvmUsd: number;
  rewards7dUsd: number;
  activeWallets7d: number;
  score: number;
}

interface UseTrendingMoatsArgs {
  configs?: MoatConfig[];
  tvmMap?: Record<string, number>;
  limit?: number;
}

function eventMs(e: MoatEvent): number {
  const t = new Date(e.timestamp).getTime();
  return isFinite(t) ? t : 0;
}

/**
 * Derives top trending moats by composite score over the last 7 days.
 *
 * Score = avg of three signals (each normalized 0..1 by its max across moats):
 *   - TVM (USD)
 *   - Rewards distributed (USD) over last 7d
 *   - Unique active wallets over last 7d (Staked|Locked|Burned|RewardClaimed|LockExited)
 */
export function useTrendingMoats({
  configs,
  tvmMap,
  limit = 10,
}: UseTrendingMoatsArgs): { trending: TrendingMoat[]; isLoading: boolean } {
  const ev = useProtocolEvents();

  // Map each rewardToken address → {symbol, decimals, network} from configs
  const rewardTokenInfo = useMemo(() => {
    const m = new Map<string, { decimals: number; network: string }>();
    for (const c of configs ?? []) {
      for (const t of c.rewardTokens ?? []) {
        if (!t.tokenAddress) continue;
        const key = t.tokenAddress.toLowerCase();
        if (!m.has(key)) {
          m.set(key, {
            decimals: typeof t.decimals === "number" ? t.decimals : 18,
            network: c.network || "avax",
          });
        }
      }
    }
    return m;
  }, [configs]);

  // Pricing — gather every reward-token address and ask DefiLlama + Dexscreener
  const allLlamaIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of configs ?? []) {
      for (const t of c.rewardTokens ?? []) {
        if (t.tokenAddress) ids.add(getLlamaId(c.network, t.tokenAddress));
      }
    }
    return [...ids];
  }, [configs]);

  const { data: priceMap } = useTokenPrices(allLlamaIds);

  const allTokenAddrs = useMemo(() => {
    const s = new Set<string>();
    for (const c of configs ?? []) {
      for (const t of c.rewardTokens ?? []) {
        if (t.tokenAddress) s.add(t.tokenAddress.toLowerCase());
      }
    }
    return [...s];
  }, [configs]);

  const { data: dexInfoMap } = useDexscreenerInfo(allTokenAddrs);

  function priceFor(network: string, tokenAddr: string): number {
    const a = tokenAddr.toLowerCase();
    const llama = priceMap?.[getLlamaId(network, a).toLowerCase()] ?? 0;
    if (llama > 0) return llama;
    const dex = dexInfoMap?.[a]?.price ?? 0;
    if (dex > 0) return dex;
    if (a === USDC_ADDR) return 1;
    return 0;
  }

  // ---- compute per-moat 7d rewards USD + active wallets ----
  const sinceMs = Date.now() - SEVEN_DAYS_MS;

  const rewards7dByMoat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of ev.rewardsDeposited) {
      const ms = eventMs(e);
      if (!ms || ms < sinceMs) continue;
      const moat = e.contractAddress.toLowerCase();
      const tokenAddr = (e.args?.token as string | undefined)?.toLowerCase();
      const amt = e.args?.amount as string | undefined;
      if (!tokenAddr || !amt) continue;
      const info = rewardTokenInfo.get(tokenAddr);
      const decimals = info?.decimals ?? (tokenAddr === WAVAX_ADDR ? 18 : 18);
      const network = info?.network ?? "avax";
      let raw = 0;
      try {
        raw = Number(formatUnits(BigInt(amt), decimals));
      } catch {
        continue;
      }
      const price = priceFor(network, tokenAddr);
      const usd = raw * price;
      if (!isFinite(usd) || usd <= 0) continue;
      m[moat] = (m[moat] ?? 0) + usd;
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev.rewardsDeposited, sinceMs, rewardTokenInfo, priceMap, dexInfoMap]);

  const wallets7dByMoat = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    const sources = [ev.staked, ev.locked, ev.burned, ev.rewardClaimed, ev.lockExited];
    for (const arr of sources) {
      for (const e of arr) {
        const ms = eventMs(e);
        if (!ms || ms < sinceMs) continue;
        const moat = e.contractAddress.toLowerCase();
        const user = (e.args?.user as string | undefined)?.toLowerCase();
        if (!user) continue;
        const s = m[moat] ?? new Set<string>();
        s.add(user);
        m[moat] = s;
      }
    }
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(m)) out[k] = v.size;
    return out;
  }, [ev.staked, ev.locked, ev.burned, ev.rewardClaimed, ev.lockExited, sinceMs]);

  const trending = useMemo<TrendingMoat[]>(() => {
    if (!configs) return [];
    const rows = configs
      // Exclude deprecated moats from the trending feed
      .filter((c) => c.status === "Verified" || c.status === "Community")
      .map((c) => {
        const key = c.contractAddress.toLowerCase();
        return {
          config: c,
          tvmUsd: tvmMap?.[key] ?? 0,
          rewards7dUsd: rewards7dByMoat[key] ?? 0,
          activeWallets7d: wallets7dByMoat[key] ?? 0,
        };
      })
      // Must have at least one positive signal
      .filter((r) => r.tvmUsd > 0 || r.rewards7dUsd > 0 || r.activeWallets7d > 0);

    const maxTvm = Math.max(1, ...rows.map((r) => r.tvmUsd));
    const maxRew = Math.max(1, ...rows.map((r) => r.rewards7dUsd));
    const maxWal = Math.max(1, ...rows.map((r) => r.activeWallets7d));

    return rows
      .map((r) => ({
        ...r,
        score: (r.tvmUsd / maxTvm + r.rewards7dUsd / maxRew + r.activeWallets7d / maxWal) / 3,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [configs, tvmMap, rewards7dByMoat, wallets7dByMoat, limit]);

  // We only block rendering until configs are present. The 7d event streams
  // can still be paginating in the background — trending will simply show 0s
  // for those signals until they arrive, then re-rank automatically.
  return { trending, isLoading: !configs };
}

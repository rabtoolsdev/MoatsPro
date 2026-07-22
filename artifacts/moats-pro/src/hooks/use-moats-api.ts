import { useQuery } from "@tanstack/react-query";
import { moatsApi } from "@/lib/moats-api";

export function useEvents(contractAddress?: string) {
  return useQuery({
    queryKey: ["moats", "events", contractAddress],
    queryFn: () => moatsApi.getEvents({ contractAddress }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * Fetch the most recent RewardsDeposited events for a single moat.
 * Used to derive accurate per-token "last distributed" timestamps —
 * the lastProcessed field on the config object is set when the config
 * record is updated by the backend and can be severely stale/wrong.
 */
export function useRewardsDepositedEvents(contractAddress?: string) {
  return useQuery({
    queryKey: ["moats", "events", contractAddress, "RewardsDeposited"],
    queryFn: () =>
      moatsApi.getEvents({ contractAddress, eventType: "RewardsDeposited", limit: 100 }),
    enabled: !!contractAddress,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

/**
 * Fetch every RewardsDeposited event ever emitted across all moats. Used to
 * compute the canonical "total rewards distributed" per token — matches what
 * moats.app shows, including moats that have removed a reward token from
 * their current rewardTokens[] config but historically deposited it.
 */
export function useAllRewardsDeposited() {
  return useQuery({
    queryKey: ["moats", "events", "rewards-deposited", "all"],
    queryFn: () =>
      moatsApi.getEvents({ eventType: "RewardsDeposited", limit: 10000 }),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useAllMoatConfigs() {
  return useQuery({
    queryKey: ["moats", "config", "all"],
    queryFn: () => moatsApi.getAllMoatConfigs(),
    // Deprecated moats are excluded everywhere — we don't want to waste
    // on-chain calls or DexScreener requests on them.
    select: (data) => data.filter((m) => m.status !== "Deprecated"),
    staleTime: 300_000,
    refetchInterval: 300_000,
  });
}

export function useMoatConfig(contractAddress: string | undefined) {
  return useQuery({
    queryKey: ["moats", "config", contractAddress],
    queryFn: () => moatsApi.getMoatConfig(contractAddress!),
    enabled: !!contractAddress,
    staleTime: 120_000,
  });
}

export function useAllMoatPoints(contractAddress?: string) {
  return useQuery({
    queryKey: ["moats", "points", "all", contractAddress],
    queryFn: () => moatsApi.getAllMoatPoints(contractAddress),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useMoatPointsV2(contractAddress: string | undefined, network?: string) {
  return useQuery({
    queryKey: ["moats", "points", "v2", network, contractAddress],
    queryFn: () => moatsApi.getMoatPointsV2(contractAddress!, network),
    enabled: !!contractAddress,
    staleTime: 30_000,
  });
}

export function useUserMoatPointsV2(address: string | undefined, contractAddress: string | undefined, network?: string) {
  return useQuery({
    queryKey: ["moats", "points", "v2", "user", address, network, contractAddress],
    queryFn: () => moatsApi.getUserMoatPointsV2(address!, contractAddress!, network),
    enabled: !!address && !!contractAddress,
    staleTime: 30_000,
  });
}

export function useMapsLeaderboard() {
  return useQuery({
    queryKey: ["moats", "maps", "leaderboard"],
    queryFn: () => moatsApi.getMapsLeaderboard(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    select: (data) =>
      (data?.scores ?? [])
        .map((s, i) => ({
          address: s.address,
          username: s.username,
          points: s.mapScore,
          rank: i + 1,
        })),
  });
}

export function useMapsEpoch() {
  return useQuery({
    queryKey: ["moats", "maps", "epoch"],
    queryFn: () => moatsApi.getMapsLeaderboard(),
    staleTime: 60_000,
    refetchInterval: 60_000,
    select: (data) => data?.currentEpoch,
  });
}

export function useMapsScore(address: string | undefined) {
  return useQuery({
    queryKey: ["moats", "maps", "score", address],
    queryFn: () =>
      moatsApi.getMapsLeaderboard().then((data) => {
        const entry = data?.scores?.find(
          (s) => s.address.toLowerCase() === address!.toLowerCase()
        );
        if (!entry) return null;
        const rank = (data?.scores?.indexOf(entry) ?? 0) + 1;
        return { address: entry.address, username: entry.username, points: entry.mapScore, rank };
      }),
    enabled: !!address,
    staleTime: 60_000,
  });
}

export function useSwapPoints(address: string | undefined) {
  return useQuery({
    queryKey: ["moats", "swap-points", address?.toLowerCase()],
    queryFn: () => moatsApi.getSwapPoints(address!),
    enabled: !!address,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useUserEvents(address: string | undefined) {
  return useQuery({
    queryKey: ["moats", "events", "user", address],
    // getEventsByUser paginates internally (API caps at 1000 / request) and
    // returns the full MoatEvent[] up to maxEvents. The cap must stay well
    // above any single wallet's lifetime event count — otherwise the newest
    // event pushes the oldest off the end of the window and lifetime totals
    // (e.g. "total USDC claimed") appear to DECREASE after a new claim.
    queryFn: () => moatsApi.getEventsByUser(address!, 100000),
    enabled: !!address,
    staleTime: 60_000,
  });
}

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

export function useMoatPointsV2(contractAddress: string | undefined) {
  return useQuery({
    queryKey: ["moats", "points", "v2", contractAddress],
    queryFn: () => moatsApi.getMoatPointsV2(contractAddress!),
    enabled: !!contractAddress,
    staleTime: 30_000,
  });
}

export function useUserMoatPointsV2(address: string | undefined, contractAddress: string | undefined) {
  return useQuery({
    queryKey: ["moats", "points", "v2", "user", address, contractAddress],
    queryFn: () => moatsApi.getUserMoatPointsV2(address!, contractAddress!),
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

export function useUserEvents(address: string | undefined) {
  return useQuery({
    queryKey: ["moats", "events", "user", address],
    queryFn: () => moatsApi.getEventsByUser(address!, 500),
    enabled: !!address,
    staleTime: 60_000,
    select: (data) => data?.results ?? [],
  });
}

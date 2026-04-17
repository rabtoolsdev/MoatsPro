import { useQuery } from "@tanstack/react-query";
import { moatsApi } from "@/lib/moats-api";

export function useEvents() {
  return useQuery({
    queryKey: ["moats", "events"],
    queryFn: () => moatsApi.getEvents(),
    staleTime: 30_000,
    refetchInterval: 60_000,
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

export function useMoatPointsV2(contractAddress: string) {
  return useQuery({
    queryKey: ["moats", "points", "v2", contractAddress],
    queryFn: () => moatsApi.getAllMoatPointsV2(contractAddress),
    staleTime: 30_000,
    enabled: !!contractAddress,
  });
}

export function useUserMoatPointsV2(address: string | undefined, contractAddress: string) {
  return useQuery({
    queryKey: ["moats", "points", "v2", "user", address, contractAddress],
    queryFn: () => moatsApi.getUserMoatPointsV2(address!, contractAddress),
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
  });
}

export function useMapsScore(address: string | undefined) {
  return useQuery({
    queryKey: ["moats", "maps", "score", address],
    queryFn: () => moatsApi.getMapsScore(address!),
    enabled: !!address,
    staleTime: 30_000,
  });
}

export function useAllTags() {
  return useQuery({
    queryKey: ["moats", "tags"],
    queryFn: () => moatsApi.getAllTags(),
    staleTime: 300_000,
  });
}

export function useMoatTags(contractAddress: string | undefined) {
  return useQuery({
    queryKey: ["moats", "tags", contractAddress],
    queryFn: () => moatsApi.getMoatTags(contractAddress!),
    enabled: !!contractAddress,
    staleTime: 300_000,
  });
}

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { moatsApi, type MoatEvent } from "@/lib/moats-api";

const STALE = 5 * 60 * 1000;
const REFETCH = 10 * 60 * 1000;

function normalizeIndexerNetwork(network?: string): string {
  const value = (network || "avalanche").toLowerCase();
  if (value === "avax") return "avalanche";
  if (value === "mainnet" || value === "eth") return "ethereum";
  if (value === "bnb") return "bsc";
  if (value === "grotto") return "thegrotto";
  if (value === "robinhoodchain") return "robinhood";
  return value;
}

function uniqueNetworks(networks?: string[]): string[] {
  return [...new Set((networks ?? []).map(normalizeIndexerNetwork).filter(Boolean))].sort();
}

function useEventStream(eventType: string, networks?: string[], maxEvents = 100000) {
  const requestedNetworks = uniqueNetworks(networks);

  const queries = useQueries({
    queries: requestedNetworks.map((network) => ({
      queryKey: ["moats", "events", "all", eventType, maxEvents, network],
      queryFn: () => moatsApi.getAllEvents(eventType, maxEvents, network),
      staleTime: STALE,
      refetchInterval: REFETCH,
    })),
  });
  const data = useMemo(() => queries.flatMap((query) => query.data ?? []), [queries]);
  return {
    data,
    isLoading: queries.some((query) => query.isLoading),
    isError: queries.some((query) => query.isError),
    isSuccess: queries.length > 0 && queries.every((query) => query.isSuccess),
  };
}

/**
 * Aggregated protocol-wide event streams used by the Analytics page. Each
 * event type is fetched once and react-query-cached for 5min. All derivations
 * (daily buckets, USD valuation) happen client-side from these payloads.
 */
export function useProtocolEvents(networks?: string[]) {
  const rewardsDeposited = useEventStream("RewardsDeposited", networks);
  const staked = useEventStream("Staked", networks);
  const locked = useEventStream("Locked", networks);
  const burned = useEventStream("Burned", networks);
  const withdrawn = useEventStream("Withdrawn", networks);
  const rewardClaimed = useEventStream("RewardClaimed", networks);
  const lockExited = useEventStream("LockExited", networks);

  const isLoading =
    rewardsDeposited.isLoading ||
    staked.isLoading ||
    locked.isLoading ||
    burned.isLoading ||
    withdrawn.isLoading ||
    rewardClaimed.isLoading ||
    lockExited.isLoading;

  return {
    rewardsDeposited: rewardsDeposited.data ?? ([] as MoatEvent[]),
    staked: staked.data ?? ([] as MoatEvent[]),
    locked: locked.data ?? ([] as MoatEvent[]),
    burned: burned.data ?? ([] as MoatEvent[]),
    withdrawn: withdrawn.data ?? ([] as MoatEvent[]),
    rewardClaimed: rewardClaimed.data ?? ([] as MoatEvent[]),
    lockExited: lockExited.data ?? ([] as MoatEvent[]),
    isLoading,
    isError: [rewardsDeposited, staked, locked, burned, withdrawn, rewardClaimed, lockExited].some((stream) => stream.isError),
    isSuccess: [rewardsDeposited, staked, locked, burned, withdrawn, rewardClaimed, lockExited].every((stream) => stream.isSuccess),
  };
}

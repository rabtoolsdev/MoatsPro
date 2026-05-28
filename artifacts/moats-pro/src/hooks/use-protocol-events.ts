import { useQuery } from "@tanstack/react-query";
import { moatsApi, type MoatEvent } from "@/lib/moats-api";

const STALE = 5 * 60 * 1000;
const REFETCH = 10 * 60 * 1000;

function useEventStream(eventType: string, maxEvents = 100000) {
  return useQuery({
    queryKey: ["moats", "events", "all", eventType, maxEvents],
    queryFn: () => moatsApi.getAllEvents(eventType, maxEvents),
    staleTime: STALE,
    refetchInterval: REFETCH,
  });
}

/**
 * Aggregated protocol-wide event streams used by the Analytics page. Each
 * event type is fetched once and react-query-cached for 5min. All derivations
 * (daily buckets, USD valuation) happen client-side from these payloads.
 */
export function useProtocolEvents() {
  const rewardsDeposited = useEventStream("RewardsDeposited");
  const staked = useEventStream("Staked");
  const locked = useEventStream("Locked");
  const burned = useEventStream("Burned");
  const withdrawn = useEventStream("Withdrawn");
  const rewardClaimed = useEventStream("RewardClaimed");
  const lockExited = useEventStream("LockExited");

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
  };
}

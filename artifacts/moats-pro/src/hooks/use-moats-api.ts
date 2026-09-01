import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { moatsApi } from "@/lib/moats-api";
import type { MoatEvent, MoatConfig } from "@/lib/moats-api";
import { REWARDS_DEPOSITED_EVENT_ABI, MOAT_ALL_EVENTS_ABI } from "@/lib/moat-abi";
import { parseEventLogs } from "viem";
import { networkToChainId } from "@/lib/wagmi-config";

export function useEvents(contractAddress?: string) {
  return useQuery({
    queryKey: ["moats", "events", contractAddress],
    queryFn: () => moatsApi.getEvents({ contractAddress }),
    staleTime: 10_000,
    refetchInterval: 30_000,
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
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

/**
 * Fetch RewardsDeposited logs for ALL moats across ALL chains in one getLogs
 * call per chain. Used by the home/explore page to supplement totalRewardsDeposited
 * on every moat card without making one RPC call per card.
 *
 * usePublicClient is called for every supported chain at hook top-level (valid
 * React hook usage — fixed number of chains, no loops) and captured via closure
 * into the queryFn, avoiding any @wagmi/core import.
 */
export function useAllOnChainRewardsDeposited(configs: MoatConfig[] | undefined) {
  // Pre-call usePublicClient for each supported chain — hooks at top level, stable order.
  const c43114 = usePublicClient({ chainId: 43114 });  // avalanche
  const c1     = usePublicClient({ chainId: 1 });      // mainnet
  const c8453  = usePublicClient({ chainId: 8453 });   // base
  const c56    = usePublicClient({ chainId: 56 });     // bsc
  const c10143 = usePublicClient({ chainId: 10143 });  // monad
  const c36463 = usePublicClient({ chainId: 36463 });  // grotto
  const c46975 = usePublicClient({ chainId: 46975 });  // blaze
  const c4663  = usePublicClient({ chainId: 4663 });   // robinhood

  return useQuery({
    queryKey: [
      "moats", "events", "onchain-rewards", "all",
      configs?.map((c) => `${c.contractAddress}:${c.network}`).sort().join(","),
    ],
    enabled: !!configs?.length,
    staleTime: 120_000,
    refetchInterval: 300_000,
    queryFn: async (): Promise<MoatEvent[]> => {
      if (!configs?.length) return [];

      const clientByChainId: Record<number, typeof c43114> = {
        43114: c43114, 1: c1, 8453: c8453, 56: c56,
        10143: c10143, 36463: c36463, 46975: c46975, 4663: c4663,
      };

      // Group configs by chainId
      const byChain = new Map<number, MoatConfig[]>();
      for (const cfg of configs) {
        const cid = networkToChainId(cfg.network);
        if (!cid) continue;
        if (!byChain.has(cid)) byChain.set(cid, []);
        byChain.get(cid)!.push(cfg);
      }

      const allEvents: MoatEvent[] = [];

      for (const [chainId, chainConfigs] of byChain) {
        const client = clientByChainId[chainId];
        if (!client) continue;

        const addresses = chainConfigs.map((c) => c.contractAddress as `0x${string}`);
        const network = chainConfigs[0].network ?? "avalanche";
        const WIDE = 50_000n;
        const NARROW = 2_048n;
        let currentBlock: bigint;
        try { currentBlock = await client.getBlockNumber(); } catch { continue; }

        let logs: Awaited<ReturnType<typeof client.getLogs>>;
        try {
          logs = await client.getLogs({
            address: addresses,
            event: REWARDS_DEPOSITED_EVENT_ABI[0],
            fromBlock: currentBlock > WIDE ? currentBlock - WIDE : 0n,
            toBlock: currentBlock,
          });
        } catch {
          try {
            logs = await client.getLogs({
              address: addresses,
              event: REWARDS_DEPOSITED_EVENT_ABI[0],
              fromBlock: currentBlock > NARROW ? currentBlock - NARROW : 0n,
              toBlock: currentBlock,
            });
          } catch { continue; }
        }

        if (!logs.length) continue;

        const uniqueBlocks = [...new Set(logs.map((l) => l.blockNumber!))];
        const blocks = await Promise.all(
          uniqueBlocks.map((bn) => client.getBlock({ blockNumber: bn })),
        );
        const blockTs = new Map(blocks.map((b) => [b.number, Number(b.timestamp) * 1000]));

        for (const [i, log] of logs.entries()) {
          const args = log.args as { token?: string; amount?: bigint };
          allEvents.push({
            _id: `onchain-${log.transactionHash}-${log.logIndex ?? i}`,
            network,
            contractAddress: (log.address ?? "").toLowerCase(),
            eventType: "RewardsDeposited",
            blockNumber: Number(log.blockNumber ?? 0n),
            transactionHash: log.transactionHash ?? "",
            logIndex: log.logIndex ?? i,
            timestamp: new Date(blockTs.get(log.blockNumber!) ?? Date.now()).toISOString(),
            args: {
              token: args.token ?? "",
              amount: String(args.amount ?? "0"),
            },
          });
        }
      }

      return allEvents;
    },
  });
}

/**
 * Fetch ALL MoatV3 event types directly from the chain for every moat
 * address, covering the last ~80,000 blocks (~40h on Avalanche @2s/block).
 *
 * Use this to supplement the activity feed when the moat-api.fortifi.network
 * indexer falls behind. Results are mapped to MoatEvent shape and can be
 * diffed against the API set by transactionHash+logIndex.
 */
export function useAllOnChainRecentEvents(configs: MoatConfig[] | undefined) {
  // Pre-call usePublicClient for each supported chain — hooks at top level, stable order.
  const c43114 = usePublicClient({ chainId: 43114 });  // avalanche
  const c1     = usePublicClient({ chainId: 1 });      // mainnet
  const c8453  = usePublicClient({ chainId: 8453 });   // base
  const c56    = usePublicClient({ chainId: 56 });     // bsc
  const c10143 = usePublicClient({ chainId: 10143 });  // monad
  const c36463 = usePublicClient({ chainId: 36463 });  // grotto
  const c46975 = usePublicClient({ chainId: 46975 });  // blaze
  const c4663  = usePublicClient({ chainId: 4663 });   // robinhood

  return useQuery({
    queryKey: [
      "moats", "events", "onchain-all", "recent",
      configs?.map((c) => `${c.contractAddress}:${c.network}`).sort().join(","),
    ],
    enabled: !!configs?.length,
    staleTime: 10_000,
    refetchInterval: 30_000,
    queryFn: async (): Promise<MoatEvent[]> => {
      if (!configs?.length) return [];

      const clientByChainId: Record<number, typeof c43114> = {
        43114: c43114, 1: c1, 8453: c8453, 56: c56,
        10143: c10143, 36463: c36463, 46975: c46975, 4663: c4663,
      };

      // Group configs by chainId
      const byChain = new Map<number, MoatConfig[]>();
      for (const cfg of configs) {
        const cid = networkToChainId(cfg.network);
        if (!cid) continue;
        if (!byChain.has(cid)) byChain.set(cid, []);
        byChain.get(cid)!.push(cfg);
      }

      const allEvents: MoatEvent[] = [];

      for (const [chainId, chainConfigs] of byChain) {
        const client = clientByChainId[chainId];
        if (!client) continue;

        const addresses = chainConfigs.map((c) => c.contractAddress as `0x${string}`);
        const network = chainConfigs[0].network ?? "avalanche";

        let currentBlock: bigint;
        try { currentBlock = await client.getBlockNumber(); } catch { continue; }

        // Try ~80k blocks (~40h). Fall back to 10k if the RPC rejects the range.
        const WIDE = 80_000n;
        const NARROW = 10_000n;

        let rawLogs: Awaited<ReturnType<typeof client.getLogs>>;
        try {
          rawLogs = await client.getLogs({
            address: addresses,
            fromBlock: currentBlock > WIDE ? currentBlock - WIDE : 0n,
            toBlock: currentBlock,
          });
        } catch {
          try {
            rawLogs = await client.getLogs({
              address: addresses,
              fromBlock: currentBlock > NARROW ? currentBlock - NARROW : 0n,
              toBlock: currentBlock,
            });
          } catch { continue; }
        }

        if (!rawLogs.length) continue;

        // Decode only logs that match known MoatV3 events; silently skip the rest.
        const parsed = parseEventLogs({
          abi: MOAT_ALL_EVENTS_ABI,
          logs: rawLogs,
          strict: false,
        });

        if (!parsed.length) continue;

        // Resolve timestamps — one getBlock call per unique block number.
        const uniqueBlocks = [...new Set(parsed.map((l) => l.blockNumber!))];
        const blocks = await Promise.all(
          uniqueBlocks.map((bn) => client.getBlock({ blockNumber: bn })),
        );
        const blockTs = new Map(blocks.map((b) => [b.number, Number(b.timestamp) * 1000]));

        for (const log of parsed) {
          const args = log.args as Record<string, unknown>;
          allEvents.push({
            _id: `onchain-${log.transactionHash}-${log.logIndex ?? 0}`,
            network,
            contractAddress: (log.address ?? "").toLowerCase(),
            eventType: log.eventName,
            blockNumber: Number(log.blockNumber ?? 0n),
            transactionHash: log.transactionHash ?? "",
            logIndex: log.logIndex ?? 0,
            timestamp: new Date(blockTs.get(log.blockNumber!) ?? Date.now()).toISOString(),
            args: {
              user: (args.user as string | undefined) ?? undefined,
              amount: args.amount !== undefined ? String(args.amount) : undefined,
              token: (args.token as string | undefined) ?? undefined,
              duration: args.duration !== undefined ? String(args.duration) : undefined,
              lockIndex: args.lockIndex !== undefined ? String(args.lockIndex) : undefined,
              fee: args.fee !== undefined ? String(args.fee) : undefined,
            },
          });
        }
      }

      // Sort newest-first
      return allEvents.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    },
  });
}

/**
 * Fetch RewardsDeposited events directly from the chain via getLogs.
 *
 * This supplements the moat-api.fortifi.network indexer which can miss deposits
 * made by automated reward contracts (the tx sender is the automation contract,
 * not the moat admin, so the backend indexer may not pick it up).
 *
 * Returns results mapped to MoatEvent shape so they can be merged with API
 * results without any changes to downstream components.
 */
export function useOnChainRewardsDeposited(
  contractAddress: string | undefined,
  chainId: number | undefined,
  network: string | undefined,
) {
  const publicClient = usePublicClient({ chainId });

  return useQuery({
    queryKey: ["moats", "events", "onchain-rewards", chainId, contractAddress],
    enabled: !!contractAddress && !!publicClient && !!chainId,
    staleTime: 60_000,
    refetchInterval: 120_000,
    queryFn: async (): Promise<MoatEvent[]> => {
      if (!publicClient || !contractAddress) return [];

      const currentBlock = await publicClient.getBlockNumber();

      // Try to fetch last ~50,000 blocks (≈1 day on Avalanche @2s/block).
      // Many public RPCs cap eth_getLogs at 2,048 blocks; fall back to that
      // window if the wide query is rejected.
      const WIDE = 50_000n;
      const NARROW = 2_048n;

      let logs: Awaited<ReturnType<typeof publicClient.getLogs>>;
      try {
        logs = await publicClient.getLogs({
          address: contractAddress as `0x${string}`,
          event: REWARDS_DEPOSITED_EVENT_ABI[0],
          fromBlock: currentBlock > WIDE ? currentBlock - WIDE : 0n,
          toBlock: currentBlock,
        });
      } catch {
        logs = await publicClient.getLogs({
          address: contractAddress as `0x${string}`,
          event: REWARDS_DEPOSITED_EVENT_ABI[0],
          fromBlock: currentBlock > NARROW ? currentBlock - NARROW : 0n,
          toBlock: currentBlock,
        });
      }

      if (!logs.length) return [];

      // Resolve timestamps — one getBlock call per unique block number.
      const uniqueBlocks = [...new Set(logs.map((l) => l.blockNumber!))];
      const blocks = await Promise.all(
        uniqueBlocks.map((bn) => publicClient.getBlock({ blockNumber: bn })),
      );
      const blockTs = new Map(blocks.map((b) => [b.number, Number(b.timestamp) * 1000]));

      return logs.map((log, i): MoatEvent => {
        const args = log.args as { token?: string; amount?: bigint };
        return {
          _id: `onchain-${log.transactionHash}-${log.logIndex ?? i}`,
          network: network ?? "avalanche",
          contractAddress: contractAddress.toLowerCase(),
          eventType: "RewardsDeposited",
          blockNumber: Number(log.blockNumber ?? 0n),
          transactionHash: log.transactionHash ?? "",
          logIndex: log.logIndex ?? i,
          timestamp: new Date(blockTs.get(log.blockNumber!) ?? Date.now()).toISOString(),
          args: {
            token: args.token ?? "",
            amount: String(args.amount ?? "0"),
          },
        };
      });
    },
  });
}

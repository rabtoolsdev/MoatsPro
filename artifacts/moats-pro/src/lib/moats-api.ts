const BASE_URL = "https://moat-api.fortifi.network/api";

// Our own backend (api-server). Used for endpoints we host ourselves
// (swap recording, swap points, admin stats). Keep separate from the
// Fortifi BASE_URL above — those are read-only third-party data.
const OWN_API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Moats API Error: ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

async function ownFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${OWN_API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Moats Pro API Error: ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

// Swap Points: lifetime USD value of every asset the user has swapped
// through Moats Pro (1 USD swapped = 1 point). Backed by a SUM over the
// existing `swaps` table — no separate points ledger.
export interface SwapPointsResponse {
  walletAddress: string;
  points: number;
  swapCount: number;
}

// ---- Event types ----
export interface MoatEvent {
  _id: string;
  network: string;
  contractAddress: string;
  eventType: "Staked" | "Withdrawn" | "Locked" | "Burned" | "RewardClaimed" | "LockExited" | "EarlyExit" | string;
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  timestamp: string;
  args: {
    user?: string;
    amount?: string;
    duration?: string;
    token?: string;
    [key: string]: unknown;
  };
}

export interface EventsResponse {
  total: number;
  results: MoatEvent[];
}

// ---- MAPS / leaderboard types ----
export interface MapsScoreRaw {
  address: string;
  username?: string;
  mapScore: number;
}

export interface MapsScore {
  address: string;
  username?: string;
  points: number;
  rank: number;
  weight?: number;
}

export interface MapsEpoch {
  epochNumber: number;
  startTime: string;
  endTime: string;
  isComplete: boolean;
}

export interface MapsLeaderboardResponse {
  currentEpoch?: MapsEpoch;
  isFallback?: boolean;
  scores: MapsScoreRaw[];
}

// ---- Moat points ----
export interface MoatPoint {
  walletAddress: string;
  contractAddress: string;
  points: number;
  lastUpdated: number;
}

export interface MoatPointV2 {
  walletAddress: string;
  contractAddress: string;
  points: number;
  timeWeightedPoints: number;
  lastUpdated: number;
}

export interface MoatLeaderboardEntry {
  rank: number;
  address: string;
  username?: string;
  points: number;
  basePoints: number;
  boosted: boolean;
  boostMultiplier: number;
  weight: number;
}

export interface MoatPointsV2Response {
  currentEpoch?: {
    epochNumber: number;
    startTime: string;
    endTime: string | null;
    isComplete: boolean;
  };
  isTimeWeighted: boolean;
  leaderboard: MoatLeaderboardEntry[];
}

export interface UserMoatPointsV2Response {
  points: number;
  isTimeWeighted: boolean;
  fallbackInfo?: {
    staked: number;
    locked: number;
    burnt: number;
    total: number;
    tokenAmounts?: { staked: number; locked: number; burnt: number };
  };
}

// ---- Moat Config ----
export interface RewardToken {
  _id: string;
  tokenAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  tokenAmount: number;
  totalRewardsDeposited: number;
  totalRewardsClaimed: number;
  enabled: boolean;
  lastProcessed?: string;
  percentage?: number;
  frequencyHours?: number;
  useCustomFrequency?: boolean;
}

export interface BoostTier {
  minHolding: number;
  maxHolding: number | null;
  boostValue: number;
}

export interface BoostConfig {
  contractAddress: string;
  boostValue: number;
  tiers: BoostTier[];
  active: boolean;
}

/**
 * Returns every NFT boost contract that should be considered "active" for a
 * given moat. Honors the new `boostConfigs[]` array first (filtering by
 * `active: true`), and falls back to the legacy `nftBoostContract` field
 * when the array is missing/empty — which is how moats.app resolves it.
 */
export function getActiveBoosts(moat: MoatConfig | undefined | null): BoostConfig[] {
  if (!moat) return [];
  const fromConfigs = (moat.boostConfigs ?? [])
    .filter((b) => b.active && b.contractAddress)
    .map((b) => ({ ...b, tiers: b.tiers ?? [] }));
  if (fromConfigs.length > 0) return fromConfigs;
  if (moat.boostActive && moat.nftBoostContract) {
    return [{
      contractAddress: moat.nftBoostContract,
      boostValue: moat.boostValue ?? 1,
      tiers: [],
      active: true,
    }];
  }
  return [];
}

/**
 * Resolve the tier a holder falls into for a given boost, based on how many
 * boost NFTs they hold. Returns null when the boost has no tier configuration.
 */
export function getBoostTier(boost: BoostConfig, holding: number): BoostTier | null {
  if (!boost.tiers || boost.tiers.length === 0) return null;
  const sorted = [...boost.tiers].sort((a, b) => (a.minHolding ?? 0) - (b.minHolding ?? 0));
  for (const t of sorted) {
    const min = t.minHolding ?? 0;
    const max = t.maxHolding;
    if (holding >= min && (max == null || holding <= max)) return t;
  }
  return null;
}

/**
 * The boost multiplier that actually applies for a given holding. Honors the
 * tier table when present (BENSI-style tiered boosts); when tiers exist but the
 * holding matches none (e.g. below the first tier), there is no boost (1x).
 * Untiered boosts fall back to the flat top-level `boostValue`.
 */
export function getEffectiveBoostValue(boost: BoostConfig, holding: number): number {
  if (boost.tiers && boost.tiers.length > 0) {
    const tier = getBoostTier(boost, holding);
    return tier ? tier.boostValue : 1;
  }
  return boost.boostValue;
}

/** The highest multiplier any tier can grant (or the flat value when untiered). */
export function getMaxBoostValue(boost: BoostConfig): number {
  if (boost.tiers && boost.tiers.length > 0) {
    return Math.max(...boost.tiers.map((t) => t.boostValue));
  }
  return boost.boostValue;
}

export interface MoatTag {
  _id?: string;
  name: string;
  color?: string;
}

export interface MoatConfig {
  _id: string;
  contractAddress: string;
  network: string;
  moatVersion: number;
  status: "Verified" | "Community" | "Deprecated" | string;
  tags?: MoatTag[];
  fortWeight: number;
  rewardStrategy?: string;
  owner: string;
  publicAddress?: string;
  rewardTokens: RewardToken[];
  automatedRewards?: boolean;
  timeWeightedPointsEnabled?: boolean;
  timeWeightPercentage?: number;
  boostValue?: number;
  boostActive?: boolean;
  nftBoostContract?: string | null;
  /**
   * Per-NFT boost configuration (the canonical source on moats.app). A moat
   * can have multiple boost NFTs simultaneously; only entries with
   * `active: true` should be honored. The legacy top-level `nftBoostContract`
   * still applies when this array is absent or empty.
   */
  boostConfigs?: BoostConfig[];
  voteEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const moatsApi = {
  getEvents: (params?: { contractAddress?: string; eventType?: string; limit?: number; skip?: number }) => {
    const qs = new URLSearchParams();
    if (params?.contractAddress) qs.set("contractAddress", params.contractAddress);
    if (params?.eventType) qs.set("eventType", params.eventType);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.skip) qs.set("skip", String(params.skip));
    const query = qs.toString() ? `?${qs}` : "";
    return apiFetch<EventsResponse>(`/events${query}`);
  },

  // Fully paginated event stream for analytics. The API caps each response at
  // 1000 rows, so we loop until a short page is returned or maxEvents is hit.
  getAllEvents: async (eventType: string, maxEvents = 30000): Promise<MoatEvent[]> => {
    const PAGE = 1000;
    const all: MoatEvent[] = [];
    for (let skip = 0; skip < maxEvents; skip += PAGE) {
      const res = await apiFetch<EventsResponse>(
        `/events?eventType=${encodeURIComponent(eventType)}&limit=${PAGE}&skip=${skip}`,
      );
      const batch = res.results ?? [];
      all.push(...batch);
      if (batch.length < PAGE) break;
    }
    return all;
  },

  getAllMoatPoints: (contractAddress?: string) => {
    const qs = contractAddress ? `?contractAddress=${contractAddress}` : "";
    return apiFetch<MoatPoint[]>(`/moat-points/all${qs}`);
  },

  getMoatPointsV2: (contractAddress: string) =>
    apiFetch<MoatPointsV2Response>(`/moat-points/v2/all?contractAddress=${contractAddress}`),

  getUserMoatPointsV2: (address: string, contractAddress: string) =>
    apiFetch<UserMoatPointsV2Response>(`/moat-points/v2/user/${address}?contractAddress=${contractAddress}`),

  getMapsLeaderboard: () =>
    apiFetch<MapsLeaderboardResponse>("/maps/score/all"),

  getMapsScore: (address: string) =>
    apiFetch<MapsScore>(`/maps/score/${address}`),

  getEventsByUser: async (userAddress: string, maxEvents = 10000): Promise<MoatEvent[]> => {
    // API hard-caps each request at 1000 results; paginate with `skip` until
    // either the server returns a short page (end of data) or we hit maxEvents.
    const PAGE = 1000;
    const all: MoatEvent[] = [];
    for (let skip = 0; skip < maxEvents; skip += PAGE) {
      const res = await apiFetch<EventsResponse>(
        `/events?userAddress=${userAddress}&limit=${PAGE}&skip=${skip}`
      );
      const batch = res.results ?? [];
      all.push(...batch);
      if (batch.length < PAGE) break;
    }
    return all;
  },

  getAllMoatConfigs: () =>
    apiFetch<MoatConfig[]>("/moat-config"),

  getMoatConfig: (contractAddress: string) =>
    apiFetch<MoatConfig>(`/moat-config/${contractAddress}`),

  getSwapPoints: (address: string) =>
    ownFetch<SwapPointsResponse>(`/swap-points/${address.toLowerCase()}`),
};

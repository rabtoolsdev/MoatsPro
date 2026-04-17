const BASE_URL = "https://moat-api.fortifi.network/api";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Moats API Error: ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
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
}

export interface MoatConfig {
  _id: string;
  contractAddress: string;
  network: string;
  moatVersion: number;
  status: "Verified" | "Community" | "Deprecated" | string;
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
  createdAt: string;
  updatedAt: string;
}

export const moatsApi = {
  getEvents: (params?: { contractAddress?: string; eventType?: string }) => {
    const qs = new URLSearchParams();
    if (params?.contractAddress) qs.set("contractAddress", params.contractAddress);
    if (params?.eventType) qs.set("eventType", params.eventType);
    const query = qs.toString() ? `?${qs}` : "";
    return apiFetch<EventsResponse>(`/events${query}`);
  },

  getAllMoatPoints: (contractAddress?: string) => {
    const qs = contractAddress ? `?contractAddress=${contractAddress}` : "";
    return apiFetch<MoatPoint[]>(`/moat-points/all${qs}`);
  },

  getMoatPointsV2: (contractAddress: string) =>
    apiFetch<MoatPointV2[]>(`/moat-points/v2/all?contractAddress=${contractAddress}`),

  getUserMoatPointsV2: (address: string, contractAddress: string) =>
    apiFetch<MoatPointV2>(`/moat-points/v2/user/${address}?contractAddress=${contractAddress}`),

  getMapsLeaderboard: () =>
    apiFetch<MapsLeaderboardResponse>("/maps/score/all"),

  getMapsScore: (address: string) =>
    apiFetch<MapsScore>(`/maps/score/${address}`),

  getEventsByUser: (userAddress: string, limit = 100) =>
    apiFetch<EventsResponse>(`/events?userAddress=${userAddress}&limit=${limit}`),

  getAllMoatConfigs: () =>
    apiFetch<MoatConfig[]>("/moat-config"),

  getMoatConfig: (contractAddress: string) =>
    apiFetch<MoatConfig>(`/moat-config/${contractAddress}`),
};

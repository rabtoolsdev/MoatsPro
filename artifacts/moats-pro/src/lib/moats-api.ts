const BASE_URL = "https://moat-api.fortifi.network/api";

export interface MoatEvent {
  id: string;
  eventType: string;
  contractAddress: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

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

export interface MapsScore {
  walletAddress: string;
  score: number;
  rank?: number;
  epoch?: number;
}

export interface MoatTag {
  id: string;
  name: string;
  color: string;
}

export interface MoatConfig {
  contractAddress: string;
  name?: string;
  logoURL?: string;
  tags?: MoatTag[];
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`Moats API Error: ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export const moatsApi = {
  getEvents: () => apiFetch<MoatEvent[]>("/events"),

  getAllMoatPoints: (contractAddress?: string) => {
    const qs = contractAddress ? `?contractAddress=${contractAddress}` : "";
    return apiFetch<MoatPoint[]>(`/moat-points/all${qs}`);
  },

  getAllMoatPointsV2: (contractAddress: string) =>
    apiFetch<MoatPointV2[]>(`/moat-points/v2/all?contractAddress=${contractAddress}`),

  getUserMoatPointsV2: (address: string, contractAddress: string) =>
    apiFetch<MoatPointV2>(`/moat-points/v2/user/${address}?contractAddress=${contractAddress}`),

  getMapsLeaderboard: () => apiFetch<MapsScore[]>("/maps/score/all"),

  getMapsScore: (address: string) => apiFetch<MapsScore>(`/maps/score/${address}`),

  getAllTags: () => apiFetch<MoatTag[]>("/tags"),

  getMoatTags: (contractAddress: string) =>
    apiFetch<MoatTag[]>(`/moat-config/${contractAddress}/tags`),
};

export const KNOWN_MOATS: Array<{
  contractAddress: string;
  name: string;
  protocol: string;
  tokenSymbol: string;
  tokenAddress: string;
  logoURL?: string;
  chain: string;
  chainId: number;
  description: string;
}> = [
  {
    contractAddress: "0x0000000000000000000000000000000000000001",
    name: "ETH/USDC Moat",
    protocol: "Uniswap V3",
    tokenSymbol: "ETH/USDC",
    tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    chain: "Ethereum",
    chainId: 1,
    description: "Earn fees by providing liquidity to the ETH/USDC pool",
  },
];

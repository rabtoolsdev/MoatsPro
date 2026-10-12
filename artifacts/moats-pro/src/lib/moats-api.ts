import { DataSourceError, setDataSourceStatus } from "./data-source-status";

// Shared backend also caches/queues read-only Fortifi indexer requests.
const OWN_API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

const activeReads = new Map<string, Promise<unknown>>();
let indexerRetryAt = 0;

async function apiFetch<T>(path: string): Promise<T> {
  const existing = activeReads.get(path);
  if (existing) return existing as Promise<T>;
  if (Date.now() < indexerRetryAt) {
    throw new DataSourceError("Moats indexer requests are paused until its rate limit resets.", 503, indexerRetryAt);
  }
  const pending = (async () => {
    const res = await fetch(`${OWN_API_BASE}/moats-data?path=${encodeURIComponent(path)}`, {
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const retrySeconds = Number(res.headers.get("retry-after")) || 60;
      const retryAt = Date.now() + retrySeconds * 1000;
      if (res.status === 429 || res.status === 503) {
        indexerRetryAt = retryAt;
        setDataSourceStatus("Moats indexer", {
          message: "The provider is busy or rate-limited. Refresh requests are paused.",
          retryAt,
        });
      }
      throw new DataSourceError(`Moats data request failed (HTTP ${res.status}).`, res.status, retryAt);
    }
    if (res.headers.get("x-data-stale") === "true") {
      setDataSourceStatus("Moats indexer", { message: "The provider is unavailable; showing previously loaded data." });
    } else if (Date.now() >= indexerRetryAt) {
      setDataSourceStatus("Moats indexer");
    }
    return res.json() as Promise<T>;
  })().finally(() => activeReads.delete(path));
  activeReads.set(path, pending);
  return pending;
}

const histories = new Map<string, { events: MoatEvent[]; fullScanAt: number }>();
const historyReads = new Map<string, Promise<MoatEvent[]>>();

// Preserve lifetime history, but stop a refresh once it reaches known events.
// Periodic full scans reconcile indexer corrections rather than retaining
// deleted/replaced records forever.
function getEventHistory(filters: Record<string, string>, maxEvents: number): Promise<MoatEvent[]> {
  const key = JSON.stringify([filters, maxEvents]);
  const pending = historyReads.get(key);
  if (pending) return pending;
  const saved = histories.get(key);
  const incremental = !!saved && Date.now() - saved.fullScanAt < 30 * 60_000;
  const known = new Set((saved?.events ?? []).map((event) => event._id));
  const read = (async () => {
    const events: MoatEvent[] = [];
    let reachedKnown = false;
    for (let skip = 0; skip < maxEvents; skip += 1000) {
      const params = new URLSearchParams({ ...filters, limit: String(Math.min(1000, maxEvents - skip)), skip: String(skip) });
      const response = await apiFetch<EventsResponse>(`/events?${params}`);
      const batch = response.results ?? [];
      events.push(...batch);
      reachedKnown = incremental && batch.some((event) => known.has(event._id));
      if (reachedKnown || batch.length < Math.min(1000, maxEvents - skip)) break;
    }
    const merged = new Map<string, MoatEvent>();
    if (reachedKnown) for (const event of saved!.events) merged.set(event._id, event);
    for (const event of events) merged.set(event._id, event);
    const result = [...merged.values()]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, maxEvents);
    histories.set(key, { events: result, fullScanAt: incremental && reachedKnown ? saved!.fullScanAt : Date.now() });
    if (histories.size > 64) histories.delete(histories.keys().next().value!);
    return result;
  })().finally(() => historyReads.delete(key));
  historyReads.set(key, read);
  return read;
}

async function ownFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${OWN_API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`Moats Pro API Error: ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

async function ownPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${OWN_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Moats Pro API Error: ${res.status} for ${path}`);
  }
  return res.json() as Promise<T>;
}

// ---- Moat Calculator (giveaway entry) types ----
export interface CalculatorCriteria {
  transactionTypes: string[];
  tokenAddress: string;
  tokenAmount: number;
  entries: number;
}

export interface CalculatorWalletTxn {
  hash: string;
  type: string;
  amount: number;
  tokenSymbol?: string;
  timestamp: number;
  date: string;
  functionName?: string;
}

export interface CalculatorWalletResult {
  address: string;
  transactionCount: number;
  totalAmount: number;
  entries: number;
  tokenSymbol?: string;
  tokenName?: string;
  burnAmount: number;
  stakeAmount: number;
  lockAmount: number;
  burnCount: number;
  stakeCount: number;
  lockCount: number;
  transactions: CalculatorWalletTxn[];
}

export interface CalculatorResponse {
  results: CalculatorWalletResult[];
  totalWallets: number;
  totalEntries: number;
}

export interface CalculatorPayload {
  contractAddress: string;
  // All moat contracts to aggregate (current + any legacy contracts). When
  // omitted the backend falls back to [contractAddress].
  contractAddresses?: string[];
  criteriaList: CalculatorCriteria[];
  startDate?: string;
  endDate?: string;
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
  // Confirmed calls are activity records, not emitted logs; logIndex is -1.
  source?: "confirmed-transaction";
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

// Fortifi's Bensi record has temporarily returned null metadata for Avalanche
// USDC.e. Keep this address-specific correction close to the API boundary so
// every page (home, moat detail, portfolio, and activity) uses the same token
// identity and decimal scale.
const KNOWN_REWARD_TOKEN_METADATA: Record<
  string,
  { name: string; symbol: string; decimals: number }
> = {
  "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e": {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
  },
};

function normalizeRewardToken(token: RewardToken): RewardToken {
  const address =
    typeof token.tokenAddress === "string" ? token.tokenAddress.toLowerCase() : "";
  const known = KNOWN_REWARD_TOKEN_METADATA[address];
  const decimals =
    typeof token.decimals === "number" &&
    Number.isInteger(token.decimals) &&
    token.decimals >= 0 &&
    token.decimals <= 36
      ? token.decimals
      : 18;

  return {
    ...token,
    name: known?.name ?? (typeof token.name === "string" && token.name.trim() ? token.name : "Reward Token"),
    symbol: known?.symbol ?? (typeof token.symbol === "string" && token.symbol.trim() ? token.symbol : "TOKEN"),
    decimals: known?.decimals ?? decimals,
  };
}

function normalizeMoatConfig(config: MoatConfig): MoatConfig {
  return {
    ...config,
    rewardTokens: (Array.isArray(config.rewardTokens) ? config.rewardTokens : []).map(
      normalizeRewardToken,
    ),
  };
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
  getEvents: (params?: {
    contractAddress?: string;
    eventType?: string;
    network?: string;
    limit?: number;
    skip?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.contractAddress) qs.set("contractAddress", params.contractAddress);
    if (params?.eventType) qs.set("eventType", params.eventType);
    if (params?.network) qs.set("network", params.network);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.skip) qs.set("skip", String(params.skip));
    const query = qs.toString() ? `?${qs}` : "";
    return apiFetch<EventsResponse>(`/events${query}`);
  },

  // Fully paginated event stream for analytics. The API caps each response at
  // 1000 rows, so we loop until a short page is returned or maxEvents is hit.
  getAllEvents: async (
    eventType: string,
    maxEvents = 30000,
    network?: string,
  ): Promise<MoatEvent[]> => {
    return getEventHistory({ eventType, ...(network ? { network } : {}) }, maxEvents);
  },

  getAllMoatPoints: (contractAddress?: string) => {
    const qs = contractAddress ? `?contractAddress=${contractAddress}` : "";
    return apiFetch<MoatPoint[]>(`/moat-points/all${qs}`);
  },

  getMoatPointsV2: (contractAddress: string, network?: string) => {
    const qs = network ? `&network=${encodeURIComponent(network)}` : "";
    return apiFetch<MoatPointsV2Response>(`/moat-points/v2/all?contractAddress=${contractAddress}${qs}`);
  },

  getUserMoatPointsV2: (address: string, contractAddress: string, network?: string) => {
    const qs = network ? `&network=${encodeURIComponent(network)}` : "";
    return apiFetch<UserMoatPointsV2Response>(`/moat-points/v2/user/${address}?contractAddress=${contractAddress}${qs}`);
  },

  getMapsLeaderboard: () =>
    apiFetch<MapsLeaderboardResponse>("/maps/score/all"),

  getMapsScore: (address: string) =>
    apiFetch<MapsScore>(`/maps/score/${address}`),

  getEventsByUser: async (userAddress: string, maxEvents = 10000): Promise<MoatEvent[]> => {
    // API hard-caps each request at 1000 results; paginate with `skip` until
    // either the server returns a short page (end of data) or we hit maxEvents.
    return getEventHistory({ userAddress }, maxEvents);
  },

  getAllMoatConfigs: () =>
    apiFetch<MoatConfig[]>("/moat-config").then((configs) =>
      configs.map(normalizeMoatConfig),
    ),

  getMoatConfig: (contractAddress: string) =>
    apiFetch<MoatConfig>(`/moat-config/${contractAddress}`).then(normalizeMoatConfig),

  getSwapPoints: (address: string) =>
    ownFetch<SwapPointsResponse>(`/swap-points/${address.toLowerCase()}`),

  calculateMoatEntries: (payload: CalculatorPayload) =>
    ownPost<CalculatorResponse>("/calculator/calculate", payload),
};

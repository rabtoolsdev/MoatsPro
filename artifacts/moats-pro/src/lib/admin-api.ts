// Thin client for the admin API. No auth — the dashboard is open access.

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

export type Range = "24h" | "7d" | "30d" | "all";

export interface StatsTotals {
  count: number;
  volumeUsd: number;
  feeUsd: number;
  uniqueUsers: number;
  avgSwapUsd?: number;
}

export interface StatsResponse {
  range: Range;
  chainId: number | null;
  totals: StatsTotals;
  allTime: StatsTotals;
  byChain: Array<{ chainId: number; network: string; count: number; volumeUsd: number; feeUsd: number }>;
  byRouter: Array<{ router: string; count: number }>;
}

export interface SwapRow {
  id: number;
  walletAddress: string;
  chainId: number;
  network: string;
  txHash: string;
  feeTxHash: string | null;
  fromTokenSymbol: string;
  fromTokenAddress: string;
  fromTokenDecimals: number;
  toTokenSymbol: string;
  toTokenAddress: string;
  toTokenDecimals: number;
  fromAmountRaw: string;
  toAmountRaw: string;
  feeAmountRaw: string | null;
  fromAmount: number;
  toAmount: number;
  feeAmount: number | null;
  fromUsd: number | null;
  toUsd: number | null;
  feeUsd: number | null;
  router: string;
  toolName: string | null;
  slippageBps: number | null;
  status: string;
  createdAt: string;
}

export interface UserRow {
  walletAddress: string;
  swapCount: number;
  volumeUsd: number;
  feeUsd: number;
  firstSwap: string;
  lastSwap: string;
}

async function adminFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json() as Promise<T>;
}

export function fetchStats(range: Range, chainId: number | null) {
  const q = new URLSearchParams({ range });
  if (chainId !== null) q.set("chainId", String(chainId));
  return adminFetch<StatsResponse>(`/admin/stats?${q.toString()}`);
}

export function fetchSwaps(
  range: Range,
  chainId: number | null,
  address: string | null,
  limit = 50,
  offset = 0,
) {
  const q = new URLSearchParams({ range, limit: String(limit), offset: String(offset) });
  if (chainId !== null) q.set("chainId", String(chainId));
  if (address) q.set("address", address);
  return adminFetch<{ rows: SwapRow[]; total: number; limit: number; offset: number }>(
    `/admin/swaps?${q.toString()}`,
  );
}

export function fetchUsers(
  range: Range,
  chainId: number | null,
  limit = 100,
) {
  const q = new URLSearchParams({ range, limit: String(limit) });
  if (chainId !== null) q.set("chainId", String(chainId));
  return adminFetch<{ rows: UserRow[] }>(`/admin/users?${q.toString()}`);
}

export interface RecordSwapPayload {
  walletAddress: string;
  chainId: number;
  network: string;
  txHash: string;
  feeTxHash?: string | null;
  fromTokenSymbol: string;
  fromTokenAddress: string;
  fromTokenDecimals: number;
  toTokenSymbol: string;
  toTokenAddress: string;
  toTokenDecimals: number;
  fromAmountRaw: string;
  toAmountRaw: string;
  feeAmountRaw?: string | null;
  fromAmount: number;
  toAmount: number;
  feeAmount?: number | null;
  fromUsd?: number | null;
  toUsd?: number | null;
  feeUsd?: number | null;
  router: string;
  toolName?: string | null;
  slippageBps?: number | null;
  status?: string;
}

export async function recordSwap(payload: RecordSwapPayload) {
  try {
    const res = await fetch(`${API_BASE}/swaps`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn("[recordSwap] failed", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.warn("[recordSwap] error", err);
  }
}

export const EXPLORERS: Record<number, { name: string; tx: (h: string) => string; addr: (a: string) => string }> = {
  43114: {
    name: "Snowtrace",
    tx: (h) => `https://snowtrace.io/tx/${h}`,
    addr: (a) => `https://snowtrace.io/address/${a}`,
  },
  1: {
    name: "Etherscan",
    tx: (h) => `https://etherscan.io/tx/${h}`,
    addr: (a) => `https://etherscan.io/address/${a}`,
  },
  8453: {
    name: "BaseScan",
    tx: (h) => `https://basescan.org/tx/${h}`,
    addr: (a) => `https://basescan.org/address/${a}`,
  },
  36463: {
    name: "Subnet Explorer",
    tx: (h) => `https://subnets.avax.network/thegrotto/tx/${h}`,
    addr: (a) => `https://subnets.avax.network/thegrotto/address/${a}`,
  },
  46975: {
    name: "Subnet Explorer",
    tx: (h) => `https://subnets.avax.network/blaze/tx/${h}`,
    addr: (a) => `https://subnets.avax.network/blaze/address/${a}`,
  },
};

export function explorerTx(chainId: number, hash: string): string {
  return EXPLORERS[chainId]?.tx(hash) ?? `https://blockscan.com/tx/${hash}`;
}

export function explorerAddr(chainId: number, addr: string): string {
  return EXPLORERS[chainId]?.addr(addr) ?? `https://blockscan.com/address/${addr}`;
}

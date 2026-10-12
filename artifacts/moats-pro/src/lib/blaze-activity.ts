import { decodeFunctionData, type Hex } from "viem";
import { MOAT_V3_ABI } from "./moat-abi";
import type { MoatConfig, MoatEvent } from "./moats-api";

const DATA_API = "https://glacier-api.avax.network/v1/chains/46975";
const INPUT_METHODS = new Set(["0xa694fc3a", "0x1338736f", "0x42966c68"]);
const confirmedCache = new Map<string, Promise<NativeTransaction>>();
const MAX_CACHED_TRANSACTIONS = 200;

interface NativeTransaction {
  chainId: string;
  txHash: string;
  txStatus: string;
  blockNumber: string;
  blockTimestamp: number;
  blockTimestampMilliseconds?: number;
  from: { address: string };
  to?: { address: string };
  method?: { methodHash?: string };
  input?: string;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${DATA_API}${path}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Blaze activity source returned HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function getConfirmedTransaction(hash: string): Promise<NativeTransaction> {
  const key = hash.toLowerCase();
  const cached = confirmedCache.get(key);
  if (cached) return cached;
  const pending = getJson<{ nativeTransaction: NativeTransaction }>(
    `/transactions/${encodeURIComponent(hash)}`,
  ).then(({ nativeTransaction }) => {
    if (!nativeTransaction?.input || nativeTransaction.txHash?.toLowerCase() !== key) {
      throw new Error("Invalid confirmed Blaze transaction response");
    }
    return nativeTransaction;
  });
  confirmedCache.set(key, pending);
  if (confirmedCache.size > MAX_CACHED_TRANSACTIONS) {
    const oldest = confirmedCache.keys().next().value;
    if (oldest !== undefined) confirmedCache.delete(oldest);
  }
  try {
    return await pending;
  } catch (error) {
    confirmedCache.delete(key);
    throw error;
  }
}

export function confirmedBlazeActivity(
  transaction: NativeTransaction,
  contractAddress: string,
): MoatEvent | undefined {
  if (
    transaction.chainId !== "46975" ||
    transaction.txStatus !== "1" ||
    transaction.to?.address.toLowerCase() !== contractAddress.toLowerCase() ||
    !transaction.input
  ) return undefined;

  try {
    const decoded = decodeFunctionData({
      abi: MOAT_V3_ABI,
      data: transaction.input as Hex,
    });
    if (
      decoded.functionName !== "stake" &&
      decoded.functionName !== "lock" &&
      decoded.functionName !== "burn"
    ) return undefined;
    const amount = decoded.args?.[0];
    if (typeof amount !== "bigint") return undefined;
    const timestamp = transaction.blockTimestampMilliseconds ??
      transaction.blockTimestamp * 1000;
    if (!Number.isFinite(timestamp) || timestamp <= 0) return undefined;
    return {
      _id: `blaze-confirmed-${transaction.txHash.toLowerCase()}`,
      source: "confirmed-transaction",
      network: "blaze",
      contractAddress: contractAddress.toLowerCase(),
      eventType: decoded.functionName === "stake"
        ? "Staked"
        : decoded.functionName === "lock" ? "Locked" : "Burned",
      blockNumber: Number(transaction.blockNumber),
      transactionHash: transaction.txHash,
      logIndex: -1,
      timestamp: new Date(timestamp).toISOString(),
      args: {
        user: transaction.from.address,
        amount: amount.toString(),
        ...(decoded.functionName === "lock"
          ? { duration: String(decoded.args[1]) }
          : {}),
      },
    };
  } catch {
    // Unknown contract calls are not stake/lock/burn activity.
    return undefined;
  }
}

/**
 * Independent confirmed-call fallback for Blaze's recent activity only.
 * Does not scan history or infer events from pending/failed transactions.
 */
export async function fetchBlazeRecentActivity(configs: MoatConfig[]): Promise<MoatEvent[]> {
  const streams = await Promise.all(configs.map(async (config) => {
    const address = config.contractAddress.toLowerCase();
    const page = await getJson<{ transactions: { nativeTransaction: NativeTransaction }[] }>(
      `/addresses/${encodeURIComponent(address)}/transactions?pageSize=20&sortOrder=desc`,
    );
    if (!Array.isArray(page.transactions)) {
      throw new Error("Invalid Blaze activity list response");
    }
    const candidates = page.transactions
      .map((entry) => entry.nativeTransaction)
      .filter((transaction) =>
        transaction?.txStatus === "1" &&
        transaction.chainId === "46975" &&
        transaction.to?.address.toLowerCase() === address &&
        INPUT_METHODS.has(transaction.method?.methodHash?.toLowerCase() ?? ""),
      );
    const events: MoatEvent[] = [];
    // Bound parallel requests; cache immutable successful transactions so each
    // refresh normally fetches only the list and any newly confirmed calls.
    for (let start = 0; start < candidates.length; start += 4) {
      const transactions = await Promise.all(
        candidates.slice(start, start + 4).map((transaction) =>
          getConfirmedTransaction(transaction.txHash),
        ),
      );
      for (const transaction of transactions) {
        const event = confirmedBlazeActivity(transaction, address);
        if (event) events.push(event);
      }
    }
    return events;
  }));
  return streams.flat().sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
  );
}

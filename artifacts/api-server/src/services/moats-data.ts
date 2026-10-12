const BASE_URL = "https://moat-api.fortifi.network/api";
const MAX_BYTES = 16 * 1024 * 1024;
const MAX_STALE_MS = 10 * 60_000;
const cache = new Map<string, { data: unknown; updatedAt: number; bytes: number }>();
const pending = new Map<string, Promise<DataResult>>();
let cacheBytes = 0;
let cooldownUntil = 0;
let running = false;
let nextRequestAt = 0;
const queue: { priority: number; run: () => Promise<void> }[] = [];

interface DataResult {
  data: unknown;
  stale: boolean;
  updatedAt: number;
}

export class MoatsSourceError extends Error {
  constructor(public status: number, public retryAfterSeconds: number, message: string) {
    super(message);
  }
}

export function normalizeMoatsPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.length > 2048) {
    throw new Error("Invalid Moats API path");
  }
  const url = new URL(`${BASE_URL}${path}`);
  const resource = url.pathname.slice("/api".length);
  if (!/^\/(?:events|moat-config(?:\/0x[0-9a-fA-F]{40})?|moat-points\/(?:all|v2\/all|v2\/user\/0x[0-9a-fA-F]{40})|maps\/score\/(?:all|0x[0-9a-fA-F]{40}))$/.test(resource)) {
    throw new Error("Unsupported Moats API resource");
  }
  const allowed = new Set(["contractAddress", "userAddress", "eventType", "network", "limit", "skip"]);
  for (const [key, value] of url.searchParams) {
    if (!allowed.has(key) || value.length > 128 || url.searchParams.getAll(key).length !== 1) {
      throw new Error("Unsupported Moats API parameter");
    }
    if ((key === "contractAddress" || key === "userAddress") && !/^0x[0-9a-fA-F]{40}$/.test(value)) {
      throw new Error("Invalid address");
    }
    if (key === "network" && !/^[a-z0-9_-]+$/i.test(value)) throw new Error("Invalid network");
    if ((key === "limit" || key === "skip") && !/^\d+$/.test(value)) throw new Error("Invalid pagination");
  }
  if (url.searchParams.has("limit")) {
    const limit = Number(url.searchParams.get("limit"));
    if (limit < 1) throw new Error("Invalid limit");
    url.searchParams.set("limit", String(Math.min(limit, 1000)));
  }
  if (Number(url.searchParams.get("skip") ?? 0) > 100_000) throw new Error("Invalid offset");
  url.searchParams.sort();
  return resource + (url.search ? url.search : "");
}

function ttl(path: string): number {
  if (path.startsWith("/moat-config")) return 5 * 60_000;
  if (path.startsWith("/events") && Number(new URL(path, BASE_URL).searchParams.get("skip") ?? 0) > 0) {
    return 5 * 60_000;
  }
  return path.startsWith("/events") ? 15_000 : 30_000;
}

async function drain(): Promise<void> {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      queue.sort((a, b) => a.priority - b.priority);
      const item = queue.shift()!;
      // Space requests across all sessions. Live reads have priority over history.
      if (Date.now() >= cooldownUntil) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(0, nextRequestAt - Date.now())));
      }
      await item.run();
      nextRequestAt = Date.now() + 1_100;
    }
  } finally {
    running = false;
  }
}

function store(path: string, data: unknown): DataResult {
  const result = { data, stale: false, updatedAt: Date.now() };
  const bytes = Buffer.byteLength(JSON.stringify(data));
  const previous = cache.get(path);
  if (previous) {
    cacheBytes -= previous.bytes;
    cache.delete(path);
  }
  if (bytes <= MAX_BYTES) {
    cache.set(path, { ...result, bytes });
    cacheBytes += bytes;
    while (cacheBytes > MAX_BYTES || cache.size > 500) {
      const key = cache.keys().next().value;
      if (key === undefined) break;
      cacheBytes -= cache.get(key)!.bytes;
      cache.delete(key);
    }
  }
  return result;
}

export function getMoatsData(path: string): Promise<DataResult> {
  const saved = cache.get(path);
  if (saved && Date.now() - saved.updatedAt < ttl(path)) {
    return Promise.resolve({ ...saved, stale: false });
  }
  const existing = pending.get(path);
  if (existing) return existing;
  if (queue.length >= 200) {
    return Promise.reject(new MoatsSourceError(503, 5, "Moats data requests are busy. Please retry shortly."));
  }

  const promise = new Promise<DataResult>((resolve, reject) => {
    const isHistory = path.startsWith("/events") &&
      Number(new URL(path, BASE_URL).searchParams.get("limit") ?? 50) >= 1000;
    queue.push({
      priority: isHistory ? 1 : 0,
      run: async () => {
        try {
          if (Date.now() < cooldownUntil) {
            throw new MoatsSourceError(503, Math.ceil((cooldownUntil - Date.now()) / 1000), "Moats indexer is rate-limited. Requests are paused.");
          }
          const response = await fetch(`${BASE_URL}${path}`, {
            signal: AbortSignal.timeout(15_000),
          });
          if (!response.ok) {
            if (response.status === 429) {
              const header = response.headers.get("retry-after");
              const seconds = header
                ? Number(header) || Math.ceil((Date.parse(header) - Date.now()) / 1000)
                : 60;
              const delay = Number.isFinite(seconds) ? Math.max(5, seconds) : 60;
              cooldownUntil = Date.now() + delay * 1000;
              throw new MoatsSourceError(503, delay, "Moats indexer is rate-limited. Requests are paused.");
            }
            throw new MoatsSourceError(response.status >= 500 ? 503 : response.status, 30, `Moats indexer returned HTTP ${response.status}`);
          }
          const data = await response.json();
          resolve(store(path, data));
        } catch (error) {
          if (saved && Date.now() - saved.updatedAt <= MAX_STALE_MS) {
            resolve({ ...saved, stale: true });
          } else {
            reject(error instanceof MoatsSourceError
              ? error
              : new MoatsSourceError(503, 30, "Moats indexer is temporarily unavailable."));
          }
        }
      },
    });
    void drain();
  }).finally(() => pending.delete(path));
  pending.set(path, promise);
  return promise;
}

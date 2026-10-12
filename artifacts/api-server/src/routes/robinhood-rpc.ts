import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const RPCS: Record<string, string[]> = {
  robinhood: ["https://robinhood-rpc.publicnode.com", "https://robinhood.rpc.blxrbdn.com"],
  blaze: ["https://subnets.avax.network/blaze/mainnet/rpc"],
  thegrotto: ["https://subnets.avax.network/thegrotto/mainnet/rpc"],
};
const providerBackoff = new Map<string, number>();
const UPSTREAM_TIMEOUT_MS = 8_000;
// Retry provider failures, not contract reverts or invalid RPC parameters.
const RETRYABLE_RPC_CODES = new Set([-32603, -32002, -32005, -32016]);
const ALLOWED_METHODS = new Set([
  "eth_blockNumber",
  "eth_chainId",
  "eth_call",
  "eth_estimateGas",
  "eth_feeHistory",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByNumber",
  "eth_getBlockTransactionCountByNumber",
  "eth_getCode",
  "eth_getLogs",
  "eth_getStorageAt",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
  "net_version",
]);

router.post("/rpc/:network", async (req: Request, res: Response) => {
  const network = String(req.params.network);
  const endpoints = RPCS[network];
  if (!endpoints) {
    res.status(404).json({ error: "Unsupported RPC network" });
    return;
  }
  const body = req.body as
    | { jsonrpc?: string; id?: string | number; method?: string; params?: unknown[] }
    | Array<{ jsonrpc?: string; id?: string | number; method?: string; params?: unknown[] }>
    | undefined;
  const requests = Array.isArray(body) ? body : body ? [body] : [];

  if (
    !requests.length || requests.length > 100 ||
    requests.some((request) => !request || !request.method || !ALLOWED_METHODS.has(request.method))
  ) {
    res.status(400).json({ error: "Unsupported read-only RPC request" });
    return;
  }

  const normalized = requests.map((request, index) => ({
    jsonrpc: "2.0",
    id: request.id ?? index + 1,
    method: request.method,
    params: request.params ?? [],
  }));
  const isBatch = Array.isArray(body);
  const requestBody = JSON.stringify(isBatch ? normalized : normalized[0]);

  let retryAt = 0;
  for (const [index, endpoint] of endpoints.entries()) {
    const blockedUntil = Math.max(
      providerBackoff.get(endpoint) ?? 0,
      ...normalized.map((request) => providerBackoff.get(`${endpoint}:${request.method}`) ?? 0),
    );
    if (Date.now() < blockedUntil) {
      retryAt = Math.max(retryAt, blockedUntil);
      continue;
    }
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: requestBody,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (upstream.status === 429 || upstream.status >= 500) {
        const header = upstream.headers.get("retry-after");
        const seconds = header ? Number(header) || (Date.parse(header) - Date.now()) / 1000 : 60;
        retryAt = Date.now() + (Number.isFinite(seconds) ? Math.max(5, seconds) : 60) * 1000;
        providerBackoff.set(endpoint, retryAt);
        throw new Error(`Upstream HTTP ${upstream.status}`);
      }
      // PublicNode returns a valid JSON-RPC archive-access error with HTTP 403.
      // Preserve that explicit error, rather than turning it into an opaque 502.
      const payload = await upstream.json().catch(() => {
        if (upstream.status === 403) {
          retryAt = Date.now() + 5 * 60_000;
          for (const request of normalized) providerBackoff.set(`${endpoint}:${request.method}`, retryAt);
        }
        throw new Error(`Upstream HTTP ${upstream.status}: non-JSON response`);
      });
      const responses = Array.isArray(payload) ? payload : [payload];
      if (
        Array.isArray(payload) !== isBatch ||
        responses.length !== normalized.length ||
        responses.some(
          (response) =>
            !response ||
            response.jsonrpc !== "2.0" ||
            !normalized.some((request) => request.id === response.id) ||
            (!Object.hasOwn(response, "result") && !response.error),
        )
      ) {
        throw new Error("Invalid upstream JSON-RPC response");
      }
      if (
        index < endpoints.length - 1 &&
        responses.some((response) => RETRYABLE_RPC_CODES.has(response.error?.code))
      ) {
        throw new Error("Upstream JSON-RPC provider failure");
      }
      res.json(payload);
      return;
    } catch (error) {
      req.log.warn(
        { endpoint, methods: normalized.map((request) => request.method), reason: error instanceof Error ? error.message : "RPC request failed" },
        "Read-only RPC upstream unavailable",
      );
    }
  }

  // Keep failures machine-readable and preserve IDs for single and batch callers.
  const errors = normalized.map((request) => ({
    jsonrpc: "2.0",
    id: request.id,
    error: {
      code: retryAt > Date.now() ? -32005 : -32603,
      message: `${network} RPC providers are temporarily unavailable. Please try again.`,
    },
  }));
  res.set("Retry-After", String(Math.max(5, Math.ceil((retryAt - Date.now()) / 1000) || 30)));
  res.status(503).json(isBatch ? errors : errors[0]);
});

export default router;
import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const ROBINHOOD_RPCS = [
  "https://robinhood-rpc.publicnode.com",
  "https://robinhood.rpc.blxrbdn.com",
];
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

router.post("/rpc/robinhood", async (req: Request, res: Response) => {
  const body = req.body as
    | { jsonrpc?: string; id?: string | number; method?: string; params?: unknown[] }
    | Array<{ jsonrpc?: string; id?: string | number; method?: string; params?: unknown[] }>
    | undefined;
  const requests = Array.isArray(body) ? body : body ? [body] : [];

  if (
    !requests.length ||
    requests.some((request) => !request || !request.method || !ALLOWED_METHODS.has(request.method))
  ) {
    res.status(400).json({ error: "Unsupported Robinhood RPC method" });
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

  for (const [index, endpoint] of ROBINHOOD_RPCS.entries()) {
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: requestBody,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!upstream.ok) {
        throw new Error(`Upstream HTTP ${upstream.status}`);
      }
      // A Cloudflare HTML challenge or malformed response must not reach viem.
      const payload = await upstream.json();
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
        index < ROBINHOOD_RPCS.length - 1 &&
        responses.some((response) => RETRYABLE_RPC_CODES.has(response.error?.code))
      ) {
        throw new Error("Upstream JSON-RPC provider failure");
      }
      res.json(payload);
      return;
    } catch (error) {
      req.log.warn(
        { endpoint, reason: error instanceof Error ? error.message : "RPC request failed" },
        "Robinhood RPC upstream unavailable",
      );
    }
  }

  // Keep failures machine-readable and preserve IDs for single and batch callers.
  const errors = normalized.map((request) => ({
    jsonrpc: "2.0",
    id: request.id,
    error: {
      code: -32603,
      message: "Robinhood RPC providers are temporarily unavailable. Please try again.",
    },
  }));
  res.status(502).json(isBatch ? errors : errors[0]);
});

export default router;
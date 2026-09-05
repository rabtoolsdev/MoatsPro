import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();
const ROBINHOOD_RPC = "https://rpc.mainnet.chain.robinhood.com/";
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
    requests.some((request) => !request.method || !ALLOWED_METHODS.has(request.method))
  ) {
    res.status(400).json({ error: "Unsupported Robinhood RPC method" });
    return;
  }

  try {
    const upstream = await fetch(ROBINHOOD_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        requests.length === 1
          ? {
              jsonrpc: "2.0",
              id: requests[0].id ?? 1,
              method: requests[0].method,
              params: requests[0].params ?? [],
            }
          : requests.map((request) => ({
              jsonrpc: "2.0",
              id: request.id ?? 1,
              method: request.method,
              params: request.params ?? [],
            })),
      ),
    });
    const payload = await upstream.text();
    res.status(upstream.status).type("application/json").send(payload);
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Robinhood RPC proxy failed",
    });
  }
});

export default router;
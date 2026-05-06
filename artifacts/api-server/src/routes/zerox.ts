import { Router, type IRouter, type Request, type Response } from "express";

// Proxy for 0x Swap API v2 (permit2). The browser can't call 0x directly:
// 0x requires a `0x-version: v2` header, which their CORS preflight does NOT
// list in `Access-Control-Allow-Headers`, so the browser blocks every call.
// This proxy forwards the query string verbatim and injects the API key +
// version header server-side. Read-only (GET only) and rate-limit-friendly.
const router: IRouter = Router();

const ZEROX_API_KEY =
  process.env.ZEROX_API_KEY ?? process.env.VITE_0X_API_KEY ?? "";

router.get("/0x/quote", async (req: Request, res: Response) => {
  if (!ZEROX_API_KEY) {
    res.status(500).json({ error: "0x API key not configured on server" });
    return;
  }
  try {
    const qs = new URLSearchParams(
      req.query as Record<string, string>,
    ).toString();
    const upstream = await fetch(
      `https://api.0x.org/swap/permit2/quote?${qs}`,
      {
        headers: {
          "0x-api-key": ZEROX_API_KEY,
          "0x-version": "v2",
        },
      },
    );
    const text = await upstream.text();
    res.status(upstream.status);
    const ct = upstream.headers.get("content-type");
    if (ct) res.type(ct);
    res.send(text);
  } catch (e) {
    res
      .status(502)
      .json({ error: e instanceof Error ? e.message : "0x proxy failed" });
  }
});

export default router;

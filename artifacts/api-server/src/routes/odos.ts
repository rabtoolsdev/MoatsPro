import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

// Server-side proxy for Odos quote + assemble.
//
// Why this exists: Odos's enterprise endpoint requires `x-api-key`, which
// triggers a CORS preflight. Their preflight returns 403 with no
// Access-Control-Allow-Origin headers, so the browser cannot call
// enterprise-api.odos.xyz directly — every request fails with "Failed to
// fetch". Proxying server-side bypasses CORS entirely AND keeps the API key
// out of the JS bundle (security++).
//
// When ODOS_API_KEY is set we use V3 (enterprise) with partner-fee support;
// otherwise V2 (public, no integrator fee). The frontend always calls the
// same proxy URLs and reads `__moatsFeeMode` from the response to decide
// whether the fee was skimmed integrated-style or needs the manual fallback.

const ODOS_API_KEY = process.env.ODOS_API_KEY ?? "";
const FEE_MODE = ODOS_API_KEY ? "integrated" : "none";
const FEE_MODE_KEY = "__moatsFeeMode";

const V3_BASE = "https://enterprise-api.odos.xyz";
const V2_BASE = "https://api.odos.xyz";
const QUOTE_PATH = ODOS_API_KEY ? "/sor/quote/v3" : "/sor/quote/v2";
const ASSEMBLE_PATH = "/sor/assemble";
const BASE_URL = ODOS_API_KEY ? V3_BASE : V2_BASE;

const router: IRouter = Router();

async function forward(path: string, body: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ODOS_API_KEY) headers["x-api-key"] = ODOS_API_KEY;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

router.post("/odos/quote", async (req, res) => {
  try {
    // V2 doesn't understand partnerFeePercent/feeRecipient — strip them so
    // the upstream doesn't 400 when the server has no key.
    const body = { ...(req.body ?? {}) } as Record<string, unknown>;
    if (!ODOS_API_KEY) {
      delete body.partnerFeePercent;
      delete body.feeRecipient;
    }
    const { status, text } = await forward(QUOTE_PATH, body);
    res.status(status).type("application/json").send(annotate(text, status));
  } catch (e) {
    logger.error({ err: e }, "odos quote proxy error");
    res.status(502).json({
      message: e instanceof Error ? `Odos upstream error: ${e.message}` : "Odos upstream error",
      [FEE_MODE_KEY]: FEE_MODE,
    });
  }
});

router.post("/odos/assemble", async (req, res) => {
  try {
    const { status, text } = await forward(ASSEMBLE_PATH, req.body ?? {});
    res.status(status).type("application/json").send(annotate(text, status));
  } catch (e) {
    logger.error({ err: e }, "odos assemble proxy error");
    res.status(502).json({
      message: e instanceof Error ? `Odos upstream error: ${e.message}` : "Odos upstream error",
      [FEE_MODE_KEY]: FEE_MODE,
    });
  }
});

// Mix `__moatsFeeMode` into the JSON response so the frontend can tell V3
// (integrated fee) from V2 (no fee). Namespaced to avoid colliding with
// any future Odos response field. If the upstream body isn't valid JSON we
// pass it through untouched.
function annotate(text: string, status: number): string {
  if (!text) return JSON.stringify({ [FEE_MODE_KEY]: FEE_MODE, status });
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return JSON.stringify({ ...parsed, [FEE_MODE_KEY]: FEE_MODE });
    }
  } catch {
    /* not JSON — pass through */
  }
  return text;
}

export default router;

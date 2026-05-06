import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

// Server-side proxy for Odos quote + assemble.
//
// We use Odos SOR V2 (the public, CORS-open endpoint) — partner-fee
// monetization on Odos is done via referralCode, which is registered
// on-chain via https://referral.odos.xyz/ and passed as a request field.
// V2 doesn't require auth, so the proxy is structurally minimal — but we
// keep it (rather than calling Odos directly from the browser) so we can
// later swap in the enterprise endpoint with an API key without touching
// the frontend bundle.

const BASE_URL = "https://api.odos.xyz";
const QUOTE_PATH = "/sor/quote/v2";
const ASSEMBLE_PATH = "/sor/assemble";

const router: IRouter = Router();

async function forward(path: string, body: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text };
}

router.post("/odos/quote", async (req, res) => {
  try {
    const { status, text } = await forward(QUOTE_PATH, req.body ?? {});
    res.status(status).type("application/json").send(text);
  } catch (e) {
    logger.error({ err: e }, "odos quote proxy error");
    res.status(502).json({
      message: e instanceof Error ? `Odos upstream error: ${e.message}` : "Odos upstream error",
    });
  }
});

router.post("/odos/assemble", async (req, res) => {
  try {
    const { status, text } = await forward(ASSEMBLE_PATH, req.body ?? {});
    res.status(status).type("application/json").send(text);
  } catch (e) {
    logger.error({ err: e }, "odos assemble proxy error");
    res.status(502).json({
      message: e instanceof Error ? `Odos upstream error: ${e.message}` : "Odos upstream error",
    });
  }
});

export default router;

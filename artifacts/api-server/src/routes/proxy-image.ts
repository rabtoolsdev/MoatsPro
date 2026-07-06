import { Router } from "express";

const router: Router = Router();

// GET /api/proxy-image?url=<encoded-url>
//
// Fetches an external image server-side and returns it with permissive CORS
// headers. Used by the canvas-based social card export: images from CDNs like
// cdn.dexscreener.com don't send Access-Control-Allow-Origin, so loading them
// with crossOrigin="anonymous" fails and taints the canvas. This proxy fetches
// server-side (no browser CORS restriction), then serves from our origin, so
// ctx.drawImage() and canvas.toDataURL() work cleanly.
//
// Only http/https URLs are accepted (SSRF guard). Responses cached 1 hour.
router.get("/proxy-image", async (req, res): Promise<void> => {
  const raw = req.query.url as string | undefined;
  if (!raw) {
    res.status(400).json({ error: "url query param required" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    res.status(400).json({ error: "invalid url" });
    return;
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    res.status(400).json({ error: "only http/https URLs are allowed" });
    return;
  }

  try {
    const upstream = await fetch(raw, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "MoatsPro/1.0 image-proxy" },
    });
    if (!upstream.ok) {
      res.status(502).json({ error: `upstream returned ${upstream.status}` });
      return;
    }
    const contentType = upstream.headers.get("content-type") ?? "image/png";
    const buffer = await upstream.arrayBuffer();
    res.set({
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    });
    res.end(Buffer.from(buffer));
  } catch {
    res.status(502).json({ error: "upstream fetch failed" });
  }
});

export default router;

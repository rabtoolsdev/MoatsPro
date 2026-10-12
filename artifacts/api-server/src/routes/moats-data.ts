import { Router, type IRouter } from "express";
import { getMoatsData, MoatsSourceError, normalizeMoatsPath } from "../services/moats-data";

const router: IRouter = Router();
router.get("/moats-data", async (req, res) => {
  let path: string;
  try {
    if (typeof req.query.path !== "string") throw new Error("A resource path is required");
    path = normalizeMoatsPath(req.query.path);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid resource" });
    return;
  }
  res.set("Cache-Control", "no-store");
  try {
    const result = await getMoatsData(path);
    res.set("X-Data-Stale", String(result.stale));
    res.set("X-Data-Updated-At", String(result.updatedAt));
    res.json(result.data);
  } catch (error) {
    const failure = error instanceof MoatsSourceError
      ? error : new MoatsSourceError(503, 30, "Moats data is unavailable");
    res.set("Retry-After", String(failure.retryAfterSeconds));
    res.status(failure.status).json({
      error: failure.message,
      retryAfterSeconds: failure.retryAfterSeconds,
    });
  }
});
export default router;

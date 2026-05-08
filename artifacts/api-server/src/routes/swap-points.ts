import { Router, type IRouter } from "express";
import { db, swapsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// GET /api/swap-points/:address
//
// Swap Points = lifetime sum of `from_usd` (the USD value swapped IN by the
// user) across every recorded swap. 1 USD swapped = 1 point.
//
// `from_usd` is already enriched server-side at insert time
// (see lib/usd-pricing.ts), so this is just a SUM over existing rows —
// no new schema needed.
router.get("/swap-points/:address", async (req, res) => {
  try {
    const wallet = String(req.params["address"] ?? "").toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(wallet)) {
      res.status(400).json({ error: "Invalid wallet address" });
      return;
    }

    const [row] = await db
      .select({
        points: sql<number>`coalesce(sum(${swapsTable.fromUsd}), 0)::float`,
        swapCount: sql<number>`count(*)::int`,
      })
      .from(swapsTable)
      .where(eq(swapsTable.walletAddress, wallet));

    res.json({
      walletAddress: wallet,
      points: row?.points ?? 0,
      swapCount: row?.swapCount ?? 0,
    });
  } catch (err) {
    logger.error({ err }, "Failed to load swap points");
    res.status(500).json({ error: "Failed to load swap points" });
  }
});

export default router;

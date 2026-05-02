import { Router, type IRouter } from "express";
import { db, swapsTable, insertSwapSchema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Public endpoint — frontend posts here when a swap succeeds.
router.post("/swaps", async (req, res) => {
  const parsed = insertSwapSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid payload", issues: parsed.error.issues });
    return;
  }
  try {
    const data = parsed.data;
    const wallet = data.walletAddress.toLowerCase();
    const txHash = data.txHash.toLowerCase();

    // Idempotent: if the same tx_hash is already recorded, return it.
    const existing = await db
      .select()
      .from(swapsTable)
      .where(eq(swapsTable.txHash, txHash))
      .limit(1);
    if (existing.length > 0) {
      res.json({ ok: true, swap: existing[0], deduplicated: true });
      return;
    }

    const [row] = await db
      .insert(swapsTable)
      .values({
        ...data,
        walletAddress: wallet,
        txHash,
        feeTxHash: data.feeTxHash?.toLowerCase() ?? null,
        fromTokenAddress: data.fromTokenAddress.toLowerCase(),
        toTokenAddress: data.toTokenAddress.toLowerCase(),
      })
      .returning();
    res.json({ ok: true, swap: row });
  } catch (err) {
    logger.error({ err }, "Failed to record swap");
    res.status(500).json({ error: "Failed to record swap" });
  }
});

export default router;

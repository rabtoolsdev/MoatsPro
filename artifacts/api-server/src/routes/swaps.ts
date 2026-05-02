import { Router, type IRouter } from "express";
import { db, swapsTable, insertSwapSchema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { enrichUsdValues } from "../lib/usd-pricing";

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

    // Backfill USD values when the client (or its router) couldn't supply
    // them — e.g. AVAX→BENSI through Odos. Without this, non-stable swaps
    // would land in the DB with null fromUsd and disappear from the
    // admin dashboard's "Volume (USD)" total.
    const enriched = await enrichUsdValues({
      chainId: data.chainId,
      fromTokenSymbol: data.fromTokenSymbol,
      fromTokenAddress: data.fromTokenAddress,
      toTokenSymbol: data.toTokenSymbol,
      toTokenAddress: data.toTokenAddress,
      fromAmount: data.fromAmount,
      toAmount: data.toAmount,
      feeAmount: data.feeAmount ?? null,
      fromUsd: data.fromUsd ?? null,
      toUsd: data.toUsd ?? null,
      feeUsd: data.feeUsd ?? null,
    });

    const [row] = await db
      .insert(swapsTable)
      .values({
        ...data,
        walletAddress: wallet,
        txHash,
        feeTxHash: data.feeTxHash?.toLowerCase() ?? null,
        fromTokenAddress: data.fromTokenAddress.toLowerCase(),
        toTokenAddress: data.toTokenAddress.toLowerCase(),
        fromUsd: enriched.fromUsd,
        toUsd: enriched.toUsd,
        feeUsd: enriched.feeUsd,
      })
      .returning();
    res.json({ ok: true, swap: row });
  } catch (err) {
    logger.error({ err }, "Failed to record swap");
    res.status(500).json({ error: "Failed to record swap" });
  }
});

export default router;

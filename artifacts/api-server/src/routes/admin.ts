import { Router, type IRouter } from "express";
import { db, swapsTable } from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

type Range = "24h" | "7d" | "30d" | "all";

function rangeToCutoff(range: Range): Date | null {
  const now = Date.now();
  switch (range) {
    case "24h":
      return new Date(now - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "all":
    default:
      return null;
  }
}

function parseRange(input: unknown): Range {
  const v = String(input ?? "all");
  if (v === "24h" || v === "7d" || v === "30d" || v === "all") return v;
  return "all";
}

function parseChainId(input: unknown): number | null {
  if (input === undefined || input === null || input === "" || input === "all") return null;
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

function buildFilters(range: Range, chainId: number | null) {
  const conds = [] as ReturnType<typeof eq>[];
  const cutoff = rangeToCutoff(range);
  if (cutoff) conds.push(gte(swapsTable.createdAt, cutoff));
  if (chainId !== null) conds.push(eq(swapsTable.chainId, chainId));
  return conds.length > 0 ? and(...conds) : undefined;
}

// GET /api/admin/stats?range=24h|7d|30d|all&chainId=43114
router.get("/stats", async (req, res) => {
  try {
    const range = parseRange(req.query["range"]);
    const chainId = parseChainId(req.query["chainId"]);
    const where = buildFilters(range, chainId);

    const baseQuery = db
      .select({
        count: sql<number>`count(*)::int`,
        volumeUsd: sql<number>`coalesce(sum(${swapsTable.fromUsd}), 0)::float`,
        feeUsd: sql<number>`coalesce(sum(${swapsTable.feeUsd}), 0)::float`,
        uniqueUsers: sql<number>`count(distinct ${swapsTable.walletAddress})::int`,
        avgSwapUsd: sql<number>`coalesce(avg(${swapsTable.fromUsd}), 0)::float`,
      })
      .from(swapsTable);

    const [totals] = where ? await baseQuery.where(where) : await baseQuery;

    // Always include "all-time" totals for context.
    const allWhere = chainId !== null ? eq(swapsTable.chainId, chainId) : undefined;
    const allQuery = db
      .select({
        count: sql<number>`count(*)::int`,
        volumeUsd: sql<number>`coalesce(sum(${swapsTable.fromUsd}), 0)::float`,
        feeUsd: sql<number>`coalesce(sum(${swapsTable.feeUsd}), 0)::float`,
        uniqueUsers: sql<number>`count(distinct ${swapsTable.walletAddress})::int`,
      })
      .from(swapsTable);
    const [allTotals] = allWhere ? await allQuery.where(allWhere) : await allQuery;

    // Per-chain breakdown for the selected range (no chain filter).
    const rangeWhere = (() => {
      const cutoff = rangeToCutoff(range);
      return cutoff ? gte(swapsTable.createdAt, cutoff) : undefined;
    })();

    const chainBreakdownQuery = db
      .select({
        chainId: swapsTable.chainId,
        network: swapsTable.network,
        count: sql<number>`count(*)::int`,
        volumeUsd: sql<number>`coalesce(sum(${swapsTable.fromUsd}), 0)::float`,
        feeUsd: sql<number>`coalesce(sum(${swapsTable.feeUsd}), 0)::float`,
      })
      .from(swapsTable)
      .groupBy(swapsTable.chainId, swapsTable.network);
    const byChain = rangeWhere
      ? await chainBreakdownQuery.where(rangeWhere)
      : await chainBreakdownQuery;

    // Most-used router for the selected range/chain.
    const routerBreakdownQuery = db
      .select({
        router: swapsTable.router,
        count: sql<number>`count(*)::int`,
      })
      .from(swapsTable)
      .groupBy(swapsTable.router);
    const byRouter = where
      ? await routerBreakdownQuery.where(where)
      : await routerBreakdownQuery;

    res.json({
      range,
      chainId,
      totals,
      allTime: allTotals,
      byChain,
      byRouter,
    });
  } catch (err) {
    logger.error({ err }, "Failed to load stats");
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// GET /api/admin/swaps?range&chainId&address&limit&offset
router.get("/swaps", async (req, res) => {
  try {
    const range = parseRange(req.query["range"]);
    const chainId = parseChainId(req.query["chainId"]);
    const addressRaw = (req.query["address"] as string | undefined)?.trim().toLowerCase();
    const limit = Math.min(Math.max(Number(req.query["limit"] ?? 50), 1), 200);
    const offset = Math.max(Number(req.query["offset"] ?? 0), 0);

    const conds = [] as ReturnType<typeof eq>[];
    const cutoff = rangeToCutoff(range);
    if (cutoff) conds.push(gte(swapsTable.createdAt, cutoff));
    if (chainId !== null) conds.push(eq(swapsTable.chainId, chainId));
    if (addressRaw) conds.push(eq(swapsTable.walletAddress, addressRaw));
    const where = conds.length > 0 ? and(...conds) : undefined;

    const baseQuery = db
      .select()
      .from(swapsTable)
      .orderBy(desc(swapsTable.createdAt))
      .limit(limit)
      .offset(offset);
    const rows = where ? await baseQuery.where(where) : await baseQuery;

    const countQuery = db.select({ count: sql<number>`count(*)::int` }).from(swapsTable);
    const [{ count }] = where ? await countQuery.where(where) : await countQuery;

    res.json({ rows, total: count, limit, offset });
  } catch (err) {
    logger.error({ err }, "Failed to load swaps");
    res.status(500).json({ error: "Failed to load swaps" });
  }
});

// GET /api/admin/users?range&chainId&limit
router.get("/users", async (req, res) => {
  try {
    const range = parseRange(req.query["range"]);
    const chainId = parseChainId(req.query["chainId"]);
    const limit = Math.min(Math.max(Number(req.query["limit"] ?? 100), 1), 500);
    const where = buildFilters(range, chainId);

    const q = db
      .select({
        walletAddress: swapsTable.walletAddress,
        swapCount: sql<number>`count(*)::int`,
        volumeUsd: sql<number>`coalesce(sum(${swapsTable.fromUsd}), 0)::float`,
        feeUsd: sql<number>`coalesce(sum(${swapsTable.feeUsd}), 0)::float`,
        firstSwap: sql<string>`min(${swapsTable.createdAt})`,
        lastSwap: sql<string>`max(${swapsTable.createdAt})`,
      })
      .from(swapsTable)
      .groupBy(swapsTable.walletAddress)
      .orderBy(sql`coalesce(sum(${swapsTable.fromUsd}), 0) desc`)
      .limit(limit);
    const rows = where ? await q.where(where) : await q;

    res.json({ rows });
  } catch (err) {
    logger.error({ err }, "Failed to load users");
    res.status(500).json({ error: "Failed to load users" });
  }
});

export default router;

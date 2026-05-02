import { pgTable, text, integer, bigint, doublePrecision, timestamp, serial, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const swapsTable = pgTable(
  "swaps",
  {
    id: serial("id").primaryKey(),
    walletAddress: text("wallet_address").notNull(),
    chainId: integer("chain_id").notNull(),
    network: text("network").notNull(),
    txHash: text("tx_hash").notNull().unique(),
    feeTxHash: text("fee_tx_hash"),
    fromTokenSymbol: text("from_token_symbol").notNull(),
    fromTokenAddress: text("from_token_address").notNull(),
    fromTokenDecimals: integer("from_token_decimals").notNull(),
    toTokenSymbol: text("to_token_symbol").notNull(),
    toTokenAddress: text("to_token_address").notNull(),
    toTokenDecimals: integer("to_token_decimals").notNull(),
    fromAmountRaw: text("from_amount_raw").notNull(),
    toAmountRaw: text("to_amount_raw").notNull(),
    feeAmountRaw: text("fee_amount_raw"),
    fromAmount: doublePrecision("from_amount").notNull(),
    toAmount: doublePrecision("to_amount").notNull(),
    feeAmount: doublePrecision("fee_amount"),
    fromUsd: doublePrecision("from_usd"),
    toUsd: doublePrecision("to_usd"),
    feeUsd: doublePrecision("fee_usd"),
    router: text("router").notNull(),
    toolName: text("tool_name"),
    slippageBps: integer("slippage_bps"),
    status: text("status").notNull().default("success"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    walletIdx: index("swaps_wallet_idx").on(t.walletAddress),
    chainIdx: index("swaps_chain_idx").on(t.chainId),
    createdIdx: index("swaps_created_idx").on(t.createdAt),
  }),
);

export const insertSwapSchema = createInsertSchema(swapsTable, {
  walletAddress: z.string().min(1),
  txHash: z.string().min(1),
  fromTokenSymbol: z.string().min(1),
  toTokenSymbol: z.string().min(1),
}).omit({ id: true, createdAt: true });

export type InsertSwap = z.infer<typeof insertSwapSchema>;
export type Swap = typeof swapsTable.$inferSelect;

// Suppress unused warning for bigint import (kept for future use)
export const _bigint = bigint;

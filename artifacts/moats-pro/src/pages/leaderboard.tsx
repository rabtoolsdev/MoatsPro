import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, Zap, Medal } from "lucide-react";
import { useMapsLeaderboard, useMapsEpoch } from "@/hooks/use-moats-api";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { formatPoints, formatAddress, timeAgo } from "@/lib/moat-metadata";
import type { MapsScore } from "@/lib/moats-api";

export default function Leaderboard() {
  const { data: mapsScores, isLoading: mapsLoading } = useMapsLeaderboard();
  const { data: currentEpoch } = useMapsEpoch();

  const rankBadge = (rank: number) => {
    if (rank === 0)
      return (
        <span className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Trophy size={16} className="text-amber-400" />
        </span>
      );
    if (rank === 1)
      return (
        <span className="w-8 h-8 rounded-full bg-zinc-500/20 flex items-center justify-center">
          <Medal size={16} className="text-zinc-300" />
        </span>
      );
    if (rank === 2)
      return (
        <span className="w-8 h-8 rounded-full bg-amber-900/20 flex items-center justify-center">
          <Medal size={16} className="text-amber-700" />
        </span>
      );
    return (
      <span className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-sm font-bold text-muted-foreground">
        {rank + 1}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 pt-28 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">Leaderboard</h1>
          <div className="flex items-center gap-3">
            <p className="text-muted-foreground">
              Top MAPS scorers across all Moats
            </p>
            {currentEpoch && (
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                currentEpoch.isComplete
                  ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}>
                Epoch {currentEpoch.epochNumber} {currentEpoch.isComplete ? "Complete" : "Live"}
              </span>
            )}
          </div>
          {currentEpoch && (
            <p className="text-xs text-muted-foreground mt-2">
              {currentEpoch.isComplete
                ? `Ended ${timeAgo(new Date(currentEpoch.endTime).getTime())}`
                : `Started ${timeAgo(new Date(currentEpoch.startTime).getTime())}`}
            </p>
          )}
        </motion.div>

        {/* Top 3 highlight cards */}
        {mapsScores && mapsScores.length >= 3 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {([1, 0, 2] as const).map((idx) => {
              const entry = mapsScores[idx];
              if (!entry) return null;
              return (
                <motion.div
                  key={entry.address}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className={`rounded-2xl border p-4 text-center ${
                    idx === 0
                      ? "border-amber-500/30 bg-amber-500/5 ring-1 ring-amber-500/20"
                      : "border-border bg-card/30"
                  }`}
                >
                  <div className="flex justify-center mb-2">
                    {idx === 0 ? (
                      <Trophy size={24} className="text-amber-400" />
                    ) : (
                      <Medal size={20} className={idx === 1 ? "text-zinc-300" : "text-amber-700"} />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    #{idx === 0 ? 1 : idx === 1 ? 2 : 3}
                  </p>
                  <p className="font-mono text-sm font-bold">
                    {entry.username && !entry.username.startsWith("0x")
                      ? entry.username
                      : formatAddress(entry.address)}
                  </p>
                  <p className="text-primary font-bold text-lg mt-1 tabular-nums">
                    {(entry.points ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">MAPS pts</p>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Full Table */}
        <div
          data-testid="leaderboard-table"
          className="rounded-2xl border border-border bg-card/30 backdrop-blur-sm overflow-hidden"
        >
          {mapsLoading ? (
            <div className="p-8 space-y-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              <div className="px-6 py-3 grid grid-cols-12 gap-4 text-xs text-muted-foreground font-medium">
                <span className="col-span-1">Rank</span>
                <span className="col-span-5">Wallet / Username</span>
                <span className="col-span-3 text-right">MAPS Points</span>
                <span className="col-span-3 text-right">Weight</span>
              </div>

              {(mapsScores || []).map((entry, i) => (
                <motion.div
                  key={entry.address}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.015, 0.4) }}
                  data-testid={`row-leaderboard-${i}`}
                  className={`px-6 py-3.5 grid grid-cols-12 gap-4 items-center hover:bg-muted/20 transition-colors ${
                    i < 3 ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="col-span-1">{rankBadge(i)}</div>
                  <div className="col-span-5">
                    {entry.username && !entry.username.startsWith("0x") ? (
                      <div>
                        <p className="text-sm font-medium">{entry.username}</p>
                        <p className="text-xs font-mono text-muted-foreground/60">
                          {formatAddress(entry.address)}
                        </p>
                      </div>
                    ) : (
                      <span className="font-mono text-sm">{formatAddress(entry.address)}</span>
                    )}
                  </div>
                  <div className="col-span-3 text-right font-bold text-primary tabular-nums">
                    {(entry.points ?? 0).toLocaleString()}
                  </div>
                  <div className="col-span-3 text-right text-muted-foreground text-sm tabular-nums">
                    —
                  </div>
                </motion.div>
              ))}

              {(!mapsScores || mapsScores.length === 0) && (
                <div className="p-12 text-center text-muted-foreground">
                  <Trophy size={40} className="mx-auto mb-3 opacity-30" />
                  <p>No MAPS scores available yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

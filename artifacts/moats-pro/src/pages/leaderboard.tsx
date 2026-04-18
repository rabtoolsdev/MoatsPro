import { motion } from "framer-motion";
import { Trophy, Medal, Crown } from "lucide-react";
import { useMapsLeaderboard, useMapsEpoch } from "@/hooks/use-moats-api";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { formatAddress, timeAgo } from "@/lib/moat-metadata";

export default function Leaderboard() {
  const { data: mapsScores, isLoading: mapsLoading } = useMapsLeaderboard();
  const { data: currentEpoch } = useMapsEpoch();

  const rankBadge = (rank: number) => {
    if (rank === 0)
      return (
        <span className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shadow-[0_0_10px_rgba(251,191,36,0.2)]">
          <Crown size={15} className="text-amber-400" />
        </span>
      );
    if (rank === 1)
      return (
        <span className="w-8 h-8 rounded-full bg-zinc-500/20 border border-zinc-400/30 flex items-center justify-center">
          <Medal size={15} className="text-zinc-300" />
        </span>
      );
    if (rank === 2)
      return (
        <span className="w-8 h-8 rounded-full bg-amber-900/20 border border-amber-700/30 flex items-center justify-center">
          <Medal size={15} className="text-amber-600" />
        </span>
      );
    return (
      <span className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center text-sm font-bold text-muted-foreground">
        {rank + 1}
      </span>
    );
  };

  const podiumOrder = [1, 0, 2] as const;
  const podiumPadding: Record<number, string> = { 0: "pt-0", 1: "pt-10", 2: "pt-14" };

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
              <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${
                currentEpoch.isComplete
                  ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}>
                {!currentEpoch.isComplete && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />
                )}
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

        {/* ── Podium top-3 ─────────────────────────────────────────── */}
        {mapsScores && mapsScores.length >= 3 && (
          <div className="flex items-end justify-center gap-3 mb-10">
            {podiumOrder.map((idx) => {
              const entry = mapsScores[idx];
              if (!entry) return null;
              const isGold = idx === 0;
              const isSilver = idx === 1;
              const isBronze = idx === 2;
              return (
                <motion.div
                  key={entry.address}
                  initial={{ opacity: 0, y: 30, scale: isGold ? 0.88 : 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: isGold ? 0.45 : isSilver ? 0.1 : 0.25,
                    duration: isGold ? 0.6 : 0.45,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={`flex-1 max-w-[200px] rounded-2xl border border-transparent p-5 text-center flex flex-col items-center ${podiumPadding[idx]}`}
                  style={{
                    background: isGold
                      ? "linear-gradient(hsl(var(--card)), hsl(var(--card))) padding-box, linear-gradient(135deg, rgba(251,191,36,0.7) 0%, rgba(251,191,36,0.15) 60%, transparent 100%) border-box"
                      : isSilver
                      ? "linear-gradient(hsl(var(--card)), hsl(var(--card))) padding-box, linear-gradient(135deg, rgba(212,212,216,0.6) 0%, rgba(212,212,216,0.12) 60%, transparent 100%) border-box"
                      : "linear-gradient(hsl(var(--card)), hsl(var(--card))) padding-box, linear-gradient(135deg, rgba(180,83,9,0.55) 0%, rgba(180,83,9,0.1) 60%, transparent 100%) border-box",
                    boxShadow: isGold
                      ? "0 0 28px rgba(251,191,36,0.12)"
                      : isSilver
                      ? "0 0 18px rgba(212,212,216,0.08)"
                      : "0 0 16px rgba(180,83,9,0.08)",
                  }}
                >
                  <div className="mb-3">
                    {isGold ? (
                      <Crown
                        size={28}
                        className="text-amber-400 mx-auto"
                        style={{ filter: "drop-shadow(0 0 6px rgba(251,191,36,0.5))" }}
                      />
                    ) : (
                      <Medal
                        size={24}
                        className={`mx-auto ${isSilver ? "text-zinc-300" : "text-amber-600"}`}
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-1 font-medium">
                    #{isGold ? 1 : isSilver ? 2 : 3}
                  </p>
                  <p className="font-mono text-sm font-bold leading-tight mb-2">
                    {entry.username && !entry.username.startsWith("0x")
                      ? entry.username
                      : formatAddress(entry.address)}
                  </p>
                  <p className={`font-bold text-xl tabular-nums ${
                    isGold ? "text-amber-400" : isSilver ? "text-zinc-300" : "text-amber-600"
                  }`}>
                    {(entry.points ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">MAPS pts</p>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Full Table ───────────────────────────────────────────── */}
        <div
          data-testid="leaderboard-table"
          className="rounded-2xl border border-border bg-card/30 backdrop-blur-sm overflow-hidden"
        >
          {mapsLoading ? (
            <div className="p-8 space-y-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl skeleton-shimmer" />
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
                    i === 0
                      ? "bg-amber-500/5 border-l-2 border-l-amber-500/50"
                      : i === 1
                      ? "bg-zinc-500/5 border-l-2 border-l-zinc-400/40"
                      : i === 2
                      ? "bg-amber-900/5 border-l-2 border-l-amber-700/40"
                      : ""
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
                  <div className={`col-span-3 text-right font-bold tabular-nums ${
                    i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-600" : "text-primary"
                  }`}>
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

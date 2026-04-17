import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, Zap, Medal } from "lucide-react";
import { useAllMoatPoints, useMapsLeaderboard } from "@/hooks/use-moats-api";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { formatPoints, formatAddress } from "@/lib/moat-metadata";

type LeaderboardType = "maps" | "points";

export default function Leaderboard() {
  const [tab, setTab] = useState<LeaderboardType>("maps");
  const { data: rawMapsData, isLoading: mapsLoading } = useMapsLeaderboard();
  const mapsData = Array.isArray(rawMapsData) ? rawMapsData : [];
  const { data: pointsData, isLoading: pointsLoading } = useAllMoatPoints();

  const aggregatedPoints = pointsData
    ? Object.entries(
        pointsData.reduce<Record<string, number>>((acc, p) => {
          acc[p.walletAddress] = (acc[p.walletAddress] || 0) + p.points;
          return acc;
        }, {})
      )
        .map(([walletAddress, points]) => ({ walletAddress, points }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 100)
    : [];

  const isLoading = tab === "maps" ? mapsLoading : pointsLoading;

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
          <p className="text-muted-foreground">
            Top performers across all Moats
          </p>
        </motion.div>

        {/* Tabs */}
        <div
          data-testid="leaderboard-tabs"
          className="flex gap-2 mb-8 p-1 rounded-xl bg-muted/30 border border-border w-fit"
        >
          <button
            onClick={() => setTab("maps")}
            data-testid="tab-maps"
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === "maps"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TrendingUp size={15} />
            MAPS Score
          </button>
          <button
            onClick={() => setTab("points")}
            data-testid="tab-points"
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === "points"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Zap size={15} />
            Moat Points
          </button>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border bg-card/30 backdrop-blur-sm overflow-hidden">
          {isLoading ? (
            <div className="p-8 space-y-3">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl bg-muted/30 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {/* Header */}
              <div className="px-6 py-3 grid grid-cols-12 gap-4 text-xs text-muted-foreground font-medium">
                <span className="col-span-1">Rank</span>
                <span className="col-span-7">Wallet</span>
                <span className="col-span-4 text-right">
                  {tab === "maps" ? "MAPS Score" : "Total Points"}
                </span>
              </div>

              {/* Rows */}
              {(tab === "maps"
                ? (mapsData || []).slice(0, 100)
                : aggregatedPoints
              ).map((entry, i) => (
                <motion.div
                  key={"walletAddress" in entry ? entry.walletAddress : i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  data-testid={`row-leaderboard-${i}`}
                  className={`px-6 py-3.5 grid grid-cols-12 gap-4 items-center hover:bg-muted/20 transition-colors ${
                    i < 3 ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="col-span-1">{rankBadge(i)}</div>
                  <div className="col-span-7 font-mono text-sm">
                    {formatAddress(entry.walletAddress)}
                  </div>
                  <div className="col-span-4 text-right font-bold text-primary tabular-nums">
                    {tab === "maps" && "score" in entry
                      ? entry.score.toLocaleString()
                      : "points" in entry
                      ? formatPoints(entry.points)
                      : "-"}
                  </div>
                </motion.div>
              ))}

              {tab === "maps" && (!mapsData || mapsData.length === 0) && (
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

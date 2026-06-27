import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Crown, Search, Share2, Wallet, Clock } from "lucide-react";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";
import { useMapsLeaderboard, useMapsEpoch } from "@/hooks/use-moats-api";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { formatAddress, timeAgo } from "@/lib/moat-metadata";
import { ShareRankModal } from "@/components/share-rank-modal";

export default function Leaderboard() {
  const { data: mapsScores, isLoading: mapsLoading } = useMapsLeaderboard();
  const { data: currentEpoch } = useMapsEpoch();
  const { address, isConnected } = useAccount();
  const { open: openWallet } = useAppKit();
  const [shareOpen, setShareOpen] = useState(false);
  const [highlightAddr, setHighlightAddr] = useState<string | null>(null);
  const userRowRef = useRef<HTMLDivElement | null>(null);

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

  const totalMapsPoints = (mapsScores ?? []).reduce(
    (sum, e) => sum + (e.points ?? 0),
    0,
  );
  const formatWeight = (points: number): string => {
    if (totalMapsPoints <= 0 || points <= 0) return "—";
    const pct = (points / totalMapsPoints) * 100;
    if (pct >= 10) return `${pct.toFixed(1)}%`;
    if (pct >= 1) return `${pct.toFixed(2)}%`;
    if (pct >= 0.01) return `${pct.toFixed(2)}%`;
    return `<0.01%`;
  };
  const weightPctFor = (points: number): number =>
    totalMapsPoints > 0 ? (points / totalMapsPoints) * 100 : 0;

  const userIndex =
    address && mapsScores
      ? mapsScores.findIndex((e) => e.address.toLowerCase() === address.toLowerCase())
      : -1;
  const userEntry = userIndex >= 0 ? mapsScores![userIndex] : null;

  const handleFindMyRank = () => {
    if (!isConnected) {
      openWallet({ view: "Connect" });
      return;
    }
    if (userIndex < 0 || !address) return;
    setHighlightAddr(address.toLowerCase());
    requestAnimationFrame(() => {
      userRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    setTimeout(() => setHighlightAddr(null), 4000);
  };

  // Clear highlight if scores reload
  useEffect(() => {
    if (!userEntry) setHighlightAddr(null);
  }, [userEntry]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-3">Leaderboard</h1>
          <EpochCountdown />
          <div className="flex items-center gap-3 mt-5">
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

        {/* Podium top-3 */}
        {mapsScores && mapsScores.length >= 3 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-10 max-w-2xl mx-auto">
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
                  className="w-full min-w-0 overflow-hidden rounded-2xl border border-transparent p-3 sm:p-5 text-center flex flex-col items-center"
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
                  <p className="w-full font-mono text-[10px] sm:text-sm font-bold leading-tight mb-2 truncate px-0.5 sm:px-1">
                    {entry.username && !entry.username.startsWith("0x")
                      ? entry.username
                      : formatAddress(entry.address)}
                  </p>
                  <p className={`w-full font-bold text-base sm:text-xl tabular-nums truncate ${
                    isGold ? "text-amber-400" : isSilver ? "text-zinc-300" : "text-amber-600"
                  }`}>
                    {(entry.points ?? 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">MAPS pts</p>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Find My Rank */}
        {mapsScores && mapsScores.length > 0 && (
          <div className="flex justify-center mb-6">
            <button
              onClick={handleFindMyRank}
              data-testid="btn-find-my-rank"
              className="btn-shimmer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/20 hover:shadow-[0_0_18px_rgba(0,212,255,0.25)] transition-all"
            >
              {isConnected ? (
                <>
                  <Search size={15} />
                  Find My Rank
                </>
              ) : (
                <>
                  <Wallet size={15} />
                  Connect Wallet to Find My Rank
                </>
              )}
            </button>
          </div>
        )}

        {/* User-not-on-leaderboard hint */}
        {isConnected && mapsScores && mapsScores.length > 0 && userIndex < 0 && (
          <p className="text-center text-xs text-muted-foreground mb-6">
            Your wallet isn't ranked on the current leaderboard yet.
          </p>
        )}

        {/* Full Table */}
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
              <div className="px-3 sm:px-6 py-3 grid grid-cols-12 gap-2 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground font-medium">
                <span className="col-span-1">Rank</span>
                <span className="col-span-6 sm:col-span-5 min-w-0">Wallet / Username</span>
                <span className="col-span-3 text-right">MAPS</span>
                <span className="col-span-2 sm:col-span-3 text-right">Weight</span>
              </div>

              {(mapsScores || []).map((entry, i) => {
                const isUser =
                  address && entry.address.toLowerCase() === address.toLowerCase();
                const isHighlighted =
                  highlightAddr && entry.address.toLowerCase() === highlightAddr;
                return (
                <motion.div
                  key={entry.address}
                  ref={isUser ? userRowRef : undefined}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.015, 0.4) }}
                  data-testid={`row-leaderboard-${i}`}
                  className={`px-3 sm:px-6 py-3.5 grid grid-cols-12 gap-2 sm:gap-4 items-center transition-colors ${
                    isHighlighted
                      ? "bg-primary/15 border-l-2 border-l-primary shadow-[inset_0_0_24px_rgba(0,212,255,0.15)]"
                      : isUser
                      ? "bg-primary/5 border-l-2 border-l-primary/40 hover:bg-primary/10"
                      : i === 0
                      ? "bg-amber-500/5 border-l-2 border-l-amber-500/50 hover:bg-muted/20"
                      : i === 1
                      ? "bg-zinc-500/5 border-l-2 border-l-zinc-400/40 hover:bg-muted/20"
                      : i === 2
                      ? "bg-amber-900/5 border-l-2 border-l-amber-700/40 hover:bg-muted/20"
                      : "hover:bg-muted/20"
                  }`}
                >
                  <div className="col-span-1">{rankBadge(i)}</div>
                  <div className="col-span-6 sm:col-span-5 min-w-0 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      {entry.username && !entry.username.startsWith("0x") ? (
                        <>
                          <p className="text-xs sm:text-sm font-medium truncate">{entry.username}</p>
                          <p className="text-[10px] sm:text-xs font-mono text-muted-foreground/60 truncate">
                            {formatAddress(entry.address)}
                          </p>
                        </>
                      ) : (
                        <span className="font-mono text-xs sm:text-sm truncate block">{formatAddress(entry.address)}</span>
                      )}
                    </div>
                    {isUser && (
                      <button
                        onClick={() => setShareOpen(true)}
                        data-testid="btn-share-my-rank"
                        title="Share my rank"
                        className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-md bg-primary/15 border border-primary/40 text-primary text-[10px] sm:text-xs font-semibold hover:bg-primary/25 transition-colors"
                      >
                        <Share2 size={11} />
                        <span className="hidden sm:inline">Share My Rank</span>
                        <span className="sm:hidden">Share</span>
                      </button>
                    )}
                  </div>
                  <div className={`col-span-3 text-right font-bold tabular-nums text-xs sm:text-base truncate ${
                    i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-600" : "text-primary"
                  }`}>
                    {(entry.points ?? 0).toLocaleString()}
                  </div>
                  <div className="col-span-2 sm:col-span-3 text-right text-foreground text-xs sm:text-sm tabular-nums truncate">
                    {formatWeight(entry.points ?? 0)}
                  </div>
                </motion.div>
                );
              })}

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

      {userEntry && (
        <ShareRankModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          rank={userIndex + 1}
          totalUsers={mapsScores?.length ?? 0}
          username={userEntry.username ?? null}
          address={userEntry.address}
          points={userEntry.points ?? 0}
          weightPct={weightPctFor(userEntry.points ?? 0)}
        />
      )}
    </div>
  );
}

// Returns the next Friday at 12:00 UTC (epoch flip time) strictly after `now`.
function nextEpochFlip(now: number): number {
  const d = new Date(now);
  const candidate = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0, 0),
  );
  // 5 = Friday. Move forward to the next Friday at 12:00 UTC.
  const daysUntilFriday = (5 - candidate.getUTCDay() + 7) % 7;
  candidate.setUTCDate(candidate.getUTCDate() + daysUntilFriday);
  if (candidate.getTime() <= now) {
    candidate.setUTCDate(candidate.getUTCDate() + 7);
  }
  return candidate.getTime();
}

function EpochCountdown() {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const endMs = useMemo(() => nextEpochFlip(now), [now]);
  const remaining = Math.max(0, endMs - now);
  const ended = remaining === 0;

  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  const blocks = [
    { label: "Days", value: pad(days) },
    { label: "Hours", value: pad(hours) },
    { label: "Minutes", value: pad(minutes) },
    { label: "Seconds", value: pad(seconds) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mt-4 rounded-lg border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 via-background to-background p-2.5 sm:p-3 max-w-sm"
      data-testid="epoch-countdown"
      role="timer"
      aria-live="off"
      aria-label={`Epoch ends in ${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Clock size={11} className="text-cyan-400" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {ended ? "Epoch ended" : "Epoch ends in"}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {blocks.map((b) => (
          <div
            key={b.label}
            className="rounded-md bg-card/50 border border-border/40 px-1.5 py-2 text-center"
            data-testid={`epoch-countdown-${b.label.toLowerCase()}`}
          >
            <div className="font-mono font-bold text-base sm:text-xl text-cyan-300 tabular-nums leading-none">
              {b.value}
            </div>
            <div className="text-[8px] sm:text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
              {b.label}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

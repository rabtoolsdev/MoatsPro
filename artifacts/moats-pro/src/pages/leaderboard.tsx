import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Crown, Search, Share2, Wallet, Clock, Activity } from "lucide-react";
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
        <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(251,191,36,0.3)]">
          <Crown size={16} className="text-amber-400 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]" />
        </span>
      );
    if (rank === 1)
      return (
        <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-zinc-500/20 border border-zinc-400/50 flex items-center justify-center shadow-[0_0_12px_rgba(212,212,216,0.2)]">
          <Medal size={16} className="text-zinc-300 drop-shadow-[0_0_5px_rgba(212,212,216,0.6)]" />
        </span>
      );
    if (rank === 2)
      return (
        <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-amber-900/30 border border-amber-600/50 flex items-center justify-center shadow-[0_0_12px_rgba(180,83,9,0.3)]">
          <Medal size={16} className="text-amber-500 drop-shadow-[0_0_5px_rgba(180,83,9,0.8)]" />
        </span>
      );
    return (
      <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm font-mono font-bold text-muted-foreground shadow-[inset_0_0_10px_rgba(255,255,255,0.02)]">
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
    <div className="min-h-screen bg-background text-foreground flex flex-col cyber-grid relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10 mix-blend-screen" />
      <div className="absolute top-1/2 right-1/4 w-[600px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none -z-10 mix-blend-screen" />

      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 sm:pt-32 pb-24 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 relative"
        >
          {/* Header left accent */}
          <div className="absolute -left-4 sm:-left-6 top-2 bottom-2 w-px bg-gradient-to-b from-transparent via-primary/50 to-transparent" />
          
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono uppercase tracking-widest text-primary/80">
              <Activity size={10} className="text-primary" />
              MAPS TERMINAL
            </span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white drop-shadow-md mb-4">
            Leaderboard
          </h1>
          
          <EpochCountdown />
          
          <div className="flex flex-wrap items-center gap-3 mt-6">
            <p className="text-muted-foreground/80 font-mono text-sm tracking-wide">
              Top MAPS scorers across all Moats
            </p>
            {currentEpoch && (
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest px-2.5 py-1 rounded-md border ${
                currentEpoch.isComplete
                  ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.15)]"
              }`}>
                {!currentEpoch.isComplete && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)] animate-pulse" />
                )}
                Epoch {currentEpoch.epochNumber} {currentEpoch.isComplete ? "Complete" : "Live"}
              </span>
            )}
          </div>
          {currentEpoch && (
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mt-2 ml-1">
              {currentEpoch.isComplete
                ? `ENDED ${timeAgo(new Date(currentEpoch.endTime).getTime())}`
                : `STARTED ${timeAgo(new Date(currentEpoch.startTime).getTime())}`}
            </p>
          )}
        </motion.div>

        {/* Podium top-3 */}
        {mapsScores && mapsScores.length >= 3 && (
          <div className="grid grid-cols-3 gap-3 sm:gap-5 mb-12 max-w-3xl mx-auto items-end pt-8">
            {podiumOrder.map((idx) => {
              const entry = mapsScores[idx];
              if (!entry) return null;
              const isGold = idx === 0;
              const isSilver = idx === 1;
              const isBronze = idx === 2;
              
              const medalColorClass = isGold ? "text-amber-400" : isSilver ? "text-zinc-300" : "text-amber-600";
              const borderAccentColor = isGold ? "from-amber-400/50" : isSilver ? "from-zinc-400/50" : "from-amber-600/50";
              const shadowGlow = isGold ? "shadow-[0_10px_40px_-10px_rgba(251,191,36,0.3)]" : isSilver ? "shadow-[0_8px_30px_-10px_rgba(212,212,216,0.15)]" : "shadow-[0_8px_30px_-10px_rgba(180,83,9,0.2)]";

              return (
                <motion.div
                  key={entry.address}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: isGold ? 0.3 : isSilver ? 0.1 : 0.2,
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={`relative w-full min-w-0 rounded-2xl border border-white/5 bg-card/40 backdrop-blur-xl p-4 sm:p-6 text-center flex flex-col items-center group overflow-hidden ${shadowGlow}`}
                  style={{
                    height: isGold ? '100%' : '90%',
                    transform: isGold ? 'scale(1.05)' : 'scale(1)',
                    transformOrigin: 'bottom'
                  }}
                >
                  <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
                  <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${borderAccentColor} via-transparent to-transparent opacity-80`} />
                  
                  {isGold && (
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent pointer-events-none" />
                  )}
                  
                  <div className="mb-4 relative z-10">
                    {isGold ? (
                      <div className="relative">
                        <div className="absolute inset-0 bg-amber-400/20 blur-xl rounded-full" />
                        <Crown
                          size={36}
                          className="text-amber-400 mx-auto drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                        />
                      </div>
                    ) : (
                      <Medal
                        size={28}
                        className={`mx-auto ${medalColorClass} drop-shadow-[0_0_5px_currentColor]`}
                      />
                    )}
                  </div>
                  
                  <div className="relative z-10 w-full">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-widest mb-3 ${
                      isGold ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                      isSilver ? 'bg-zinc-500/10 text-zinc-300 border border-zinc-500/20' : 
                      'bg-amber-900/20 text-amber-500 border border-amber-700/30'
                    }`}>
                      {isGold ? "1ST" : isSilver ? "2ND" : "3RD"}
                    </span>
                    
                    <p className="w-full font-mono text-[11px] sm:text-sm font-bold text-white mb-2 truncate px-1">
                      {entry.username && !entry.username.startsWith("0x")
                        ? entry.username
                        : formatAddress(entry.address)}
                    </p>
                    <p className={`w-full font-mono font-black text-xl sm:text-2xl tabular-nums truncate ${medalColorClass} drop-shadow-md`}>
                      {(entry.points ?? 0).toLocaleString()}
                    </p>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">MAPS PTS</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Find My Rank */}
        {mapsScores && mapsScores.length > 0 && (
          <div className="flex flex-col items-center justify-center mb-10 relative">
            <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent -z-10" />
            <button
              onClick={handleFindMyRank}
              data-testid="btn-find-my-rank"
              className="btn-shimmer relative inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-black/60 border border-primary/30 text-primary text-sm font-mono font-bold tracking-wide hover:bg-primary/10 hover:border-primary/60 hover:shadow-[0_0_25px_rgba(0,212,255,0.25)] transition-all"
            >
              {isConnected ? (
                <>
                  <Search size={16} />
                  FIND MY RANK
                </>
              ) : (
                <>
                  <Wallet size={16} />
                  CONNECT WALLET TO FIND MY RANK
                </>
              )}
            </button>
            
            {/* User-not-on-leaderboard hint */}
            {isConnected && mapsScores && mapsScores.length > 0 && userIndex < 0 && (
              <p className="text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground/80 mt-4">
                Your wallet isn't ranked on the current leaderboard yet.
              </p>
            )}
          </div>
        )}

        {/* Full Table */}
        <div className="relative group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent z-10" />
          <div className="absolute -left-px top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-transparent to-transparent z-10" />
          
          <div
            data-testid="leaderboard-table"
            className="rounded-xl border border-white/5 bg-card/30 backdrop-blur-xl overflow-hidden shadow-2xl relative"
          >
            <div className="absolute inset-0 cyber-grid opacity-20 pointer-events-none" />
            
            {mapsLoading ? (
              <div className="p-8 space-y-3 relative z-10">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-14 rounded-lg skeleton-shimmer border border-white/5" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-white/5 relative z-10">
                <div className="px-4 sm:px-6 py-4 grid grid-cols-12 gap-2 sm:gap-4 text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-muted-foreground/80 border-b border-primary/20 bg-black/40">
                  <span className="col-span-2 sm:col-span-1">RANK</span>
                  <span className="col-span-5 sm:col-span-5 min-w-0">WALLET / USERNAME</span>
                  <span className="col-span-3 text-right">MAPS</span>
                  <span className="col-span-2 sm:col-span-3 text-right">WEIGHT</span>
                </div>

                {(mapsScores || []).map((entry, i) => {
                  const isUser =
                    address && entry.address.toLowerCase() === address.toLowerCase();
                  const isHighlighted =
                    highlightAddr && entry.address.toLowerCase() === highlightAddr;
                    
                  const isTop3 = i < 3;
                  const scoreColor = i === 0 ? "text-amber-400" : i === 1 ? "text-zinc-300" : i === 2 ? "text-amber-500" : "text-primary";
                  
                  return (
                  <motion.div
                    key={entry.address}
                    ref={isUser ? userRowRef : undefined}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.015, 0.4) }}
                    data-testid={`row-leaderboard-${i}`}
                    className={`px-4 sm:px-6 py-4 grid grid-cols-12 gap-2 sm:gap-4 items-center transition-all duration-300 relative overflow-hidden group/row ${
                      isHighlighted
                        ? "bg-primary/10 border-l-2 border-l-primary shadow-[inset_0_0_30px_rgba(0,212,255,0.15)]"
                        : isUser
                        ? "bg-primary/5 border-l-2 border-l-primary/50 hover:bg-primary/10"
                        : i === 0
                        ? "bg-amber-500/5 hover:bg-white/5"
                        : i === 1
                        ? "bg-zinc-500/5 hover:bg-white/5"
                        : i === 2
                        ? "bg-amber-900/5 hover:bg-white/5"
                        : "hover:bg-white/5 hover:shadow-[inset_0_0_20px_rgba(0,212,255,0.05)]"
                    }`}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/0 group-hover/row:bg-primary/50 transition-colors" />
                    
                    <div className="col-span-2 sm:col-span-1 relative z-10">{rankBadge(i)}</div>
                    
                    <div className="col-span-5 sm:col-span-5 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 relative z-10">
                      <div className="min-w-0">
                        {entry.username && !entry.username.startsWith("0x") ? (
                          <>
                            <p className="text-xs sm:text-sm font-bold text-white truncate drop-shadow-sm">{entry.username}</p>
                            <p className="text-[10px] font-mono text-muted-foreground/60 truncate">
                              {formatAddress(entry.address)}
                            </p>
                          </>
                        ) : (
                          <span className="font-mono text-xs sm:text-sm text-white truncate block">{formatAddress(entry.address)}</span>
                        )}
                      </div>
                      {isUser && (
                        <button
                          onClick={() => setShareOpen(true)}
                          data-testid="btn-share-my-rank"
                          title="Share my rank"
                          className="btn-shimmer flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded bg-primary/10 border border-primary/30 text-primary text-[10px] font-mono font-bold tracking-wide hover:bg-primary/20 hover:border-primary/50 hover:shadow-[0_0_10px_rgba(0,212,255,0.2)] transition-all mt-1 sm:mt-0"
                        >
                          <Share2 size={11} />
                          <span className="hidden sm:inline">SHARE MY RANK</span>
                          <span className="sm:hidden">SHARE</span>
                        </button>
                      )}
                    </div>
                    
                    <div className={`col-span-3 text-right font-mono font-bold tabular-nums text-sm sm:text-base truncate relative z-10 drop-shadow-sm ${scoreColor}`}>
                      {(entry.points ?? 0).toLocaleString()}
                    </div>
                    
                    <div className="col-span-2 sm:col-span-3 text-right font-mono text-muted-foreground/80 text-[11px] sm:text-xs tabular-nums truncate relative z-10">
                      {formatWeight(entry.points ?? 0)}
                    </div>
                  </motion.div>
                  );
                })}

                {(!mapsScores || mapsScores.length === 0) && (
                  <div className="p-16 text-center">
                    <Trophy size={48} className="mx-auto mb-4 text-muted-foreground/20" />
                    <p className="text-sm font-mono text-muted-foreground tracking-wide">No MAPS scores available yet.</p>
                  </div>
                )}
              </div>
            )}
          </div>
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
    { label: "DAYS", value: pad(days) },
    { label: "HOURS", value: pad(hours) },
    { label: "MINS", value: pad(minutes) },
    { label: "SECS", value: pad(seconds) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mt-6 rounded-xl border border-cyan-500/30 bg-black/60 backdrop-blur-md p-3 sm:p-4 max-w-[320px] relative overflow-hidden shadow-[0_0_20px_rgba(0,212,255,0.1)] group"
      data-testid="epoch-countdown"
      role="timer"
      aria-live="off"
      aria-label={`Epoch ends in ${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`}
    >
      <div className="absolute inset-0 cyber-grid opacity-30 pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      
      <div className="flex items-center gap-2 mb-3 relative z-10">
        <Clock size={12} className="text-cyan-400" />
        <span className="text-[10px] uppercase tracking-widest text-cyan-300 font-mono font-bold drop-shadow-[0_0_5px_rgba(0,212,255,0.5)]">
          {ended ? "EPOCH ENDED" : "EPOCH ENDS IN"}
        </span>
      </div>
      
      <div className="grid grid-cols-4 gap-2 relative z-10">
        {blocks.map((b) => (
          <div
            key={b.label}
            className="rounded-lg bg-black/80 border border-cyan-500/20 px-1 py-2 sm:py-2.5 text-center shadow-[inset_0_0_10px_rgba(0,212,255,0.05)] flex flex-col items-center justify-center relative overflow-hidden group-hover:border-cyan-500/40 transition-colors"
            data-testid={`epoch-countdown-${b.label.toLowerCase()}`}
          >
            <div className="absolute top-0 inset-x-0 h-[1px] bg-cyan-500/20" />
            <div className="font-mono font-black text-lg sm:text-2xl text-cyan-300 tabular-nums leading-none drop-shadow-[0_0_8px_rgba(0,212,255,0.8)]">
              {b.value}
            </div>
            <div className="text-[8px] sm:text-[9px] font-mono uppercase tracking-widest text-cyan-500/80 mt-1.5 font-bold">
              {b.label}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

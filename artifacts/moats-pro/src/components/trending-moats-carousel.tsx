import { useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Flame, TrendingUp, Users, DollarSign } from "lucide-react";
import { MoatLogo } from "@/components/moat-card";
import { getMoatMeta } from "@/lib/moat-metadata";
import { useTrendingMoats, type TrendingMoat } from "@/hooks/use-trending-moats";
import type { MoatConfig } from "@/lib/moats-api";

interface TrendingMoatsCarouselProps {
  configs?: MoatConfig[];
  tvmMap?: Record<string, number>;
  /** Optional `${moatLower}` → on-chain logo URL map (passed through from home) */
  logoUrls?: Record<string, string>;
}

const networkLabels: Record<string, string> = {
  avalanche: "Avalanche",
  ethereum: "Ethereum",
  arbitrum: "Arbitrum",
  base: "Base",
  optimism: "Optimism",
  polygon: "Polygon",
  bsc: "BNB",
  bnb: "BNB",
  monad: "Monad",
  thegrotto: "The Grotto",
  blaze: "Blaze",
};

function fmtUsd(n: number): string {
  if (!isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function rankAccent(rank: number) {
  if (rank === 1) return { ring: "ring-amber-400/60", chip: "from-amber-400 to-orange-500", glow: "shadow-[0_0_24px_-4px_rgba(251,191,36,0.45)]" };
  if (rank === 2) return { ring: "ring-zinc-300/50", chip: "from-zinc-200 to-zinc-400", glow: "shadow-[0_0_22px_-4px_rgba(228,228,231,0.35)]" };
  if (rank === 3) return { ring: "ring-orange-500/50", chip: "from-orange-500 to-amber-700", glow: "shadow-[0_0_22px_-4px_rgba(249,115,22,0.35)]" };
  return { ring: "ring-primary/30", chip: "from-primary/80 to-cyan-500", glow: "shadow-[0_0_18px_-6px_rgba(0,212,255,0.35)]" };
}

function TrendingCard({ item, logoUrls }: { item: TrendingMoat; logoUrls?: Record<string, string> }) {
  const { config, tvmUsd, rewards7dUsd, activeWallets7d, rank } = item;
  const meta = getMoatMeta(config.contractAddress);
  const accent = rankAccent(rank);
  const primaryTokenAddress = meta.tokenAddress || config.rewardTokens.find((t) => t.enabled)?.tokenAddress;
  const onChainLogo = logoUrls?.[config.contractAddress.toLowerCase()];

  return (
    <Link href={`/moat/${config.contractAddress}`}>
      <motion.div
        whileHover={{ y: -4, scale: 1.015 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        data-testid={`trending-card-${config.contractAddress}`}
        className={`relative w-[280px] sm:w-[300px] shrink-0 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden cursor-pointer group hover:border-primary/40 transition-colors ${accent.glow}`}
      >
        {/* Top accent bar */}
        <div className={`h-[2px] w-full bg-gradient-to-r ${accent.chip}`} />

        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`relative shrink-0 rounded-xl ring-2 ${accent.ring} ring-offset-2 ring-offset-card/60`}>
                <MoatLogo meta={meta} primaryTokenAddress={primaryTokenAddress} onChainLogoUrl={onChainLogo} size="sm" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                  {meta.name}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {networkLabels[(config.network || "").toLowerCase()] || config.network || "—"}
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-black bg-gradient-to-r ${accent.chip}`}
            >
              <Flame size={10} />#{rank}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <DollarSign size={9} />TVM
              </span>
              <span className="text-sm font-bold tabular-nums text-amber-400">{fmtUsd(tvmUsd)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <TrendingUp size={9} />7d Rwd
              </span>
              <span className="text-sm font-bold tabular-nums text-emerald-400">{fmtUsd(rewards7dUsd)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                <Users size={9} />7d Users
              </span>
              <span className="text-sm font-bold tabular-nums text-primary">
                {activeWallets7d.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="w-[280px] sm:w-[300px] shrink-0 rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
      <div className="h-[2px] w-full bg-border/40" />
      <div className="p-4 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-muted/40" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-muted/40 rounded" />
            <div className="h-2 w-16 bg-muted/30 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/40">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-2 w-10 bg-muted/30 rounded" />
              <div className="h-4 w-14 bg-muted/40 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TrendingMoatsCarousel({ configs, tvmMap, logoUrls }: TrendingMoatsCarouselProps) {
  const { trending, isLoading } = useTrendingMoats({ configs, tvmMap, limit: 10 });

  // Duplicate the list so the marquee can loop seamlessly via -50% translate
  const doubled = useMemo(() => [...trending, ...trending], [trending]);

  // Hide gracefully if no trending data after load
  if (!isLoading && trending.length === 0) return null;

  return (
    <section
      data-testid="section-trending-moats"
      className="relative w-full border-b border-white/5 bg-black/20 backdrop-blur-md overflow-hidden cyber-grid pt-10 pb-6"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_15px_rgba(0,212,255,0.6)]" />
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 mb-5 relative z-10">
        <div>
          <h2 className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-widest flex items-center gap-2">
            <Flame className="w-3 h-3 text-orange-400" />
            Trending Moats
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Top performers by TVM, rewards distributed, and active users over the last 7 days
          </p>
        </div>
      </div>

      <div
        className="group relative overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent 0, #000 64px, #000 calc(100% - 64px), transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0, #000 64px, #000 calc(100% - 64px), transparent 100%)",
        }}
      >
        {isLoading ? (
          <div className="flex gap-4 py-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <motion.div
            className="flex gap-4 py-2 w-max group-hover:[animation-play-state:paused]"
            style={{
              animation: `trending-marquee ${Math.max(30, trending.length * 6)}s linear infinite`,
            }}
          >
            {doubled.map((item, i) => (
              <TrendingCard
                key={`${item.config.contractAddress}-${i}`}
                item={item}
                logoUrls={logoUrls}
              />
            ))}
          </motion.div>
        )}
      </div>

      <style>{`
        @keyframes trending-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}

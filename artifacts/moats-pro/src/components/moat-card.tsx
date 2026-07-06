import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Coins, CheckCircle, Droplets } from "lucide-react";
import { formatAddress, getMoatMeta, formatUSD, getTokenLogoUrl } from "@/lib/moat-metadata";
import type { MoatMeta } from "@/lib/moat-metadata";
import type { MoatConfig } from "@/lib/moats-api";

interface MoatCardProps {
  moat: MoatConfig;
  tvlUSD?: number;
  supplyPct?: number;
  logoUrl?: string;
  /** Sum of USD liquidity across all DexScreener pools for the staking token */
  dexLiquidityUSD?: number;
  /** Number of liquidity pools found on DexScreener */
  dexPairCount?: number;
  /** Estimated tokens-per-day per `${moatLower}_${tokenLower}` for percentage-based reward Moats */
  dailyEstimates?: Record<string, number>;
  /** Live `balanceOf(publicAddress)` per `${moatLower}_${tokenLower}` for the off-chain reward wallet */
  poolBalances?: Record<string, number>;
}

const statusColors: Record<string, { border: string; badge: string; text: string; hoverGlow: string; icon: string; bgHighlight: string }> = {
  Verified: {
    border: "border-emerald-500/30",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(52,211,153,0.1)]",
    text: "text-emerald-400",
    hoverGlow: "0 0 0 1px rgba(52,211,153,0.4), 0 8px 40px -8px rgba(52,211,153,0.2), inset 0 0 20px rgba(52,211,153,0.05)",
    icon: "text-emerald-400",
    bgHighlight: "from-emerald-500/5",
  },
  Community: {
    border: "border-cyan-500/30",
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(0,212,255,0.1)]",
    text: "text-cyan-400",
    hoverGlow: "0 0 0 1px rgba(0,212,255,0.4), 0 8px 40px -8px rgba(0,212,255,0.2), inset 0 0 20px rgba(0,212,255,0.05)",
    icon: "text-cyan-400",
    bgHighlight: "from-cyan-500/5",
  },
  Deprecated: {
    border: "border-zinc-500/30",
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
    text: "text-zinc-400",
    hoverGlow: "0 0 0 1px rgba(161,161,170,0.3), 0 8px 32px rgba(0,0,0,0.4)",
    icon: "text-zinc-400",
    bgHighlight: "from-zinc-500/5",
  },
};

// Generic placeholder strategy copied across many Moats — adds no signal on a card.
function isBoilerplateStrategy(s: string): boolean {
  return s
    .trim()
    .toLowerCase()
    .includes("managed and distributed independently by the team");
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

function NetworkBadge({ network }: { network?: string }) {
  if (!network) return null;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest bg-black/40 border border-white/10 text-muted-foreground/80">
      {networkLabels[network.toLowerCase()] || network}
    </span>
  );
}

function MoatLogo({
  meta,
  primaryTokenAddress,
  onChainLogoUrl,
  size = "sm",
}: {
  meta: MoatMeta;
  primaryTokenAddress?: string;
  onChainLogoUrl?: string;
  size?: "sm" | "lg";
}) {
  const [failedUrl, setFailedUrl] = useState("");

  const sizeClass = size === "sm"
    ? "w-11 h-11 text-sm"
    : "w-14 h-14 text-xl";

  const logoUrl =
    (onChainLogoUrl && onChainLogoUrl.length > 0 ? onChainLogoUrl : null) ||
    meta.logoUrl ||
    (primaryTokenAddress ? getTokenLogoUrl(primaryTokenAddress) : "");

  if (logoUrl && logoUrl !== failedUrl) {
    return (
      <img
        src={logoUrl}
        alt={meta.name}
        className={`${sizeClass} rounded-[10px] object-cover shrink-0 border border-white/10 bg-black/40 shadow-sm`}
        onError={() => setFailedUrl(logoUrl)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-[10px] bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black shrink-0 shadow-[inset_0_0_10px_rgba(0,212,255,0.1)]`}
    >
      {meta.tokenSymbol.slice(0, 2)}
    </div>
  );
}

export { MoatLogo };

export function MoatCard({ moat, tvlUSD, supplyPct, logoUrl, dexLiquidityUSD, dexPairCount, dailyEstimates, poolBalances }: MoatCardProps) {
  const statusStyle = statusColors[moat.status] || statusColors.Community;
  const activeRewardTokens = moat.rewardTokens.filter((t) => t.enabled);
  const meta = getMoatMeta(moat.contractAddress);
  const primaryTokenAddress = meta.tokenAddress || activeRewardTokens[0]?.tokenAddress;

  const moatLower = moat.contractAddress.toLowerCase();
  const poolToken = activeRewardTokens.find((t) => {
    const bal = poolBalances?.[`${moatLower}_${t.tokenAddress.toLowerCase()}`] ?? 0;
    return bal > 0;
  });
  const poolBal = poolToken
    ? poolBalances?.[`${moatLower}_${poolToken.tokenAddress.toLowerCase()}`] ?? 0
    : 0;
  const hasDexMetric = dexLiquidityUSD !== undefined && dexLiquidityUSD > 0;
  const hasSubMetrics = !!poolToken || hasDexMetric;

  return (
    <Link href={`/moat/${moat.contractAddress}`}>
      <motion.div
        data-testid={`card-moat-${moat.contractAddress}`}
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
        className={`relative cursor-pointer rounded-2xl border ${statusStyle.border} bg-card/80 backdrop-blur-sm overflow-hidden group h-full flex flex-col cyber-grid`}
        style={{
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
          contain: "layout paint",
          willChange: "transform",
        }}
      >
        {/* Glow overlay — opacity-only transition, GPU-composited */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
          style={{ boxShadow: statusStyle.hoverGlow }}
        />
        {/* Subtle background highlight based on status */}
        <div className={`absolute inset-0 bg-gradient-to-br ${statusStyle.bgHighlight} via-transparent to-transparent opacity-20 group-hover:opacity-70 transition-opacity duration-300 pointer-events-none`} />

        {/* Top edge highlight */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        <div className="relative p-5 flex flex-col flex-1 z-10">
          <div className="flex items-start justify-between mb-5 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <MoatLogo meta={meta} primaryTokenAddress={primaryTokenAddress} onChainLogoUrl={logoUrl} size="sm" />
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <p
                  data-testid={`text-moat-name-${moat.contractAddress}`}
                  className="font-bold text-foreground leading-tight text-base truncate group-hover:text-white transition-colors duration-300 drop-shadow-sm"
                >
                  {meta.name}
                </p>
                <p className="text-xs font-mono text-muted-foreground/80 mt-0.5 tracking-tight truncate uppercase">{meta.protocol}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-1">
                {moat.status === "Verified" && (
                  <CheckCircle size={10} strokeWidth={3} className={statusStyle.icon} />
                )}
                <span
                  data-testid={`text-moat-status-${moat.contractAddress}`}
                  className={`text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-[4px] border ${statusStyle.badge} backdrop-blur-md`}
                >
                  {moat.status}
                </span>
              </div>
              <NetworkBadge network={moat.network} />
            </div>
          </div>

          {moat.rewardStrategy && !isBoilerplateStrategy(moat.rewardStrategy) && (
            <div className="mb-5 text-xs text-muted-foreground/90 line-clamp-2 leading-relaxed border-l-2 border-primary/30 pl-3 relative">
              {/* Glowing line overlay on hover */}
              <div className="absolute left-[-2px] top-0 bottom-0 w-[2px] bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-[0_0_8px_var(--color-primary)]" />
              {moat.rewardStrategy}
            </div>
          )}

          {moat.tags && moat.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5" data-testid={`tags-moat-${moat.contractAddress}`}>
              {moat.tags.slice(0, 4).map((t) => (
                <span
                  key={t._id ?? t.name}
                  data-testid={`tag-${t.name}`}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest bg-white/5 border border-white/10 text-muted-foreground group-hover:bg-white/10 transition-colors"
                >
                  {t.color && (
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_6px_currentColor]" style={{ backgroundColor: t.color, color: t.color }} />
                  )}
                  {t.name}
                </span>
              ))}
              {moat.tags.length > 4 && (
                <span className="text-[9px] font-mono text-muted-foreground/50 px-1 py-0.5">
                  +{moat.tags.length - 4}
                </span>
              )}
            </div>
          )}

          {activeRewardTokens.length > 0 && (
            <div className="mb-6">
              <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Coins size={10} className="text-primary/70" />
                Reward Tokens
              </p>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const fmtAmt = (v: number) => {
                    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                    if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
                    if (v > 0) return parseFloat(v.toPrecision(4)).toString();
                    return "0";
                  };
                  const moatLower = moat.contractAddress.toLowerCase();
                  const visible = activeRewardTokens.filter((t) => {
                    const est = dailyEstimates?.[`${moatLower}_${t.tokenAddress.toLowerCase()}`] ?? 0;
                    return t.tokenAmount > 0 || t.totalRewardsDeposited > 0 || est > 0;
                  });
                  return (
                    <>
                      {visible.slice(0, 3).map((token) => {
                        const est = dailyEstimates?.[`${moatLower}_${token.tokenAddress.toLowerCase()}`] ?? 0;
                        const freqH = token.frequencyHours ?? 24;
                        const distsPerDay = freqH > 0 ? 24 / freqH : 1;
                        let label: string;
                        if (token.tokenAmount > 0) label = `${fmtAmt(token.tokenAmount * distsPerDay)}/day`;
                        else if (est > 0) label = `~${fmtAmt(est)}/day`;
                        else label = fmtAmt(token.totalRewardsDeposited);
                        return (
                          <span
                            key={token._id}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-black/40 border border-primary/20 text-xs font-bold text-white shadow-sm group-hover:border-primary/40 transition-colors"
                          >
                            {token.symbol}
                            <span className="text-primary/80 font-mono font-medium text-[10px]">{label}</span>
                          </span>
                        );
                      })}
                      {visible.length > 3 && (
                        <span className="text-[10px] font-mono text-muted-foreground/50 px-1 py-1 flex items-center">
                          +{visible.length - 3} MORE
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <div className="mt-auto pt-5 relative">
            {/* Custom glowing divider */}
            <div className="absolute top-0 left-0 right-0 h-px cyber-lines opacity-50" />

            {/* Main Metric Box */}
            {((tvlUSD !== undefined && tvlUSD > 0) || (supplyPct !== undefined && supplyPct > 0)) && (
              <div className="bg-black/30 rounded-xl p-3 border border-white/5 mb-4 group-hover:border-white/10 transition-colors relative overflow-hidden shadow-inner">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                
                <div className="relative flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5 mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${moat.status === "Verified" ? "bg-emerald-500/80 shadow-[0_0_6px_rgba(52,211,153,0.7)]" : "bg-cyan-500/80 shadow-[0_0_6px_rgba(0,212,255,0.7)]"}`} />
                      Value Moated
                    </p>
                    <p
                      data-testid={`text-tvl-${moat.contractAddress}`}
                      className="text-2xl font-black text-white tabular-nums tracking-tight drop-shadow-md leading-none"
                    >
                      {tvlUSD !== undefined && tvlUSD > 0 ? formatUSD(tvlUSD) : "—"}
                    </p>
                  </div>
                  {supplyPct !== undefined && supplyPct > 0 && (
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">
                        Supply %
                      </p>
                      <p className="text-sm font-bold text-cyan-400 tabular-nums leading-none">
                        {supplyPct >= 0.01 ? `${supplyPct.toFixed(2)}%` : "<0.01%"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sub Metrics Grid — only rendered when at least one metric exists */}
            {hasSubMetrics && (
              <div className="grid grid-cols-2 gap-3 text-xs mb-5 px-1">
                {poolToken && (() => {
                  const fmtPool = (v: number) => {
                    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
                    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
                    if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
                    if (v > 0) return parseFloat(v.toPrecision(4)).toString();
                    return "0";
                  };
                  return (
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1">
                        Total Pool
                      </span>
                      <span data-testid={`text-pool-${moat.contractAddress}`} className="font-bold text-emerald-400 tabular-nums">
                        {fmtPool(poolBal)} {poolToken.symbol}
                      </span>
                    </div>
                  );
                })()}

                {hasDexMetric && (
                  <div className={`flex flex-col gap-1 ${poolToken ? "items-end text-right" : ""}`}>
                    <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1">
                      <Droplets size={9} className="text-cyan-500/80" />
                      DEX TVL
                      {dexPairCount !== undefined && dexPairCount > 0 && (
                        <span className="text-muted-foreground/40 normal-case tracking-normal">
                          · {dexPairCount} {dexPairCount === 1 ? "pool" : "pools"}
                        </span>
                      )}
                    </span>
                    <span data-testid={`text-dex-tvl-${moat.contractAddress}`} className="font-bold text-cyan-400 tabular-nums">
                      {formatUSD(dexLiquidityUSD!)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* View moat affordance */}
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest pt-3 border-t border-white/5 group-hover:border-white/10 transition-colors">
              <span className="text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors duration-300">
                Explore Protocol
              </span>
              <div className="flex items-center gap-1.5 text-primary/70 group-hover:text-primary transition-colors duration-300">
                <span className="font-bold">Access Terminal</span>
                <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

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

const statusColors: Record<string, { border: string; badge: string; text: string; hoverGlow: string }> = {
  Verified: {
    border: "border-emerald-500/20",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    text: "text-emerald-400",
    hoverGlow: "0 0 0 1px rgba(52,211,153,0.3), 0 8px 32px rgba(52,211,153,0.08)",
  },
  Community: {
    border: "border-cyan-500/20",
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    text: "text-cyan-400",
    hoverGlow: "0 0 0 1px rgba(0,212,255,0.3), 0 8px 32px rgba(0,212,255,0.08)",
  },
  Deprecated: {
    border: "border-zinc-500/20",
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    text: "text-zinc-400",
    hoverGlow: "",
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
};

function NetworkBadge({ network }: { network?: string }) {
  if (!network) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/50 border border-border/50 text-xs text-muted-foreground">
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
    ? "w-10 h-10 text-sm"
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
        className={`${sizeClass} rounded-xl object-cover shrink-0 border border-border/30`}
        onError={() => setFailedUrl(logoUrl)}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center text-primary font-bold shrink-0`}
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

  return (
    <Link href={`/moat/${moat.contractAddress}`}>
      <motion.div
        data-testid={`card-moat-${moat.contractAddress}`}
        whileHover={{ y: -4, scale: 1.01, boxShadow: statusStyle.hoverGlow || "none" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`btn-shimmer relative cursor-pointer rounded-2xl border ${statusStyle.border} bg-card/40 backdrop-blur-sm overflow-hidden group h-full flex flex-col`}
      >
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        </div>

        <div className="relative p-6 flex flex-col flex-1">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <MoatLogo meta={meta} primaryTokenAddress={primaryTokenAddress} onChainLogoUrl={logoUrl} size="sm" />
              <div className="min-w-0">
                <p
                  data-testid={`text-moat-name-${moat.contractAddress}`}
                  className="font-bold text-foreground leading-tight text-sm truncate group-hover:text-primary transition-colors duration-200"
                >
                  {meta.name}
                </p>
                <p className="text-xs text-muted-foreground">{meta.protocol}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
              <div className="flex items-center gap-1.5">
                {moat.status === "Verified" && (
                  <CheckCircle size={12} className="text-emerald-400" />
                )}
                <span
                  data-testid={`text-moat-status-${moat.contractAddress}`}
                  className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyle.badge}`}
                >
                  {moat.status}
                </span>
              </div>
              <NetworkBadge network={moat.network} />
            </div>
          </div>

          {moat.rewardStrategy && !isBoilerplateStrategy(moat.rewardStrategy) && (
            <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
              {moat.rewardStrategy}
            </p>
          )}

          {moat.tags && moat.tags.length > 0 && (
            <div
              className="flex flex-wrap gap-1.5 mb-4"
              data-testid={`tags-moat-${moat.contractAddress}`}
            >
              {moat.tags.slice(0, 4).map((t) => (
                <span
                  key={t._id ?? t.name}
                  data-testid={`tag-${t.name}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-card/60 border border-border/60 text-muted-foreground"
                >
                  {t.color && (
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                  )}
                  {t.name}
                </span>
              ))}
              {moat.tags.length > 4 && (
                <span className="text-[10px] text-muted-foreground/70 px-1.5 py-0.5">
                  +{moat.tags.length - 4}
                </span>
              )}
            </div>
          )}

          {activeRewardTokens.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Coins size={11} />
                Reward Tokens
              </p>
              <div className="flex flex-wrap gap-1.5">
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
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-primary"
                          >
                            {token.symbol}
                            <span className="text-muted-foreground text-xs">{label}</span>
                          </span>
                        );
                      })}
                      {visible.length > 3 && (
                        <span className="text-xs text-muted-foreground px-2 py-1">
                          +{visible.length - 3} more
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          <div className="mt-auto pt-3 border-t border-border/40 space-y-2">
            {(() => {
              const moatLower = moat.contractAddress.toLowerCase();
              const poolToken = activeRewardTokens.find((t) => {
                const bal = poolBalances?.[`${moatLower}_${t.tokenAddress.toLowerCase()}`] ?? 0;
                return bal > 0;
              });
              if (!poolToken) return null;
              const bal = poolBalances?.[`${moatLower}_${poolToken.tokenAddress.toLowerCase()}`] ?? 0;
              const fmtPool = (v: number) => {
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
                if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
                if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
                if (v > 0) return parseFloat(v.toPrecision(4)).toString();
                return "0";
              };
              return (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total Pool</span>
                  <span
                    data-testid={`text-pool-${moat.contractAddress}`}
                    className="font-bold text-emerald-400 tabular-nums"
                  >
                    {fmtPool(bal)} {poolToken.symbol}
                  </span>
                </div>
              );
            })()}
            {dexLiquidityUSD !== undefined && dexLiquidityUSD > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <Droplets size={11} className="text-cyan-400/80" />
                  DEX TVL
                  {dexPairCount !== undefined && dexPairCount > 0 && (
                    <span className="text-muted-foreground/60">
                      · {dexPairCount} {dexPairCount === 1 ? "pool" : "pools"}
                    </span>
                  )}
                </span>
                <span
                  data-testid={`text-dex-tvl-${moat.contractAddress}`}
                  className="font-bold text-cyan-300 tabular-nums"
                >
                  {formatUSD(dexLiquidityUSD)}
                </span>
              </div>
            )}

            {/* Headline metrics: TVM is the primary signal, % of supply secondary */}
            {((tvlUSD !== undefined && tvlUSD > 0) ||
              (supplyPct !== undefined && supplyPct > 0)) && (
              <div className="flex items-end justify-between gap-3 pt-1">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    Total Value Moated
                  </p>
                  <p
                    data-testid={`text-tvl-${moat.contractAddress}`}
                    className="text-lg font-bold text-foreground tabular-nums leading-tight"
                  >
                    {tvlUSD !== undefined && tvlUSD > 0 ? formatUSD(tvlUSD) : "—"}
                  </p>
                </div>
                {supplyPct !== undefined && supplyPct > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      % of Supply
                    </p>
                    <p className="text-sm font-bold text-cyan-400 tabular-nums leading-tight">
                      {supplyPct >= 0.01 ? `${supplyPct.toFixed(2)}%` : "<0.01%"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* View moat affordance */}
            <div className="flex items-center justify-end gap-1 pt-1 text-xs font-medium text-muted-foreground/50 group-hover:text-primary transition-colors duration-200">
              View moat
              <ArrowRight
                size={13}
                className="group-hover:translate-x-0.5 transition-transform duration-200"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

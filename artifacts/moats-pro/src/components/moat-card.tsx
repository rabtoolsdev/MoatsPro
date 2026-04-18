import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Coins, CheckCircle } from "lucide-react";
import { formatAddress, getMoatMeta, formatUSD, getTokenLogoUrl } from "@/lib/moat-metadata";
import type { MoatMeta } from "@/lib/moat-metadata";
import type { MoatConfig } from "@/lib/moats-api";

interface MoatCardProps {
  moat: MoatConfig;
  tvlUSD?: number;
  supplyPct?: number;
  logoUrl?: string;
}

const statusColors: Record<string, { border: string; badge: string; text: string }> = {
  Verified: {
    border: "border-emerald-500/20",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    text: "text-emerald-400",
  },
  Community: {
    border: "border-cyan-500/20",
    badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    text: "text-cyan-400",
  },
  Deprecated: {
    border: "border-zinc-500/20",
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    text: "text-zinc-400",
  },
};

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

export function MoatCard({ moat, tvlUSD, supplyPct, logoUrl }: MoatCardProps) {
  const statusStyle = statusColors[moat.status] || statusColors.Community;
  const activeRewardTokens = moat.rewardTokens.filter((t) => t.enabled);
  const meta = getMoatMeta(moat.contractAddress);
  const primaryTokenAddress = meta.tokenAddress || activeRewardTokens[0]?.tokenAddress;

  return (
    <Link href={`/moat/${moat.contractAddress}`}>
      <motion.div
        data-testid={`card-moat-${moat.contractAddress}`}
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className={`relative cursor-pointer rounded-2xl border ${statusStyle.border} bg-card/40 backdrop-blur-sm overflow-hidden group h-full flex flex-col`}
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
        </div>

        <div className="relative p-6 flex flex-col flex-1">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <MoatLogo meta={meta} primaryTokenAddress={primaryTokenAddress} onChainLogoUrl={logoUrl} size="sm" />
              <div className="min-w-0">
                <p
                  data-testid={`text-moat-name-${moat.contractAddress}`}
                  className="font-bold text-foreground leading-tight text-sm truncate"
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

          {moat.rewardStrategy && (
            <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
              {moat.rewardStrategy}
            </p>
          )}

          {activeRewardTokens.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Coins size={11} />
                Reward Tokens
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeRewardTokens
                  .filter((t) => t.tokenAmount > 0 || t.totalRewardsDeposited > 0)
                  .slice(0, 3)
                  .map((token) => {
                    const fmtDeposited = (v: number) => {
                      if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                      if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                      if (v >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
                      if (v > 0) return parseFloat(v.toPrecision(4)).toString();
                      return "0";
                    };
                    return (
                      <span
                        key={token._id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-primary"
                      >
                        {token.symbol}
                        <span className="text-muted-foreground text-xs">
                          {token.tokenAmount > 0
                            ? `${token.tokenAmount >= 1_000_000
                                ? `${(token.tokenAmount / 1_000_000).toFixed(1)}M`
                                : token.tokenAmount >= 1_000
                                ? `${(token.tokenAmount / 1_000).toFixed(0)}K`
                                : token.tokenAmount}/day`
                            : fmtDeposited(token.totalRewardsDeposited)}
                        </span>
                      </span>
                    );
                  })}
                {activeRewardTokens.filter((t) => t.tokenAmount > 0 || t.totalRewardsDeposited > 0).length > 3 && (
                  <span className="text-xs text-muted-foreground px-2 py-1">
                    +{activeRewardTokens.filter((t) => t.tokenAmount > 0 || t.totalRewardsDeposited > 0).length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="mt-auto pt-3 border-t border-border/40 space-y-2">
            {tvlUSD !== undefined && tvlUSD > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">TVM</span>
                <span
                  data-testid={`text-tvl-${moat.contractAddress}`}
                  className="font-bold text-foreground tabular-nums"
                >
                  {formatUSD(tvlUSD)}
                </span>
              </div>
            )}
            {supplyPct !== undefined && supplyPct > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">% of Supply</span>
                <span className="font-bold text-cyan-400 tabular-nums">
                  {supplyPct >= 0.01 ? `${supplyPct.toFixed(2)}%` : "<0.01%"}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

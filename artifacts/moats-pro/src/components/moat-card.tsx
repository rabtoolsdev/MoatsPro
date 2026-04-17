import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Coins, CheckCircle, Users } from "lucide-react";
import { formatAddress } from "@/lib/moat-metadata";
import type { MoatConfig } from "@/lib/moats-api";

interface MoatCardProps {
  moat: MoatConfig;
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

export function MoatCard({ moat }: MoatCardProps) {
  const statusStyle = statusColors[moat.status] || statusColors.Community;
  const activeRewardTokens = moat.rewardTokens.filter((t) => t.enabled);

  return (
    <Link href={`/moat/${moat.contractAddress}`}>
      <motion.div
        data-testid={`card-moat-${moat.contractAddress}`}
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className={`relative cursor-pointer rounded-2xl border ${statusStyle.border} bg-card/40 backdrop-blur-sm overflow-hidden group h-full flex flex-col`}
      >
        {/* Glow on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
        </div>

        <div className="relative p-6 flex flex-col flex-1">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {moat.status === "Verified" && (
                  <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                )}
                <span
                  data-testid={`text-moat-status-${moat.contractAddress}`}
                  className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusStyle.badge}`}
                >
                  {moat.status}
                </span>
                <NetworkBadge network={moat.network} />
              </div>
              <p
                data-testid={`text-moat-name-${moat.contractAddress}`}
                className="font-semibold text-foreground leading-tight font-mono text-sm"
              >
                {formatAddress(moat.contractAddress)}
              </p>
            </div>
            <ArrowRight
              size={16}
              className="text-muted-foreground group-hover:text-primary transition-colors mt-1 shrink-0"
            />
          </div>

          {/* Reward Strategy snippet */}
          {moat.rewardStrategy && (
            <p className="text-xs text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
              {moat.rewardStrategy}
            </p>
          )}

          {/* Reward tokens */}
          {activeRewardTokens.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Coins size={11} />
                Reward Tokens
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeRewardTokens.slice(0, 3).map((token) => (
                  <span
                    key={token._id}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-primary"
                  >
                    {token.symbol}
                    <span className="text-muted-foreground text-xs">
                      {token.tokenAmount >= 1_000_000
                        ? `${(token.tokenAmount / 1_000_000).toFixed(1)}M`
                        : token.tokenAmount >= 1_000
                        ? `${(token.tokenAmount / 1_000).toFixed(0)}K`
                        : token.tokenAmount}
                      /day
                    </span>
                  </span>
                ))}
                {activeRewardTokens.length > 3 && (
                  <span className="text-xs text-muted-foreground px-2 py-1">
                    +{activeRewardTokens.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Footer stats */}
          <div className="mt-auto flex items-center justify-between pt-3 border-t border-border/40">
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                FortWeight:
              </span>{" "}
              <span data-testid={`text-fortweight-${moat.contractAddress}`} className="text-primary font-bold">
                {moat.fortWeight}x
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>v{moat.moatVersion}</span>
              {moat.automatedRewards && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs">
                  Auto
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

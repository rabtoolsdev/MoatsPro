import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Users, Zap } from "lucide-react";
import { formatPoints, formatAddress, getMoatMeta } from "@/lib/moat-metadata";

interface MoatCardProps {
  moat: {
    contractAddress: string;
    name: string;
    protocol: string;
    tokenSymbol: string;
    description?: string;
    logoURL?: string;
    totalPoints: number;
    participantCount: number;
  };
}

const protocolColors: Record<string, string> = {
  "Uniswap V3": "from-pink-500/20 to-purple-500/20 border-pink-500/20",
  "Aave": "from-blue-500/20 to-teal-500/20 border-blue-500/20",
  "Curve": "from-yellow-500/20 to-orange-500/20 border-yellow-500/20",
  "Compound": "from-green-500/20 to-emerald-500/20 border-green-500/20",
  "default": "from-primary/10 to-cyan-500/10 border-primary/20",
};

function getProtocolGradient(protocol: string): string {
  return protocolColors[protocol] || protocolColors.default;
}

function getProtocolInitials(protocol: string): string {
  return protocol
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function MoatCard({ moat }: MoatCardProps) {
  const gradient = getProtocolGradient(moat.protocol);

  return (
    <Link href={`/moat/${moat.contractAddress}`}>
      <motion.div
        data-testid={`card-moat-${moat.contractAddress}`}
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ duration: 0.2 }}
        className={`relative cursor-pointer rounded-2xl border bg-gradient-to-br ${gradient} backdrop-blur-sm overflow-hidden group h-full`}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
        </div>

        <div className="relative p-6 flex flex-col h-full">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {moat.logoURL ? (
                <img
                  src={moat.logoURL}
                  alt={moat.name}
                  className="w-10 h-10 rounded-xl object-contain bg-card/50 p-1"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                  {getProtocolInitials(moat.protocol)}
                </div>
              )}
              <div>
                <h3
                  data-testid={`text-moat-name-${moat.contractAddress}`}
                  className="font-semibold text-foreground leading-tight"
                >
                  {moat.name}
                </h3>
                <p className="text-xs text-muted-foreground">{moat.protocol}</p>
              </div>
            </div>
            <ArrowRight
              size={16}
              className="text-muted-foreground group-hover:text-primary transition-colors mt-1"
            />
          </div>

          {/* Token Symbol Badge */}
          <div className="mb-4">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-background/50 border border-border/50 text-xs font-mono text-muted-foreground">
              {moat.tokenSymbol}
            </span>
          </div>

          {/* Stats */}
          <div className="mt-auto grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-background/30 border border-border/30">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap size={12} className="text-primary" />
                <span className="text-xs text-muted-foreground">Points</span>
              </div>
              <p
                data-testid={`text-points-${moat.contractAddress}`}
                className="font-bold text-lg tabular-nums"
              >
                {formatPoints(moat.totalPoints)}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-background/30 border border-border/30">
              <div className="flex items-center gap-1.5 mb-1">
                <Users size={12} className="text-cyan-400" />
                <span className="text-xs text-muted-foreground">Stakers</span>
              </div>
              <p
                data-testid={`text-stakers-${moat.contractAddress}`}
                className="font-bold text-lg tabular-nums"
              >
                {moat.participantCount.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Contract Address */}
          <p className="mt-3 text-xs text-muted-foreground/60 font-mono">
            {formatAddress(moat.contractAddress)}
          </p>
        </div>
      </motion.div>
    </Link>
  );
}

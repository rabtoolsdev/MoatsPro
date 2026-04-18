import { motion } from "framer-motion";
import { formatAddress, timeAgo, getEventTypeLabel, getEventTypeColor, getExplorerUrl, getMoatMeta, MOAT_METADATA } from "@/lib/moat-metadata";
import { formatUnits } from "viem";
import type { MoatEvent, MoatConfig } from "@/lib/moats-api";

interface ActivityFeedProps {
  events: MoatEvent[];
  moatConfigs?: MoatConfig[];
  showLiveBadge?: boolean;
}

function buildTokenMap(moatConfigs?: MoatConfig[]): Record<string, { symbol: string; decimals: number }> {
  const map: Record<string, { symbol: string; decimals: number }> = {};
  for (const meta of Object.values(MOAT_METADATA)) {
    if (meta.tokenAddress) {
      map[meta.tokenAddress.toLowerCase()] = { symbol: meta.tokenSymbol, decimals: 18 };
    }
  }
  if (moatConfigs) {
    for (const config of moatConfigs) {
      for (const rt of config.rewardTokens) {
        if (rt.tokenAddress) {
          map[rt.tokenAddress.toLowerCase()] = { symbol: rt.symbol, decimals: rt.decimals ?? 18 };
        }
      }
    }
  }
  return map;
}

function formatEventAmount(
  event: MoatEvent,
  tokenMap: Record<string, { symbol: string; decimals: number }>
): string | null {
  const { args, contractAddress, eventType } = event;
  if (!args.amount) return null;

  let symbol: string;
  let decimals = 18;

  if (args.token) {
    const found = tokenMap[args.token.toLowerCase()];
    symbol = found?.symbol ?? formatAddress(args.token);
    decimals = found?.decimals ?? 18;
  } else {
    const meta = getMoatMeta(contractAddress);
    symbol = meta.tokenSymbol;
    const stakingEntry = tokenMap[meta.tokenAddress?.toLowerCase() ?? ""];
    if (stakingEntry) decimals = stakingEntry.decimals;
  }

  try {
    const bigAmt = BigInt(args.amount);
    const num = parseFloat(formatUnits(bigAmt, decimals));
    const formatted =
      num >= 1_000_000
        ? `${(num / 1_000_000).toFixed(2)}M`
        : num >= 1_000
        ? `${(num / 1_000).toFixed(0)}K`
        : num >= 0.01
        ? num.toLocaleString(undefined, { maximumFractionDigits: 2 })
        : parseFloat(num.toPrecision(4)).toString();
    return `${formatted} ${symbol}`;
  } catch {
    return null;
  }
}

const dotColor: Record<string, string> = {
  Staked: "bg-emerald-400",
  Withdrawn: "bg-amber-400",
  Locked: "bg-cyan-400",
  Burned: "bg-rose-400",
  RewardClaimed: "bg-violet-400",
  LockExited: "bg-blue-400",
  EarlyExit: "bg-orange-400",
  RewardsDeposited: "bg-teal-400",
};

const rowAccent: Record<string, string> = {
  Staked: "hover:border-l-emerald-400/60",
  Locked: "hover:border-l-cyan-400/60",
  Burned: "hover:border-l-rose-400/60",
  RewardClaimed: "hover:border-l-violet-400/60",
  Withdrawn: "hover:border-l-amber-400/60",
  LockExited: "hover:border-l-blue-400/60",
  EarlyExit: "hover:border-l-orange-400/60",
  RewardsDeposited: "hover:border-l-teal-400/60",
};

export function ActivityFeed({ events, moatConfigs, showLiveBadge = false }: ActivityFeedProps) {
  const tokenMap = buildTokenMap(moatConfigs);

  return (
    <div className="rounded-2xl border border-border bg-card/30 backdrop-blur-sm overflow-hidden">
      {/* Header with optional LIVE badge */}
      {showLiveBadge && (
        <div className="px-6 py-3.5 border-b border-border/50 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Recent Activity</span>
          <div className="flex items-center gap-2">
            <span className="relative flex items-center justify-center w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
              <span className="relative w-2 h-2 rounded-full bg-emerald-400 live-dot" />
            </span>
            <span className="text-xs font-semibold text-emerald-400 tracking-wide uppercase">Live</span>
          </div>
        </div>
      )}

      <div className="divide-y divide-border/50">
        {events.map((event, i) => {
          const amount = formatEventAmount(event, tokenMap);
          const user = event.args.user;
          const accentClass = rowAccent[event.eventType] || "";
          return (
            <motion.div
              key={event._id || i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
              data-testid={`activity-event-${i}`}
              className={`px-6 py-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition-all border-l-2 border-l-transparent ${accentClass}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Radar-ping dot */}
                <div className="relative shrink-0 flex items-center justify-center w-3 h-3">
                  {i === 0 && (
                    <span
                      className={`absolute inset-0 rounded-full ${dotColor[event.eventType] || "bg-zinc-400"} opacity-0`}
                      style={{ animation: "radar-ping 2s ease-out 0.3s" }}
                    />
                  )}
                  <div
                    className={`w-2 h-2 rounded-full ${dotColor[event.eventType] || "bg-zinc-400"}`}
                  />
                </div>
                <div className="min-w-0">
                  <span
                    className={`text-sm font-semibold ${getEventTypeColor(event.eventType)}`}
                  >
                    {getEventTypeLabel(event.eventType)}
                  </span>
                  {user && (
                    <>
                      <span className="text-muted-foreground text-sm mx-1.5">by</span>
                      <span className="text-sm font-mono text-foreground">
                        {formatAddress(user)}
                      </span>
                    </>
                  )}
                  {amount && (
                    <span className="ml-2 text-xs text-muted-foreground">{amount}</span>
                  )}
                  <span className="ml-2 text-xs text-muted-foreground/60">
                    on {event.network}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-xs text-muted-foreground">
                  {timeAgo(new Date(event.timestamp).getTime())}
                </span>
                <a
                  href={`${getExplorerUrl(event.network)}/tx/${event.transactionHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary/60 hover:text-primary transition-colors font-mono"
                  onClick={(e) => e.stopPropagation()}
                >
                  {event.transactionHash.slice(0, 8)}…
                </a>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

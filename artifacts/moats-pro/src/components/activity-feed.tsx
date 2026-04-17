import { motion } from "framer-motion";
import { formatAddress, timeAgo, getEventTypeLabel, getEventTypeColor, getExplorerUrl } from "@/lib/moat-metadata";
import { formatUnits } from "viem";
import type { MoatEvent } from "@/lib/moats-api";

interface ActivityFeedProps {
  events: MoatEvent[];
}

function formatEventAmount(args: MoatEvent["args"]): string | null {
  if (!args.amount) return null;
  try {
    const bigAmt = BigInt(args.amount);
    const formatted = parseFloat(formatUnits(bigAmt, 18)).toFixed(2);
    return `${Number(formatted).toLocaleString()} tokens`;
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
};

export function ActivityFeed({ events }: ActivityFeedProps) {
  return (
    <div className="rounded-2xl border border-border bg-card/30 backdrop-blur-sm overflow-hidden">
      <div className="divide-y divide-border/50">
        {events.map((event, i) => {
          const amount = formatEventAmount(event.args);
          const user = event.args.user;
          return (
            <motion.div
              key={event._id || i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.4) }}
              data-testid={`activity-event-${i}`}
              className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    dotColor[event.eventType] || "bg-zinc-400"
                  }`}
                />
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

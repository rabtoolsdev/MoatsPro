import { motion } from "framer-motion";
import { getEventTypeLabel, getEventTypeColor, timeAgo, formatAddress } from "@/lib/moat-metadata";
import type { MoatEvent } from "@/lib/moats-api";

interface ActivityFeedProps {
  events: MoatEvent[];
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  return (
    <div className="rounded-2xl border border-border bg-card/30 backdrop-blur-sm overflow-hidden">
      <div className="divide-y divide-border/50">
        {events.map((event, i) => (
          <motion.div
            key={event.id || i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            data-testid={`activity-event-${i}`}
            className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${
                  event.eventType === "Staked"
                    ? "bg-emerald-400"
                    : event.eventType === "Locked"
                    ? "bg-cyan-400"
                    : event.eventType === "Burned"
                    ? "bg-rose-400"
                    : event.eventType === "RewardClaimed"
                    ? "bg-violet-400"
                    : "bg-amber-400"
                }`}
              />
              <div className="min-w-0">
                <span
                  className={`text-sm font-medium ${getEventTypeColor(event.eventType)}`}
                >
                  {getEventTypeLabel(event.eventType)}
                </span>
                <span className="text-muted-foreground text-sm mx-2">by</span>
                <span className="text-sm font-mono text-foreground">
                  {formatAddress(event.contractAddress)}
                </span>
              </div>
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {timeAgo(event.timestamp)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

import { motion } from "framer-motion";
import { Users, TrendingUp, Activity, Award } from "lucide-react";
import { formatPoints } from "@/lib/moat-metadata";
import type { MoatPoint, MapsScore } from "@/lib/moats-api";

interface StatsBarProps {
  allPoints?: MoatPoint[];
  leaderboard?: MapsScore[];
}

export function StatsBar({ allPoints, leaderboard }: StatsBarProps) {
  const totalParticipants = allPoints
    ? new Set(allPoints.map((p) => p.walletAddress)).size
    : 0;
  const totalMoats = allPoints
    ? new Set(allPoints.map((p) => p.contractAddress)).size
    : 0;
  const totalPoints = allPoints
    ? allPoints.reduce((sum, p) => sum + p.points, 0)
    : 0;
  const totalMapsScorers = leaderboard?.length || 0;

  const stats = [
    {
      label: "Total Participants",
      value: totalParticipants.toLocaleString(),
      icon: Users,
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
    },
    {
      label: "Active Moats",
      value: totalMoats.toLocaleString(),
      icon: Activity,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Total Points Earned",
      value: formatPoints(totalPoints),
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      label: "MAPS Scorers",
      value: totalMapsScorers.toLocaleString(),
      icon: Award,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
    },
  ];

  return (
    <section className="border-y border-border/50 bg-card/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}
              className="flex items-center gap-3"
            >
              <div className={`p-2.5 rounded-xl ${stat.bg} shrink-0`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

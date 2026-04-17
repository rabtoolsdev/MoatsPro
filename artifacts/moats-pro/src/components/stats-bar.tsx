import { motion } from "framer-motion";
import { Activity, TrendingUp, Award, CheckCircle } from "lucide-react";
import type { MoatConfig, MapsScore } from "@/lib/moats-api";

interface StatsBarProps {
  moatConfigs?: MoatConfig[];
  leaderboard?: MapsScore[];
}

export function StatsBar({ moatConfigs, leaderboard }: StatsBarProps) {
  const totalMoats = moatConfigs?.length || 0;
  const verifiedMoats = moatConfigs?.filter((c) => c.status === "Verified").length || 0;
  const totalRewardTokens = moatConfigs
    ? moatConfigs.reduce((sum, m) => sum + m.rewardTokens.filter((t) => t.enabled).length, 0)
    : 0;
  const totalMapsScorers = leaderboard?.length || 0;

  const stats = [
    {
      label: "Active Moats",
      value: totalMoats.toLocaleString(),
      icon: Activity,
      color: "text-primary",
      bg: "bg-primary/10",
      testId: "stat-active-moats",
    },
    {
      label: "Verified Moats",
      value: verifiedMoats.toLocaleString(),
      icon: CheckCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      testId: "stat-verified-moats",
    },
    {
      label: "Active Reward Streams",
      value: totalRewardTokens.toLocaleString(),
      icon: TrendingUp,
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
      testId: "stat-reward-streams",
    },
    {
      label: "MAPS Scorers",
      value: totalMapsScorers.toLocaleString(),
      icon: Award,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      testId: "stat-maps-scorers",
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
              data-testid={stat.testId}
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

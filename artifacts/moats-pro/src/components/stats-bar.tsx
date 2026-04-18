import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Activity, TrendingUp, Award, CheckCircle } from "lucide-react";
import type { MoatConfig, MapsScore } from "@/lib/moats-api";

interface StatsBarProps {
  moatConfigs?: MoatConfig[];
  leaderboard?: MapsScore[];
}

function AnimatedNumber({ value, duration = 0.9 }: { value: number; duration?: number }) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const hasAnimated = useRef(false);

  useEffect(() => {
    // Only start animating once the element enters the viewport AND data is available
    if (!inView || value === 0 || hasAnimated.current) return;
    hasAnimated.current = true;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayed(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, value, duration]);

  // Once animated, if value changes (e.g. fresh fetch), jump to new value
  useEffect(() => {
    if (hasAnimated.current) setDisplayed(value);
  }, [value]);

  return <span ref={ref}>{displayed.toLocaleString()}</span>;
}

export function StatsBar({ moatConfigs, leaderboard }: StatsBarProps) {
  const totalMoats = moatConfigs?.filter((c) => c.status === "Verified" || c.status === "Community").length || 0;
  const verifiedMoats = moatConfigs?.filter((c) => c.status === "Verified").length || 0;
  const totalRewardTokens = moatConfigs
    ? moatConfigs.reduce((sum, m) => sum + m.rewardTokens.filter((t) => t.enabled).length, 0)
    : 0;
  const totalMapsScorers = leaderboard?.length || 0;

  const stats = [
    {
      label: "Active Moats",
      value: totalMoats,
      icon: Activity,
      color: "text-primary",
      bg: "bg-primary/10",
      glow: "group-hover:shadow-[0_0_14px_rgba(0,212,255,0.25)]",
      testId: "stat-active-moats",
    },
    {
      label: "Verified Moats",
      value: verifiedMoats,
      icon: CheckCircle,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      glow: "group-hover:shadow-[0_0_14px_rgba(52,211,153,0.25)]",
      testId: "stat-verified-moats",
    },
    {
      label: "Active Reward Streams",
      value: totalRewardTokens,
      icon: TrendingUp,
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
      glow: "group-hover:shadow-[0_0_14px_rgba(34,211,238,0.25)]",
      testId: "stat-reward-streams",
    },
    {
      label: "MAPS Scorers",
      value: totalMapsScorers,
      icon: Award,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      glow: "group-hover:shadow-[0_0_14px_rgba(167,139,250,0.25)]",
      testId: "stat-maps-scorers",
    },
  ];

  return (
    <section className="relative border-y border-border/50 bg-card/20 backdrop-blur-sm overflow-hidden">
      {/* Subtle horizontal glow line at top */}
      <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.09, ease: "easeOut" }}
              data-testid={stat.testId}
              className="group relative flex items-center gap-3"
            >
              <div className={`p-2.5 rounded-xl ${stat.bg} shrink-0 transition-all duration-300 ${stat.glow}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">
                  <AnimatedNumber value={stat.value} duration={0.9} />
                </p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>

              {/* Vertical divider except after last */}
              {i < stats.length - 1 && (
                <div className="hidden lg:block absolute right-0 top-1/4 bottom-1/4 w-px bg-border/50" />
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Subtle bottom glow */}
      <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
    </section>
  );
}

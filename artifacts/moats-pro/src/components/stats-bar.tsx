import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Activity, TrendingUp, Award, CheckCircle, DollarSign } from "lucide-react";
import type { MoatConfig, MapsScore } from "@/lib/moats-api";

interface StatsBarProps {
  moatConfigs?: MoatConfig[];
  leaderboard?: MapsScore[];
  totalTvmUsd?: number;
}

function formatCompactUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function AnimatedUsd({ value, duration = 0.9 }: { value: number; duration?: number }) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!inView || value === 0 || hasAnimated.current) return;
    hasAnimated.current = true;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayed(eased * value);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, value, duration]);

  useEffect(() => {
    if (hasAnimated.current) setDisplayed(value);
  }, [value]);

  return <span ref={ref}>{formatCompactUsd(displayed)}</span>;
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

export function StatsBar({ moatConfigs, leaderboard, totalTvmUsd = 0 }: StatsBarProps) {
  const totalMoats = moatConfigs?.filter((c) => c.status === "Verified" || c.status === "Community").length || 0;
  const verifiedMoats = moatConfigs?.filter((c) => c.status === "Verified").length || 0;
  const totalRewardTokens = moatConfigs
    ? moatConfigs.reduce((sum, m) => sum + m.rewardTokens.filter((t) => t.enabled).length, 0)
    : 0;
  const totalMapsScorers = leaderboard?.length || 0;

  const stats = [
    {
      label: "Total TVM",
      value: totalTvmUsd,
      icon: DollarSign,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      glow: "group-hover:shadow-[0_0_14px_rgba(251,191,36,0.25)]",
      testId: "stat-total-tvm",
      isUsd: true,
    },
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
      label: "Airdrop Qualifiers",
      value: totalMapsScorers,
      icon: Award,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      glow: "group-hover:shadow-[0_0_14px_rgba(167,139,250,0.25)]",
      testId: "stat-maps-scorers",
    },
  ];

  return (
    <section className="relative border-y border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden cyber-grid">
      {/* Subtle horizontal glow line at top */}
      <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_20px_rgba(0,212,255,0.5)]" />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.09, ease: "easeOut" }}
              data-testid={stat.testId}
              className="group relative flex flex-col gap-3 p-5 rounded-xl border border-white/5 bg-card/40 hover:border-primary/30 transition-colors"
            >
              <div className={`w-8 h-8 rounded border border-white/10 flex items-center justify-center shrink-0 transition-all duration-300 ${stat.bg} ${stat.glow}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <div className="mt-1">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-1">{stat.label}</p>
                <p className="text-2xl font-black tabular-nums tracking-tight text-white drop-shadow-md">
                  {stat.isUsd ? (
                    <AnimatedUsd value={stat.value} duration={0.9} />
                  ) : (
                    <AnimatedNumber value={stat.value} duration={0.9} />
                  )}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Subtle bottom glow */}
      <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent shadow-[0_0_15px_rgba(0,212,255,0.4)]" />
    </section>
  );
}

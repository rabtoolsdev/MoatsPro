import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Coins, Droplet, Bitcoin, Sparkles } from "lucide-react";

export interface RewardBucketRow {
  symbol: string;
  amount: number;
  usd: number;
  price: number;
  logoUrl?: string;
}

interface RewardsBarProps {
  usdc: RewardBucketRow;
  wavax: RewardBucketRow;
  btcb: RewardBucketRow;
  community: { usd: number; tokenCount: number };
}

function formatCompactUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function formatCompactAmount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n > 0) return n.toFixed(4);
  return "0";
}

function formatPrice(p: number): string {
  if (p === 0) return "—";
  if (p >= 1) return `$${p.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toFixed(3)}`;
  return `$${p.toPrecision(2)}`;
}

function AnimatedValue({ value, format }: { value: number; format: (n: number) => string }) {
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
      const progress = Math.min(elapsed / 0.9, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplayed(eased * value);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [inView, value]);

  useEffect(() => {
    if (hasAnimated.current) setDisplayed(value);
  }, [value]);

  return <span ref={ref}>{format(displayed)}</span>;
}

export function RewardsBar({ usdc, wavax, btcb, community }: RewardsBarProps) {
  const cards = [
    {
      label: "Total USDC Distributed",
      bucket: usdc,
      icon: Coins,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      glow: "group-hover:shadow-[0_0_14px_rgba(52,211,153,0.25)]",
      testId: "stat-rewards-usdc",
    },
    {
      label: "Total WAVAX Distributed",
      bucket: wavax,
      icon: Droplet,
      color: "text-rose-400",
      bg: "bg-rose-400/10",
      glow: "group-hover:shadow-[0_0_14px_rgba(251,113,133,0.25)]",
      testId: "stat-rewards-wavax",
    },
    {
      label: "Total BTC.b Distributed",
      bucket: btcb,
      icon: Bitcoin,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      glow: "group-hover:shadow-[0_0_14px_rgba(251,191,36,0.25)]",
      testId: "stat-rewards-btcb",
    },
  ];

  return (
    <section
      data-testid="rewards-bar"
      className="relative border-b border-white/5 bg-black/60 backdrop-blur-xl overflow-hidden cyber-lines"
    >
      <div className="max-w-7xl mx-auto px-4 py-8 relative z-10">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-2">
          <div>
            <h3 className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <span className="w-1 h-3 bg-primary" /> Rewards Distributed
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Lifetime emissions across every Moat
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: "easeOut" }}
              data-testid={card.testId}
              className="group rounded-xl border border-white/5 bg-card/30 p-5 hover:border-primary/40 transition-colors relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="relative flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center border border-white/10 ${card.bg} transition-all duration-300 ${card.glow}`}
                  >
                    {card.bucket.logoUrl ? (
                      <img
                        src={card.bucket.logoUrl}
                        alt={card.bucket.symbol}
                        className="w-3.5 h-3.5 rounded-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
                    )}
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 truncate">{card.label}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-black tabular-nums leading-none tracking-tight text-white mb-1">
                    <AnimatedValue value={card.bucket.amount} format={formatCompactAmount} />
                    <span className="text-sm font-bold text-muted-foreground ml-1.5">
                      {card.bucket.symbol}
                    </span>
                  </p>
                  <p className="text-[11px] font-mono text-emerald-400 tabular-nums">
                    <AnimatedValue value={card.bucket.usd} format={formatCompactUsd} />
                    <span className="text-muted-foreground/60 ml-1.5">
                      @ {formatPrice(card.bucket.price)}
                    </span>
                  </p>
                </div>
              </div>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: cards.length * 0.06, ease: "easeOut" }}
            data-testid="stat-rewards-community"
            className="group rounded-xl border border-white/5 bg-card/30 p-5 hover:border-primary/40 transition-colors relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="relative flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded border border-white/10 flex items-center justify-center bg-violet-400/10 transition-all duration-300 group-hover:shadow-[0_0_14px_rgba(167,139,250,0.25)]">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 truncate">
                  Community Assets Distributed
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-black tabular-nums leading-none tracking-tight text-white mb-1">
                  <AnimatedValue value={community.usd} format={formatCompactUsd} />
                </p>
                <p className="text-[11px] font-mono text-muted-foreground/60 mt-1">
                  Across {community.tokenCount} project token{community.tokenCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

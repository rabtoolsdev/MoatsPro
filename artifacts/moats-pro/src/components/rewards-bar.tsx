import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Coins, Droplet, Bitcoin, Sparkles } from "lucide-react";

export interface RewardBucketRow {
  symbol: string;
  amount: number;
  usd: number;
  price: number;
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
      className="relative border-b border-border/50 bg-card/10 backdrop-blur-sm overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Rewards Distributed</h3>
            <p className="text-xs text-muted-foreground">
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
              className="group rounded-2xl border border-border/60 bg-card/40 p-4 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-xl ${card.bg} shrink-0 transition-all duration-300 ${card.glow}`}
                >
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                  <p className="text-xl font-bold tabular-nums leading-tight mt-0.5">
                    <AnimatedValue value={card.bucket.amount} format={formatCompactAmount} />
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      {card.bucket.symbol}
                    </span>
                  </p>
                  <p className="text-xs text-emerald-400 tabular-nums mt-0.5">
                    <AnimatedValue value={card.bucket.usd} format={formatCompactUsd} />
                    <span className="text-muted-foreground ml-1.5">
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
            className="group rounded-2xl border border-border/60 bg-card/40 p-4 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-violet-400/10 shrink-0 transition-all duration-300 group-hover:shadow-[0_0_14px_rgba(167,139,250,0.25)]">
                <Sparkles className="w-5 h-5 text-violet-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">
                  Community Assets Distributed
                </p>
                <p className="text-xl font-bold tabular-nums leading-tight mt-0.5">
                  <AnimatedValue value={community.usd} format={formatCompactUsd} />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Across {community.tokenCount} project token
                  {community.tokenCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

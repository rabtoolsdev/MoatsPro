import { useMemo, useState, useCallback } from "react";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Download, BarChart2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
import { formatUSD } from "@/lib/moat-metadata";
import type { MoatEvent } from "@/lib/moats-api";

// ── Types ────────────────────────────────────────────────────────────────────

type Timeframe = "7D" | "30D" | "90D" | "All";

const TIMEFRAME_MS: Record<Timeframe, number> = {
  "7D":  7  * 86_400_000,
  "30D": 30 * 86_400_000,
  "90D": 90 * 86_400_000,
  "All": Infinity,
};

interface ClaimedAggregate {
  featured: Record<"usdc" | "wavax" | "btcb", { symbol: string; amount: number; usd: number }>;
  community: { symbol: string; amount: number; usd: number }[];
  totalUsd: number;
}

export interface PortfolioReportsProps {
  address?: string;
  mapsScore?: { points: number; rank?: number } | null;
  totalPortfolioValueUSD: number;
  swapPoints?: number;
  ownTransactions: MoatEvent[];
  claimedAggregate: ClaimedAggregate;
  activePositionCount: number;
}

// ── Data builders ────────────────────────────────────────────────────────────

function buildActivityData(events: MoatEvent[], tf: Timeframe) {
  const now = Date.now();
  const cutoff = tf === "All" ? 0 : now - TIMEFRAME_MS[tf];
  const filtered = [...events]
    .filter(e => new Date(e.timestamp).getTime() >= cutoff)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const getKey = (ts: number): string => {
    const d = new Date(ts);
    if (tf === "7D" || tf === "30D") return `${d.getMonth() + 1}/${d.getDate()}`;
    if (tf === "90D") {
      const ws = new Date(d);
      ws.setDate(d.getDate() - d.getDay());
      return `${ws.toLocaleString("en", { month: "short" })} ${ws.getDate()}`;
    }
    return d.toLocaleString("en", { month: "short", year: "2-digit" });
  };

  const orderedKeys: string[] = [];
  const map = new Map<string, { date: string; Stake: number; Lock: number; Burn: number; Claim: number }>();

  for (const ev of filtered) {
    const key = getKey(new Date(ev.timestamp).getTime());
    if (!map.has(key)) { orderedKeys.push(key); map.set(key, { date: key, Stake: 0, Lock: 0, Burn: 0, Claim: 0 }); }
    const b = map.get(key)!;
    if (ev.eventType === "Staked") b.Stake++;
    else if (ev.eventType === "Locked") b.Lock++;
    else if (ev.eventType === "Burned") b.Burn++;
    else if (ev.eventType === "RewardClaimed") b.Claim++;
  }
  return orderedKeys.map(k => map.get(k)!);
}

function buildCumulativeData(events: MoatEvent[], tf: Timeframe) {
  const now = Date.now();
  const cutoff = tf === "All" ? 0 : now - TIMEFRAME_MS[tf];
  const claims = [...events]
    .filter(e => e.eventType === "RewardClaimed" && new Date(e.timestamp).getTime() >= cutoff)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let cum = 0;
  return claims.map(ev => {
    cum++;
    const d = new Date(ev.timestamp);
    return { date: `${d.getMonth() + 1}/${d.getDate()}`, Claims: cum };
  });
}

interface GrowthStat { label: string; count: number; pct: number | null; colorClass: string; borderClass: string; glowColor: string; barColor: string; }

function buildGrowthStats(events: MoatEvent[], tf: Timeframe): GrowthStat[] {
  const now = Date.now();
  const ms = tf === "All" ? null : TIMEFRAME_MS[tf];
  const count = (type: string, from: number, to: number) =>
    events.filter(e => { const t = new Date(e.timestamp).getTime(); return e.eventType === type && t >= from && t < to; }).length;

  const stat = (label: string, type: string, colorClass: string, borderClass: string, glowColor: string, barColor: string): GrowthStat => {
    const cur  = count(type, ms ? now - ms : 0, now);
    const prior = ms ? count(type, now - 2 * ms, now - ms) : 0;
    const pct  = ms && prior > 0 ? ((cur - prior) / prior) * 100 : null;
    return { label, count: cur, pct, colorClass, borderClass, glowColor, barColor };
  };

  return [
    stat("Stakes", "Staked",        "text-emerald-400", "border-emerald-500/30", "rgba(52,211,153,0.15)",  "#34d399"),
    stat("Locks",  "Locked",         "text-cyan-400",    "border-cyan-500/30",    "rgba(0,212,255,0.15)",   "#00d4ff"),
    stat("Burns",  "Burned",         "text-rose-400",    "border-rose-500/30",    "rgba(239,68,68,0.15)",   "#f87171"),
    stat("Claims", "RewardClaimed",  "text-violet-400",  "border-violet-500/30",  "rgba(167,139,250,0.15)", "#a78bfa"),
  ];
}

// ── Canvas-based social card export ─────────────────────────────────────────

function exportCard(
  type: "portfolio" | "rewards" | "activity",
  props: PortfolioReportsProps,
) {
  const W = 800, H = 440, DPR = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * DPR; canvas.height = H * DPR;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(DPR, DPR);

  const mono = "'Courier New', Courier, monospace";
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#050911"); bg.addColorStop(1, "#0a0e1e");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = "rgba(255,255,255,0.022)"; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Top accent
  const top = ctx.createLinearGradient(0, 0, W, 0);
  top.addColorStop(0, "transparent"); top.addColorStop(0.4, "#00d4ff"); top.addColorStop(0.6, "#00d4ff"); top.addColorStop(1, "transparent");
  ctx.strokeStyle = top; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(W, 1); ctx.stroke();

  // Corner brackets
  const bc = "rgba(0,212,255,0.35)";
  ctx.strokeStyle = bc; ctx.lineWidth = 1.5;
  [[0,0,20,0,0,20],[W,0,-20,0,0,20],[0,H,20,0,0,-20],[W,H,-20,0,0,-20]].forEach(([x,y,dx,_dy,_dx,dy]) => {
    ctx.beginPath(); ctx.moveTo(x as number,y as number); ctx.lineTo((x as number)+(dx as number),y as number); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x as number,y as number); ctx.lineTo(x as number,(y as number)+(dy as number)); ctx.stroke();
  });

  // Header band
  ctx.fillStyle = "rgba(0,212,255,0.04)";
  ctx.fillRect(0, 0, W, 60);
  ctx.strokeStyle = "rgba(0,212,255,0.1)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(W, 60); ctx.stroke();

  // Brand
  ctx.font = `bold 12px ${mono}`; ctx.fillStyle = "#00d4ff";
  ctx.fillText("/// MOATS PRO", 36, 38);
  if (props.address) {
    ctx.font = `9px ${mono}`; ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.fillText(`${props.address.slice(0,6)}...${props.address.slice(-4)}`, 224, 38);
  }
  const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  ctx.font = `9px ${mono}`; ctx.fillStyle = "rgba(255,255,255,0.22)";
  const dm = ctx.measureText(dateStr);
  ctx.fillText(dateStr, W - 36 - dm.width, 38);

  // Card-type label
  const typeLabels = { portfolio: "PORTFOLIO SUMMARY", rewards: "REWARDS REPORT", activity: "ACTIVITY SUMMARY" };
  ctx.font = `10px ${mono}`; ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillText(typeLabels[type], 36, 82);

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.07)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(36, 92); ctx.lineTo(W - 36, 92); ctx.stroke();

  if (type === "portfolio") {
    ctx.font = `bold 62px ${sans}`; ctx.fillStyle = "#ffffff";
    ctx.fillText(formatUSD(props.totalPortfolioValueUSD), 36, 175);
    ctx.font = `10px ${mono}`; ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillText("TOTAL VALUE MOATED", 36, 198);
    ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(36, 220); ctx.lineTo(W - 36, 220); ctx.stroke();
    const cols = [
      { label: "MAPS SCORE", value: props.mapsScore?.points?.toLocaleString() ?? "—", sub: props.mapsScore?.rank ? `RANK #${props.mapsScore.rank}` : "", color: "#a78bfa" },
      { label: "SWAP POINTS", value: (props.swapPoints ?? 0).toLocaleString(), sub: "TOTAL EARNED", color: "#34d399" },
      { label: "REWARDS EARNED", value: formatUSD(props.claimedAggregate.totalUsd), sub: "LIFETIME", color: "#00d4ff" },
    ];
    cols.forEach((c, i) => {
      const x = 36 + i * 244;
      ctx.font = `9px ${mono}`; ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillText(c.label, x, 252);
      ctx.font = `bold 30px ${sans}`; ctx.fillStyle = c.color; ctx.fillText(c.value, x, 294);
      if (c.sub) { ctx.font = `8px ${mono}`; ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fillText(c.sub, x, 312); }
    });
    ctx.font = `9px ${mono}`; ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillText(`${props.activePositionCount} active position${props.activePositionCount === 1 ? "" : "s"}`, 36, 370);

  } else if (type === "rewards") {
    ctx.font = `bold 58px ${sans}`; ctx.fillStyle = "#34d399";
    ctx.fillText(formatUSD(props.claimedAggregate.totalUsd), 36, 175);
    ctx.font = `10px ${mono}`; ctx.fillStyle = "rgba(255,255,255,0.28)"; ctx.fillText("LIFETIME REWARDS CLAIMED", 36, 198);
    ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(36, 220); ctx.lineTo(W - 36, 220); ctx.stroke();
    const tokens = [
      { symbol: "USDC",  ...props.claimedAggregate.featured.usdc },
      { symbol: "WAVAX", ...props.claimedAggregate.featured.wavax },
      { symbol: "BTC.b", ...props.claimedAggregate.featured.btcb },
      ...props.claimedAggregate.community,
    ].filter(t => t.amount > 0).slice(0, 4);
    tokens.forEach((t, i) => {
      const x = 36 + i * 184;
      ctx.font = `9px ${mono}`; ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillText(t.symbol, x, 250);
      const amtStr = t.amount < 0.001 ? t.amount.toPrecision(3) : t.amount.toLocaleString("en-US", { maximumFractionDigits: 3 });
      ctx.font = `bold 24px ${sans}`; ctx.fillStyle = "#ffffff"; ctx.fillText(amtStr, x, 286);
      if (t.usd > 0) { ctx.font = `8px ${mono}`; ctx.fillStyle = "rgba(52,211,153,0.75)"; ctx.fillText(formatUSD(t.usd), x, 302); }
    });
    if (tokens.length === 0) {
      ctx.font = `14px ${mono}`; ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.fillText("No rewards claimed yet", 36, 280);
    }

  } else {
    const total = props.ownTransactions.length;
    ctx.font = `bold 62px ${sans}`; ctx.fillStyle = "#ffffff"; ctx.fillText(total.toString(), 36, 175);
    ctx.font = `10px ${mono}`; ctx.fillStyle = "rgba(255,255,255,0.28)"; ctx.fillText("TOTAL TRANSACTIONS", 36, 198);
    ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(36, 220); ctx.lineTo(W - 36, 220); ctx.stroke();
    const acts = [
      { label: "STAKES", type: "Staked",       color: "#34d399" },
      { label: "LOCKS",  type: "Locked",        color: "#00d4ff" },
      { label: "BURNS",  type: "Burned",         color: "#f87171" },
      { label: "CLAIMS", type: "RewardClaimed", color: "#a78bfa" },
    ];
    acts.forEach((a, i) => {
      const x = 36 + i * 185;
      const n = props.ownTransactions.filter(e => e.eventType === a.type).length;
      ctx.font = `9px ${mono}`; ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillText(a.label, x, 252);
      ctx.font = `bold 38px ${sans}`; ctx.fillStyle = a.color; ctx.fillText(n.toString(), x, 298);
    });
  }

  // Footer
  ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(36, H - 32); ctx.lineTo(W - 36, H - 32); ctx.stroke();
  ctx.font = `8px ${mono}`; ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillText("BUILT ON MOATS PROTOCOL · PRO.MOATS.APP", 36, H - 16);

  const link = document.createElement("a");
  link.download = `moats-${type}-${new Date().toISOString().slice(0, 10)}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ── Custom tooltip ───────────────────────────────────────────────────────────

function CyberTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-black/90 border border-white/10 rounded-lg px-3 py-2.5 shadow-xl backdrop-blur-sm text-[10px] font-mono space-y-1 min-w-[120px]">
      <p className="text-white/50 uppercase tracking-widest pb-1 border-b border-white/5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className="text-white/60">{p.name}</span>
          </span>
          <span className="font-bold text-white">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

const TIMEFRAMES: Timeframe[] = ["7D", "30D", "90D", "All"];

export function PortfolioReports(props: PortfolioReportsProps) {
  const { ownTransactions, claimedAggregate, mapsScore, totalPortfolioValueUSD, swapPoints, activePositionCount } = props;

  const [tf, setTf] = useState<Timeframe>("30D");
  const [activeCard, setActiveCard] = useState<"portfolio" | "rewards" | "activity">("portfolio");

  const activityData  = useMemo(() => buildActivityData(ownTransactions, tf),  [ownTransactions, tf]);
  const cumulativeData = useMemo(() => buildCumulativeData(ownTransactions, tf), [ownTransactions, tf]);
  const growthStats   = useMemo(() => buildGrowthStats(ownTransactions, tf),    [ownTransactions, tf]);

  const hasActivity   = activityData.length > 0;
  const hasCumulative = cumulativeData.length > 0;

  const doExport = useCallback(() => exportCard(activeCard, props), [activeCard, props]);

  const pctLabel = (pct: number | null) => {
    if (pct === null) return null;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(0)}%`;
  };

  const cardPreviews: { key: "portfolio" | "rewards" | "activity"; label: string; headline: string; sub: string }[] = [
    {
      key: "portfolio",
      label: "Portfolio Summary",
      headline: formatUSD(totalPortfolioValueUSD),
      sub: `MAPS ${mapsScore?.points?.toLocaleString() ?? "—"} · ${(swapPoints ?? 0).toLocaleString()} swap pts`,
    },
    {
      key: "rewards",
      label: "Rewards Report",
      headline: formatUSD(claimedAggregate.totalUsd),
      sub: `USDC · WAVAX · BTC.b${claimedAggregate.community.length > 0 ? ` · +${claimedAggregate.community.length} more` : ""}`,
    },
    {
      key: "activity",
      label: "Activity Summary",
      headline: `${ownTransactions.length} txs`,
      sub: `${growthStats[0].count} stakes · ${growthStats[1].count} locks · ${growthStats[2].count} burns`,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative pt-6"
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded bg-primary/10 border border-primary/20">
            <BarChart2 size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white">Reports</h2>
            <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mt-0.5">Analytics &amp; exportable social cards</p>
          </div>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-black/50 border border-white/10">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              onClick={() => setTf(t)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-widest transition-all duration-200 ${
                tf === t
                  ? "bg-primary/20 text-primary border border-primary/40 shadow-[0_0_12px_rgba(0,212,255,0.2)]"
                  : "text-muted-foreground/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Growth stat pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {growthStats.map((stat) => {
          const label = pctLabel(stat.pct);
          const isUp = stat.pct !== null && stat.pct > 0;
          const isDown = stat.pct !== null && stat.pct < 0;
          return (
            <div
              key={stat.label}
              className={`rounded-xl border ${stat.borderClass} bg-black/50 p-4 flex flex-col gap-2 relative overflow-hidden`}
              style={{ boxShadow: `inset 0 0 20px ${stat.glowColor}` }}
            >
              <div className="absolute top-0 inset-x-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${stat.barColor}60, transparent)` }} />
              <p className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest">{stat.label}</p>
              <div className="flex items-end justify-between gap-1">
                <p className={`text-3xl font-black tabular-nums ${stat.colorClass}`}>{stat.count}</p>
                {label && (
                  <span className={`flex items-center gap-0.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded mb-0.5 ${
                    isUp   ? "text-emerald-400 bg-emerald-500/10"
                    : isDown ? "text-rose-400 bg-rose-500/10"
                    : "text-muted-foreground bg-white/5"
                  }`}>
                    {isUp ? <TrendingUp size={8} /> : isDown ? <TrendingDown size={8} /> : <Minus size={8} />}
                    {label}
                  </span>
                )}
              </div>
              <p className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest">
                {tf === "All" ? "all time" : `last ${tf}`}
              </p>
            </div>
          );
        })}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

        {/* Activity Breakdown */}
        <div className="rounded-2xl border border-white/5 bg-black/40 p-5 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={13} className="text-emerald-400/70" />
            <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest font-bold">Activity Breakdown</p>
          </div>
          {hasActivity ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activityData} barSize={6} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fontFamily: "monospace", fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 9, fontFamily: "monospace", fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} width={24} />
                <Tooltip content={<CyberTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend wrapperStyle={{ fontSize: "9px", fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em", paddingTop: "8px", color: "rgba(255,255,255,0.4)" }} iconType="circle" iconSize={6} />
                <Bar dataKey="Stake" fill="#34d399" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Lock"  fill="#00d4ff" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Burn"  fill="#f87171" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Claim" fill="#a78bfa" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground/40 font-mono text-[10px] uppercase tracking-widest gap-2">
              <BarChart2 size={24} className="opacity-30" />
              No activity in this period
            </div>
          )}
        </div>

        {/* Cumulative Rewards Claims */}
        <div className="rounded-2xl border border-white/5 bg-black/40 p-5 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={13} className="text-violet-400/70" />
            <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest font-bold">Cumulative Reward Claims</p>
          </div>
          {hasCumulative ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={cumulativeData}>
                <defs>
                  <linearGradient id="claimGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fontFamily: "monospace", fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 9, fontFamily: "monospace", fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} width={24} />
                <Tooltip content={<CyberTooltip />} cursor={{ stroke: "rgba(167,139,250,0.3)", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="Claims" stroke="#a78bfa" strokeWidth={2} fill="url(#claimGrad)" dot={false} activeDot={{ r: 4, fill: "#a78bfa", stroke: "#000", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground/40 font-mono text-[10px] uppercase tracking-widest gap-2">
              <TrendingUp size={24} className="opacity-30" />
              No claims in this period
            </div>
          )}
        </div>
      </div>

      {/* Social card export */}
      <div className="rounded-2xl border border-white/5 bg-black/40 overflow-hidden relative">
        <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download size={14} className="text-primary/70" />
            <p className="text-[11px] font-mono text-white font-bold uppercase tracking-widest">Export Social Card</p>
          </div>
          <p className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest">PNG · 800×440 · 2×</p>
        </div>

        <div className="p-5">
          {/* Card picker */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            {cardPreviews.map((card) => (
              <button
                key={card.key}
                onClick={() => setActiveCard(card.key)}
                className={`relative rounded-xl border p-4 text-left transition-all duration-200 overflow-hidden group ${
                  activeCard === card.key
                    ? "border-primary/60 bg-primary/5 shadow-[0_0_20px_rgba(0,212,255,0.12)]"
                    : "border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/[0.03]"
                }`}
              >
                {activeCard === card.key && (
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
                )}

                {/* Mini card preview */}
                <div className="rounded-lg bg-black/60 border border-white/5 p-3 mb-3 relative overflow-hidden h-[72px] flex flex-col justify-between">
                  <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                  <div className="flex items-center gap-1">
                    <span className="text-[7px] font-mono text-primary tracking-widest">/// MOATS PRO</span>
                  </div>
                  <div>
                    <p className="text-sm font-black text-white tabular-nums leading-none">{card.headline}</p>
                    <p className="text-[7px] font-mono text-muted-foreground/50 mt-0.5 truncate">{card.sub}</p>
                  </div>
                </div>

                <p className={`text-[10px] font-mono font-bold uppercase tracking-widest transition-colors ${
                  activeCard === card.key ? "text-primary" : "text-muted-foreground/60 group-hover:text-white"
                }`}>{card.label}</p>
              </button>
            ))}
          </div>

          {/* Export button */}
          <button
            onClick={doExport}
            className="btn-shimmer w-full py-3.5 rounded-xl bg-primary/10 border border-primary/40 text-primary font-black uppercase tracking-widest text-[11px] hover:bg-primary/20 hover:border-primary/70 transition-all duration-200 hover:shadow-[0_0_24px_rgba(0,212,255,0.25)] flex items-center justify-center gap-2"
          >
            <Download size={14} />
            Download {cardPreviews.find(c => c.key === activeCard)?.label ?? ""} PNG
          </button>
        </div>
      </div>
    </motion.div>
  );
}

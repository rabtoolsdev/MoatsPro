import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, useInView } from "framer-motion";
import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  BarChart3,
  DollarSign,
  Activity,
  Users,
  Gift,
  Flame,
  Lock as LockIcon,
} from "lucide-react";
import { useAllMoatConfigs } from "@/hooks/use-moats-api";
import { useProtocolEvents } from "@/hooks/use-protocol-events";
import { useTokenPrices, getLlamaId } from "@/hooks/use-token-prices";
import { useDexscreenerInfo } from "@/hooks/use-dexscreener";
import { MOAT_V3_ABI, ERC20_ABI } from "@/lib/moat-abi";
import { getMoatMeta } from "@/lib/moat-metadata";
import { useResolveMoatMetas } from "@/hooks/use-resolve-moat-metas";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import type { MoatConfig, MoatEvent } from "@/lib/moats-api";

// ---- formatters ----
function fmtUsd(n: number): string {
  if (!isFinite(n) || n === 0) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}
function fmtNum(n: number): string {
  if (!isFinite(n)) return "0";
  return Math.round(n).toLocaleString();
}
function fmtDay(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ---- animated counter (matches stats-bar.tsx style) ----
function AnimatedValue({
  value,
  format,
  duration = 0.9,
}: {
  value: number;
  format: (n: number) => string;
  duration?: number;
}) {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const hasAnimated = useRef(false);
  useEffect(() => {
    if (!inView || value === 0 || hasAnimated.current) return;
    hasAnimated.current = true;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / 1000 / duration, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplayed(eased * value);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value, duration]);
  useEffect(() => {
    if (hasAnimated.current) setDisplayed(value);
  }, [value]);
  return <span ref={ref}>{format(displayed)}</span>;
}

// ---- timeframe ----
type Timeframe = "7D" | "30D" | "90D" | "ALL";
const TIMEFRAMES: Timeframe[] = ["7D", "30D", "90D", "ALL"];
function timeframeStart(tf: Timeframe): number {
  if (tf === "ALL") return 0;
  const days = tf === "7D" ? 7 : tf === "30D" ? 30 : 90;
  return Date.now() - days * 86400_000;
}
function timeframeDays(tf: Timeframe, fallbackDays = 180): number {
  if (tf === "ALL") return fallbackDays;
  return tf === "7D" ? 7 : tf === "30D" ? 30 : 90;
}

// ---- helpers ----
function eventMs(e: MoatEvent): number {
  const t = new Date(e.timestamp).getTime();
  return isFinite(t) ? t : 0;
}
function dayKey(ms: number): number {
  const d = new Date(ms);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

// Token color palette (consistent with RewardsBar)
const TOKEN_COLORS = {
  USDC: "#34d399",
  WAVAX: "#fb7185",
  "BTC.b": "#fbbf24",
  Community: "#a78bfa",
};

const NETWORK_COLORS: Record<string, string> = {
  avalanche: "#e84142",
  avax: "#e84142",
  ethereum: "#6b7fff",
  arbitrum: "#28a0f0",
  base: "#0052ff",
  optimism: "#ff0420",
  polygon: "#8247e5",
  bsc: "#f0b90b",
};
const STATUS_COLORS: Record<string, string> = {
  Verified: "#00d4ff",
  Community: "#a78bfa",
};

const WAVAX_ADDR = "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7";
const USDC_ADDR = "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e";
const BTCB_ADDR = "0x152b9d0fdc40c096757f570a51e494bd4b943e50";

function bucketLabelFor(symbol: string, address: string): "USDC" | "WAVAX" | "BTC.b" | "Community" {
  const a = address.toLowerCase();
  if (a === USDC_ADDR) return "USDC";
  if (a === WAVAX_ADDR) return "WAVAX";
  if (a === BTCB_ADDR) return "BTC.b";
  const s = (symbol || "").toLowerCase().replace(/\./g, "");
  if (s === "usdc") return "USDC";
  if (s === "wavax") return "WAVAX";
  if (s === "btcb" || s === "btc") return "BTC.b";
  return "Community";
}

// ---- recharts tooltip ----
function ChartTooltip({ active, payload, label, valueFormat = fmtUsd }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/80 bg-card/95 backdrop-blur-xl px-3 py-2 shadow-2xl shadow-black/60 text-xs">
      <div className="text-muted-foreground mb-1">
        {typeof label === "number" ? fmtDay(label) : label}
      </div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 tabular-nums">
          <span
            className="w-2 h-2 rounded-sm shrink-0"
            style={{ background: p.color || p.fill }}
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="text-foreground font-medium">{valueFormat(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ---- card wrapper ----
function ChartCard({
  title,
  subtitle,
  children,
  testId,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <motion.section
      data-testid={testId}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm p-5 hover:border-primary/30 transition-colors"
    >
      <div className="mb-4">
        <h3 className="text-base font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </motion.section>
  );
}

export default function Analytics() {
  const [tf, setTf] = useState<Timeframe>("30D");
  const startMs = timeframeStart(tf);

  const { data: configs } = useAllMoatConfigs();
  const ev = useProtocolEvents();

  // ---- on-chain enrichment (staking tokens for activity USD valuation) ----
  const onchainContracts = useMemo(() => {
    if (!configs) return [];
    return configs.flatMap((c) => [
      { address: c.contractAddress as `0x${string}`, abi: MOAT_V3_ABI, functionName: "stakingToken" as const },
      { address: c.contractAddress as `0x${string}`, abi: MOAT_V3_ABI, functionName: "totalLocked" as const },
    ]);
  }, [configs]);

  const { data: onchainData } = useReadContracts({
    contracts: onchainContracts,
    query: { enabled: onchainContracts.length > 0 },
  });

  const stakingTokenByMoat = useMemo((): Record<string, string> => {
    if (!onchainData || !configs) return {};
    const m: Record<string, string> = {};
    configs.forEach((c, i) => {
      const r = onchainData[i * 2];
      if (r?.status === "success") m[c.contractAddress.toLowerCase()] = (r.result as string).toLowerCase();
    });
    return m;
  }, [onchainData, configs]);

  const activeLocksTotal = useMemo(() => {
    if (!onchainData || !configs) return 0;
    // count of moats with non-zero totalLocked (proxy for "moats with active locks")
    let count = 0;
    configs.forEach((_, i) => {
      const r = onchainData[i * 2 + 1];
      if (r?.status === "success" && (r.result as bigint) > 0n) count += 1;
    });
    return count;
  }, [onchainData, configs]);

  const uniqueStakingTokens = useMemo(
    () => [...new Set(Object.values(stakingTokenByMoat).filter(Boolean))],
    [stakingTokenByMoat],
  );

  const { data: decimalsData } = useReadContracts({
    contracts: uniqueStakingTokens.map((addr) => ({
      address: addr as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "decimals" as const,
    })),
    query: { enabled: uniqueStakingTokens.length > 0 },
  });

  const stakingDecimals = useMemo((): Record<string, number> => {
    const m: Record<string, number> = {};
    uniqueStakingTokens.forEach((addr, i) => {
      const r = decimalsData?.[i];
      m[addr] = r?.status === "success" ? Number(r.result) : 18;
    });
    return m;
  }, [uniqueStakingTokens, decimalsData]);

  // ---- prices ----
  const allLlamaIds = useMemo(() => {
    if (!configs) return [];
    const ids = new Set<string>();
    for (const c of configs) {
      for (const t of c.rewardTokens) {
        if (t.enabled && t.tokenAddress) ids.add(getLlamaId(c.network, t.tokenAddress));
      }
      const meta = getMoatMeta(c.contractAddress);
      if (meta.tokenAddress) ids.add(getLlamaId(c.network, meta.tokenAddress));
    }
    Object.entries(stakingTokenByMoat).forEach(([moat, tokenAddr]) => {
      const cfg = configs.find((c) => c.contractAddress.toLowerCase() === moat);
      if (cfg && tokenAddr) ids.add(getLlamaId(cfg.network, tokenAddr));
    });
    return [...ids];
  }, [configs, stakingTokenByMoat]);

  const { data: priceMap } = useTokenPrices(allLlamaIds);

  const allTokenAddrs = useMemo(() => {
    const s = new Set<string>();
    if (configs) {
      for (const c of configs) {
        for (const t of c.rewardTokens ?? []) {
          if (t.tokenAddress) s.add(t.tokenAddress.toLowerCase());
        }
      }
    }
    Object.values(stakingTokenByMoat).forEach((a) => a && s.add(a));
    return [...s];
  }, [configs, stakingTokenByMoat]);

  const { data: dexInfoMap } = useDexscreenerInfo(allTokenAddrs);

  useResolveMoatMetas(
    (configs ?? []).map((c) => ({
      contractAddress: c.contractAddress,
      stakingToken: stakingTokenByMoat[c.contractAddress.toLowerCase()],
      network: c.network,
    })),
  );

  // ---- reward token resolution: addr → {symbol, decimals, network} ----
  const rewardTokenInfo = useMemo(() => {
    const m = new Map<string, { symbol: string; decimals: number; network: string }>();
    for (const c of configs ?? []) {
      for (const t of c.rewardTokens ?? []) {
        if (!t.tokenAddress) continue;
        const key = t.tokenAddress.toLowerCase();
        if (!m.has(key)) {
          m.set(key, {
            symbol: t.symbol || "TOKEN",
            decimals: typeof t.decimals === "number" ? t.decimals : 18,
            network: c.network || "avax",
          });
        }
      }
    }
    return m;
  }, [configs]);

  function priceFor(network: string, tokenAddr: string): number {
    const a = tokenAddr.toLowerCase();
    const llama = priceMap?.[getLlamaId(network, a).toLowerCase()] ?? 0;
    if (llama > 0) return llama;
    const dex = dexInfoMap?.[a]?.price ?? 0;
    if (dex > 0) return dex;
    if (a === USDC_ADDR) return 1;
    return 0;
  }

  // ---- DAILY BUCKETS: rewards distributed (by token group) ----
  const rewardsSeries = useMemo(() => {
    const buckets = new Map<number, { USDC: number; WAVAX: number; "BTC.b": number; Community: number }>();
    for (const e of ev.rewardsDeposited) {
      const ms = eventMs(e);
      if (!ms || ms < startMs) continue;
      const tokenAddr = (e.args?.token as string | undefined)?.toLowerCase();
      const amt = e.args?.amount as string | undefined;
      if (!tokenAddr || !amt) continue;
      const info = rewardTokenInfo.get(tokenAddr);
      // For WAVAX, fall back to known decimals even if no moat currently lists it.
      const decimals = info?.decimals ?? (tokenAddr === WAVAX_ADDR ? 18 : 18);
      const network = info?.network ?? "avax";
      const symbol = info?.symbol ?? (tokenAddr === WAVAX_ADDR ? "WAVAX" : "TOKEN");
      let raw = 0;
      try {
        raw = Number(formatUnits(BigInt(amt), decimals));
      } catch {
        continue;
      }
      const price = priceFor(network, tokenAddr);
      const usd = raw * price;
      if (!isFinite(usd) || usd <= 0) continue;
      const k = dayKey(ms);
      const bucket = buckets.get(k) ?? { USDC: 0, WAVAX: 0, "BTC.b": 0, Community: 0 };
      bucket[bucketLabelFor(symbol, tokenAddr)] += usd;
      buckets.set(k, bucket);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, b]) => ({ day, ...b, total: b.USDC + b.WAVAX + b["BTC.b"] + b.Community }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev.rewardsDeposited, startMs, rewardTokenInfo, priceMap, dexInfoMap]);

  // ---- DAILY BUCKETS: activity USD (Staked / Locked / Burned) ----
  // USD = on-chain amount × staking-token price for that moat.
  const activitySeries = useMemo(() => {
    type Row = { day: number; Staked: number; Locked: number; Burned: number };
    const buckets = new Map<number, Row>();
    const addEvent = (e: MoatEvent, key: keyof Omit<Row, "day">) => {
      const ms = eventMs(e);
      if (!ms || ms < startMs) return;
      const moat = e.contractAddress.toLowerCase();
      const tokenAddr = stakingTokenByMoat[moat];
      if (!tokenAddr) return;
      const cfg = configs?.find((c) => c.contractAddress.toLowerCase() === moat);
      const network = cfg?.network || "avax";
      const dec = stakingDecimals[tokenAddr] ?? 18;
      const amt = e.args?.amount as string | undefined;
      if (!amt) return;
      let raw = 0;
      try {
        raw = Number(formatUnits(BigInt(amt), dec));
      } catch {
        return;
      }
      const price = priceFor(network, tokenAddr);
      const usd = raw * price;
      if (!isFinite(usd) || usd <= 0) return;
      const k = dayKey(ms);
      const b = buckets.get(k) ?? { day: k, Staked: 0, Locked: 0, Burned: 0 };
      b[key] += usd;
      buckets.set(k, b);
    };
    ev.staked.forEach((e) => addEvent(e, "Staked"));
    ev.locked.forEach((e) => addEvent(e, "Locked"));
    ev.burned.forEach((e) => addEvent(e, "Burned"));
    return [...buckets.values()].sort((a, b) => a.day - b.day);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev.staked, ev.locked, ev.burned, startMs, stakingTokenByMoat, stakingDecimals, configs, priceMap, dexInfoMap]);

  // delta vs previous period
  const activityDelta = useMemo(() => {
    const days = timeframeDays(tf);
    const prevStart = tf === "ALL" ? 0 : startMs - days * 86400_000;
    const prev = { Staked: 0, Locked: 0, Burned: 0 };
    const cur = { Staked: 0, Locked: 0, Burned: 0 };
    const add = (events: MoatEvent[], key: keyof typeof cur) => {
      for (const e of events) {
        const ms = eventMs(e);
        if (!ms) continue;
        const moat = e.contractAddress.toLowerCase();
        const tokenAddr = stakingTokenByMoat[moat];
        if (!tokenAddr) continue;
        const cfg = configs?.find((c) => c.contractAddress.toLowerCase() === moat);
        const dec = stakingDecimals[tokenAddr] ?? 18;
        const amt = e.args?.amount as string | undefined;
        if (!amt) continue;
        let raw = 0;
        try {
          raw = Number(formatUnits(BigInt(amt), dec));
        } catch {
          continue;
        }
        const price = priceFor(cfg?.network || "avax", tokenAddr);
        const usd = raw * price;
        if (!isFinite(usd) || usd <= 0) continue;
        if (ms >= startMs) cur[key] += usd;
        else if (ms >= prevStart) prev[key] += usd;
      }
    };
    add(ev.staked, "Staked");
    add(ev.locked, "Locked");
    add(ev.burned, "Burned");
    const pct = (c: number, p: number) => (p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100);
    return {
      Staked: { cur: cur.Staked, pct: pct(cur.Staked, prev.Staked) },
      Locked: { cur: cur.Locked, pct: pct(cur.Locked, prev.Locked) },
      Burned: { cur: cur.Burned, pct: pct(cur.Burned, prev.Burned) },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev.staked, ev.locked, ev.burned, tf, startMs, stakingTokenByMoat, stakingDecimals, configs, priceMap, dexInfoMap]);

  // ---- UNIQUE WALLETS per day ----
  const walletsSeries = useMemo(() => {
    const byDay = new Map<number, Set<string>>();
    const sources = [ev.staked, ev.locked, ev.burned, ev.rewardClaimed, ev.withdrawn, ev.lockExited];
    for (const arr of sources) {
      for (const e of arr) {
        const ms = eventMs(e);
        if (!ms || ms < startMs) continue;
        const user = (e.args?.user as string | undefined)?.toLowerCase();
        if (!user) continue;
        const k = dayKey(ms);
        const s = byDay.get(k) ?? new Set<string>();
        s.add(user);
        byDay.set(k, s);
      }
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a - b)
      .map(([day, s]) => ({ day, wallets: s.size }));
  }, [ev.staked, ev.locked, ev.burned, ev.rewardClaimed, ev.withdrawn, ev.lockExited, startMs]);

  // ---- LIFETIME unique wallets (for KPI strip) ----
  const lifetimeUniqueWallets = useMemo(() => {
    const s = new Set<string>();
    for (const arr of [ev.staked, ev.locked, ev.burned]) {
      for (const e of arr) {
        const u = (e.args?.user as string | undefined)?.toLowerCase();
        if (u) s.add(u);
      }
    }
    return s.size;
  }, [ev.staked, ev.locked, ev.burned]);

  // ---- TOTALS in timeframe ----
  const totals = useMemo(() => {
    let rewardsUsd = 0;
    let burnedUsd = 0;
    let walletsInWindow = new Set<string>();
    for (const row of rewardsSeries) rewardsUsd += row.total;
    for (const row of activitySeries) burnedUsd += row.Burned;
    for (const arr of [ev.staked, ev.locked, ev.burned, ev.rewardClaimed, ev.withdrawn, ev.lockExited]) {
      for (const e of arr) {
        const ms = eventMs(e);
        if (!ms || ms < startMs) continue;
        const u = (e.args?.user as string | undefined)?.toLowerCase();
        if (u) walletsInWindow.add(u);
      }
    }
    return { rewardsUsd, burnedUsd, activeWallets: walletsInWindow.size };
  }, [
    rewardsSeries,
    activitySeries,
    ev.staked,
    ev.locked,
    ev.burned,
    ev.rewardClaimed,
    ev.withdrawn,
    ev.lockExited,
    startMs,
  ]);

  // ---- Top moats by rewards paid (timeframe) ----
  const topMoats = useMemo(() => {
    type Row = {
      address: string;
      cfg: MoatConfig | undefined;
      rewardsUsd: number;
      wallets: Set<string>;
      burnedUsd: number;
      daily: Map<number, number>;
    };
    const m = new Map<string, Row>();
    const rowFor = (addr: string): Row => {
      const k = addr.toLowerCase();
      let r = m.get(k);
      if (!r) {
        r = {
          address: k,
          cfg: configs?.find((c) => c.contractAddress.toLowerCase() === k),
          rewardsUsd: 0,
          wallets: new Set<string>(),
          burnedUsd: 0,
          daily: new Map<number, number>(),
        };
        m.set(k, r);
      }
      return r;
    };
    for (const e of ev.rewardsDeposited) {
      const ms = eventMs(e);
      if (!ms || ms < startMs) continue;
      const tokenAddr = (e.args?.token as string | undefined)?.toLowerCase();
      const amt = e.args?.amount as string | undefined;
      if (!tokenAddr || !amt) continue;
      const info = rewardTokenInfo.get(tokenAddr);
      const dec = info?.decimals ?? 18;
      const net = info?.network ?? "avax";
      let raw = 0;
      try { raw = Number(formatUnits(BigInt(amt), dec)); } catch { continue; }
      const usd = raw * priceFor(net, tokenAddr);
      if (!isFinite(usd) || usd <= 0) continue;
      const r = rowFor(e.contractAddress);
      r.rewardsUsd += usd;
      const k = dayKey(ms);
      r.daily.set(k, (r.daily.get(k) ?? 0) + usd);
    }
    for (const arr of [ev.staked, ev.locked, ev.burned, ev.rewardClaimed, ev.withdrawn, ev.lockExited]) {
      for (const e of arr) {
        const ms = eventMs(e);
        if (!ms || ms < startMs) continue;
        const u = (e.args?.user as string | undefined)?.toLowerCase();
        if (u) rowFor(e.contractAddress).wallets.add(u);
      }
    }
    for (const e of ev.burned) {
      const ms = eventMs(e);
      if (!ms || ms < startMs) continue;
      const moat = e.contractAddress.toLowerCase();
      const tokenAddr = stakingTokenByMoat[moat];
      if (!tokenAddr) continue;
      const cfg = configs?.find((c) => c.contractAddress.toLowerCase() === moat);
      const dec = stakingDecimals[tokenAddr] ?? 18;
      const amt = e.args?.amount as string | undefined;
      if (!amt) continue;
      let raw = 0;
      try { raw = Number(formatUnits(BigInt(amt), dec)); } catch { continue; }
      const usd = raw * priceFor(cfg?.network || "avax", tokenAddr);
      if (isFinite(usd) && usd > 0) rowFor(e.contractAddress).burnedUsd += usd;
    }
    return [...m.values()]
      .filter((r) => r.rewardsUsd > 0)
      .sort((a, b) => b.rewardsUsd - a.rewardsUsd)
      .slice(0, 10)
      .map((r) => ({
        ...r,
        spark: [...r.daily.entries()].sort(([a], [b]) => a - b).map(([day, v]) => ({ day, v })),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ev.rewardsDeposited,
    ev.staked,
    ev.locked,
    ev.burned,
    ev.rewardClaimed,
    ev.withdrawn,
    ev.lockExited,
    startMs,
    rewardTokenInfo,
    stakingTokenByMoat,
    stakingDecimals,
    configs,
    priceMap,
    dexInfoMap,
  ]);

  // ---- Network split (count of moats by network) ----
  const networkSplit = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of configs ?? []) {
      if (c.status === "Deprecated") continue;
      const k = (c.network || "avax").toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()].map(([k, v]) => ({ name: k, value: v }));
  }, [configs]);

  // ---- Status split ----
  const statusSplit = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of configs ?? []) {
      if (c.status === "Deprecated") continue;
      counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
    }
    return [...counts.entries()].map(([k, v]) => ({ name: k, value: v }));
  }, [configs]);

  // ---- Reward token mix (lifetime USD, regardless of timeframe) ----
  const tokenMix = useMemo(() => {
    const groupUsd = { USDC: 0, WAVAX: 0, "BTC.b": 0, Community: 0 };
    const perTokenUsd = new Map<string, { symbol: string; usd: number }>();
    for (const e of ev.rewardsDeposited) {
      const tokenAddr = (e.args?.token as string | undefined)?.toLowerCase();
      const amt = e.args?.amount as string | undefined;
      if (!tokenAddr || !amt) continue;
      const info = rewardTokenInfo.get(tokenAddr);
      const dec = info?.decimals ?? 18;
      const net = info?.network ?? "avax";
      const sym = info?.symbol ?? (tokenAddr === WAVAX_ADDR ? "WAVAX" : "TOKEN");
      let raw = 0;
      try { raw = Number(formatUnits(BigInt(amt), dec)); } catch { continue; }
      const usd = raw * priceFor(net, tokenAddr);
      if (!isFinite(usd) || usd <= 0) continue;
      const label = bucketLabelFor(sym, tokenAddr);
      groupUsd[label] += usd;
      if (label === "Community") {
        const cur = perTokenUsd.get(tokenAddr) ?? { symbol: sym, usd: 0 };
        cur.usd += usd;
        perTokenUsd.set(tokenAddr, cur);
      }
    }
    const total = groupUsd.USDC + groupUsd.WAVAX + groupUsd["BTC.b"] + groupUsd.Community;
    const bar = [{
      name: "mix",
      USDC: groupUsd.USDC,
      WAVAX: groupUsd.WAVAX,
      "BTC.b": groupUsd["BTC.b"],
      Community: groupUsd.Community,
    }];
    const topCommunity = [...perTokenUsd.values()]
      .sort((a, b) => b.usd - a.usd)
      .slice(0, 5);
    return { bar, total, topCommunity, groupUsd };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ev.rewardsDeposited, rewardTokenInfo, priceMap, dexInfoMap]);

  // ---- KPI strip ----
  const activeMoats = (configs ?? []).filter(
    (c) => c.status === "Verified" || c.status === "Community",
  ).length;
  const lifetimeRewardsUsd = tokenMix.total;

  const kpis = [
    {
      label: `Rewards Paid (${tf})`,
      value: totals.rewardsUsd,
      icon: Gift,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      fmt: fmtUsd,
      testId: "kpi-rewards-tf",
    },
    {
      label: `Active Wallets (${tf})`,
      value: totals.activeWallets,
      icon: Users,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      fmt: fmtNum,
      testId: "kpi-wallets-tf",
    },
    {
      label: "Active Moats",
      value: activeMoats,
      icon: Activity,
      color: "text-primary",
      bg: "bg-primary/10",
      fmt: fmtNum,
      testId: "kpi-moats",
    },
    {
      label: "Lifetime Rewards",
      value: lifetimeRewardsUsd,
      icon: DollarSign,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      fmt: fmtUsd,
      testId: "kpi-rewards-lifetime",
    },
    {
      label: `Burned (${tf})`,
      value: totals.burnedUsd,
      icon: Flame,
      color: "text-rose-400",
      bg: "bg-rose-400/10",
      fmt: fmtUsd,
      testId: "kpi-burned",
    },
    {
      label: "Moats w/ Active Locks",
      value: activeLocksTotal,
      icon: LockIcon,
      color: "text-cyan-400",
      bg: "bg-cyan-400/10",
      fmt: fmtNum,
      testId: "kpi-active-locks",
    },
  ];

  const isLoading = ev.isLoading;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="pt-28 pb-16 px-4 max-w-7xl mx-auto w-full flex-1">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/10">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Analytics</h1>
          </div>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Protocol-wide trends across every Moat. Toggle the timeframe to scope the charts below.
          </p>
        </motion.div>

        {/* KPI Strip */}
        <section
          data-testid="analytics-kpi-strip"
          className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6"
        >
          {kpis.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              data-testid={k.testId}
              className="rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-4 hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${k.bg} shrink-0`}>
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold tabular-nums leading-tight">
                    <AnimatedValue value={k.value} format={k.fmt} />
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{k.label}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </section>

        {/* Timeframe toggle */}
        <div
          data-testid="timeframe-toggle"
          className="sticky top-16 z-30 mb-6 flex items-center gap-2 bg-background/80 backdrop-blur-xl py-3 -mx-4 px-4 border-b border-border/30"
        >
          <span className="text-xs text-muted-foreground mr-1 uppercase tracking-wider">Timeframe</span>
          <div className="inline-flex rounded-lg border border-border bg-card/40 p-0.5">
            {TIMEFRAMES.map((t) => (
              <button
                key={t}
                onClick={() => setTf(t)}
                data-testid={`tf-${t}`}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  tf === t
                    ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,212,255,0.3)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {isLoading && (
            <span className="text-xs text-muted-foreground ml-3">Loading event history…</span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5">
          {/* Rewards Distributed Over Time */}
          <ChartCard
            title="Rewards Distributed Over Time"
            subtitle="Daily USD value of emissions, stacked by token group"
            testId="chart-rewards"
          >
            <div className="h-72">
              {rewardsSeries.length === 0 ? (
                <EmptyState loading={isLoading} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={rewardsSeries}>
                    <defs>
                      {(Object.entries(TOKEN_COLORS) as [keyof typeof TOKEN_COLORS, string][]).map(([k, c]) => (
                        <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={c} stopOpacity={0.5} />
                          <stop offset="100%" stopColor={c} stopOpacity={0.05} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickFormatter={fmtDay}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => fmtUsd(v)}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {(Object.keys(TOKEN_COLORS) as (keyof typeof TOKEN_COLORS)[]).map((k) => (
                      <Area
                        key={k}
                        type="monotone"
                        dataKey={k}
                        stackId="rewards"
                        stroke={TOKEN_COLORS[k]}
                        fill={`url(#grad-${k})`}
                        strokeWidth={1.5}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>

          {/* Activity Over Time */}
          <ChartCard
            title="Activity Over Time"
            subtitle="Daily USD value of stakes, locks, and burns. Click legend to toggle."
            testId="chart-activity"
          >
            <div className="flex flex-wrap gap-2 mb-3">
              {(["Staked", "Locked", "Burned"] as const).map((k) => {
                const d = activityDelta[k];
                const up = d.pct >= 0;
                return (
                  <span
                    key={k}
                    data-testid={`delta-${k.toLowerCase()}`}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                      up
                        ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20"
                        : "bg-rose-400/10 text-rose-400 border border-rose-400/20"
                    }`}
                  >
                    <span className="text-muted-foreground">{k}</span>
                    <span className="tabular-nums">{fmtUsd(d.cur)}</span>
                    <span className="tabular-nums">{up ? "▲" : "▼"} {Math.abs(d.pct).toFixed(0)}%</span>
                  </span>
                );
              })}
            </div>
            <div className="h-72">
              {activitySeries.length === 0 ? (
                <EmptyState loading={isLoading} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activitySeries}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickFormatter={fmtDay}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => fmtUsd(v)}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Staked" stroke="#34d399" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Locked" stroke="#00d4ff" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Burned" stroke="#fb7185" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>

          {/* Active Wallets Over Time */}
          <ChartCard
            title="Unique Active Wallets Over Time"
            subtitle={`Daily distinct addresses with on-chain activity. Lifetime: ${lifetimeUniqueWallets.toLocaleString()}`}
            testId="chart-wallets"
          >
            <div className="h-60">
              {walletsSeries.length === 0 ? (
                <EmptyState loading={isLoading} />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={walletsSeries}>
                    <defs>
                      <linearGradient id="grad-wallets" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.3} vertical={false} />
                    <XAxis
                      dataKey="day"
                      tickFormatter={fmtDay}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<ChartTooltip valueFormat={fmtNum} />} />
                    <Area
                      type="monotone"
                      dataKey="wallets"
                      name="Wallets"
                      stroke="#a78bfa"
                      fill="url(#grad-wallets)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </ChartCard>

          {/* Top Moats */}
          <ChartCard
            title={`Top Moats by Rewards Paid (${tf})`}
            subtitle="Click a row to open the Moat detail page"
            testId="table-top-moats"
          >
            {topMoats.length === 0 ? (
              <EmptyState loading={isLoading} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border/50">
                    <tr>
                      <th className="text-left py-2 pr-3">#</th>
                      <th className="text-left py-2 pr-3">Moat</th>
                      <th className="text-left py-2 pr-3 hidden sm:table-cell">Network</th>
                      <th className="text-left py-2 pr-3 hidden md:table-cell">Status</th>
                      <th className="text-right py-2 pr-3">Rewards</th>
                      <th className="text-right py-2 pr-3 hidden sm:table-cell">Wallets</th>
                      <th className="text-right py-2 pr-3 hidden md:table-cell">Burned</th>
                      <th className="text-right py-2 hidden lg:table-cell">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topMoats.map((r, i) => {
                      const meta = getMoatMeta(r.address);
                      return (
                        <tr
                          key={r.address}
                          className="border-b border-border/30 hover:bg-muted/20 transition-colors"
                        >
                          <td className="py-2 pr-3 text-muted-foreground tabular-nums">{i + 1}</td>
                          <td className="py-2 pr-3">
                            <Link
                              href={`/moat/${r.address}`}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {meta.name}
                            </Link>
                          </td>
                          <td className="py-2 pr-3 hidden sm:table-cell">
                            <span className="capitalize text-muted-foreground">{r.cfg?.network || "—"}</span>
                          </td>
                          <td className="py-2 pr-3 hidden md:table-cell">
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full border"
                              style={{
                                color: STATUS_COLORS[r.cfg?.status || ""] || "hsl(var(--muted-foreground))",
                                borderColor: (STATUS_COLORS[r.cfg?.status || ""] || "hsl(var(--border))") + "55",
                                background: (STATUS_COLORS[r.cfg?.status || ""] || "transparent") + "11",
                              }}
                            >
                              {r.cfg?.status || "—"}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums font-medium text-emerald-400">
                            {fmtUsd(r.rewardsUsd)}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums hidden sm:table-cell">
                            {r.wallets.size.toLocaleString()}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums hidden md:table-cell text-rose-400">
                            {r.burnedUsd > 0 ? fmtUsd(r.burnedUsd) : "—"}
                          </td>
                          <td className="py-2 hidden lg:table-cell">
                            <div className="h-8 w-28 ml-auto">
                              {r.spark.length > 1 && (
                                <ResponsiveContainer>
                                  <LineChart data={r.spark}>
                                    <Line
                                      type="monotone"
                                      dataKey="v"
                                      stroke="#34d399"
                                      strokeWidth={1.5}
                                      dot={false}
                                    />
                                  </LineChart>
                                </ResponsiveContainer>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>

          {/* Network + Status donuts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ChartCard title="Moats by Network" testId="chart-network">
              <div className="h-60">
                {networkSplit.length === 0 ? (
                  <EmptyState loading={isLoading} />
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={networkSplit}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        stroke="hsl(var(--background))"
                      >
                        {networkSplit.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={NETWORK_COLORS[entry.name] || "#888"}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip valueFormat={fmtNum} />} />
                      <Legend wrapperStyle={{ fontSize: 12, textTransform: "capitalize" }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>

            <ChartCard title="Moats by Status" testId="chart-status">
              <div className="h-60">
                {statusSplit.length === 0 ? (
                  <EmptyState loading={isLoading} />
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={statusSplit}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        stroke="hsl(var(--background))"
                      >
                        {statusSplit.map((entry) => (
                          <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || "#888"} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip valueFormat={fmtNum} />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ChartCard>
          </div>

          {/* Reward Token Mix */}
          <ChartCard
            title="Reward Token Mix (Lifetime)"
            subtitle={`Share of total USD rewards distributed across all Moats — ${fmtUsd(tokenMix.total)} all-time`}
            testId="chart-token-mix"
          >
            <div className="h-24">
              {tokenMix.total === 0 ? (
                <EmptyState loading={isLoading} />
              ) : (
                <ResponsiveContainer>
                  <BarChart data={tokenMix.bar} layout="vertical" stackOffset="expand">
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" hide />
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded-lg border border-border/80 bg-card/95 backdrop-blur-xl px-3 py-2 shadow-2xl shadow-black/60 text-xs">
                            {payload.map((p: any) => {
                              const v = p.value as number;
                              const pct = tokenMix.total > 0 ? (v / tokenMix.total) * 100 : 0;
                              return (
                                <div key={p.dataKey} className="flex items-center gap-2 tabular-nums">
                                  <span
                                    className="w-2 h-2 rounded-sm shrink-0"
                                    style={{ background: p.color || p.fill }}
                                  />
                                  <span className="text-muted-foreground">{p.name}:</span>
                                  <span className="text-foreground font-medium">{fmtUsd(v)}</span>
                                  <span className="text-muted-foreground">({pct.toFixed(1)}%)</span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }}
                    />
                    {(Object.keys(TOKEN_COLORS) as (keyof typeof TOKEN_COLORS)[]).map((k) => (
                      <Bar key={k} dataKey={k} stackId="mix" fill={TOKEN_COLORS[k]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-3">
              {(Object.keys(TOKEN_COLORS) as (keyof typeof TOKEN_COLORS)[]).map((k) => {
                const v = tokenMix.groupUsd[k];
                const pct = tokenMix.total > 0 ? (v / tokenMix.total) * 100 : 0;
                return (
                  <div key={k} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-2.5 h-2.5 rounded-sm"
                      style={{ background: TOKEN_COLORS[k] }}
                    />
                    <span className="text-muted-foreground">{k}</span>
                    <span className="tabular-nums font-medium">{fmtUsd(v)}</span>
                    <span className="text-muted-foreground tabular-nums">({pct.toFixed(1)}%)</span>
                  </div>
                );
              })}
            </div>
            {tokenMix.topCommunity.length > 0 && (
              <div className="mt-5 pt-4 border-t border-border/40">
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Top community reward tokens (by USD)
                </p>
                <ul className="space-y-1.5">
                  {tokenMix.topCommunity.map((t) => (
                    <li
                      key={t.symbol}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-foreground">{t.symbol}</span>
                      <span className="tabular-nums text-muted-foreground">{fmtUsd(t.usd)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ChartCard>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function EmptyState({ loading }: { loading: boolean }) {
  return (
    <div className="h-full w-full flex items-center justify-center">
      {loading ? (
        <div className="w-full h-full rounded-lg skeleton-shimmer border border-border/30" />
      ) : (
        <span className="text-sm text-muted-foreground">No data for this timeframe.</span>
      )}
    </div>
  );
}

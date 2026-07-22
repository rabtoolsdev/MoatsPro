import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReadContracts } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Coins,
  Copy,
  DollarSign,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Users as UsersIcon,
  Wallet,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { TokenLogo } from "@/components/swap/token-logo";
import { CHAIN_DISPLAY } from "@/lib/wagmi-config";
import { useAllMoatConfigs } from "@/hooks/use-moats-api";
import { MOAT_LOGO_ABI } from "@/lib/moat-abi";
import { getMoatMeta } from "@/lib/moat-metadata";
import {
  fetchStats,
  fetchSwaps,
  fetchUsers,
  backfillUsd,
  explorerTx,
  explorerAddr,
  type Range,
  type SwapRow,
  type UserRow,
} from "@/lib/admin-api";
import { useToast } from "@/hooks/use-toast";

const RANGE_LABELS: Array<{ value: Range; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All time" },
];

type Tab = "transactions" | "users";

export default function Admin() {
  const { toast } = useToast();
  const [range, setRange] = useState<Range>("24h");
  const [chainFilter, setChainFilter] = useState<number | null>(null);
  const [addressFilter, setAddressFilter] = useState<string>("");
  const [tab, setTab] = useState<Tab>("transactions");
  const [isBackfilling, setIsBackfilling] = useState(false);

  const stats = useQuery({
    queryKey: ["admin", "stats", range, chainFilter],
    queryFn: () => fetchStats(range, chainFilter),
    refetchInterval: 30_000,
  });

  const swaps = useQuery({
    queryKey: ["admin", "swaps", range, chainFilter, addressFilter],
    queryFn: () =>
      fetchSwaps(
        range,
        chainFilter,
        addressFilter ? addressFilter.toLowerCase() : null,
        100,
        0,
      ),
    enabled: tab === "transactions",
    refetchInterval: 30_000,
  });

  const users = useQuery({
    queryKey: ["admin", "users", range, chainFilter],
    queryFn: () => fetchUsers(range, chainFilter, 200),
    enabled: tab === "users",
    refetchInterval: 30_000,
  });

  const isFetching = stats.isFetching || swaps.isFetching || users.isFetching;
  const lastUpdated = stats.dataUpdatedAt;

  const { data: moatConfigs } = useAllMoatConfigs();
  const logoContracts = useMemo(() => {
    if (!moatConfigs) return [];
    return moatConfigs.map((c) => ({
      address: c.contractAddress as `0x${string}`,
      abi: MOAT_LOGO_ABI,
      functionName: "getLogoURL" as const,
    }));
  }, [moatConfigs]);
  const { data: logoData } = useReadContracts({
    contracts: logoContracts,
    query: {
      enabled: logoContracts.length > 0,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
  });
  const moatLogoByTokenAddress = useMemo((): Record<string, string> => {
    if (!moatConfigs) return {};
    const m: Record<string, string> = {};
    moatConfigs.forEach((c, i) => {
      const meta = getMoatMeta(c.contractAddress, c.network);
      if (!meta.tokenAddress) return;
      const tokenKey = meta.tokenAddress.toLowerCase();
      if (m[tokenKey]) return;
      const r = logoData?.[i];
      if (r?.status === "success" && typeof r.result === "string" && r.result.length > 0) {
        m[tokenKey] = r.result;
      } else if (meta.logoUrl) {
        m[tokenKey] = meta.logoUrl;
      }
    });
    return m;
  }, [logoData, moatConfigs]);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* cyber grid */}
      <div className="cyber-grid pointer-events-none" />

      {/* ambient glows */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,hsl(195_100%_50%/0.12),transparent_70%)]" />
      <div className="pointer-events-none absolute -left-40 top-1/3 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[80px]" />
      <div className="pointer-events-none absolute -right-40 bottom-1/4 h-[400px] w-[400px] rounded-full bg-violet-500/4 blur-[80px]" />

      <Navbar />
      <div
        className="relative pt-24 sm:pt-28 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        data-testid="admin-page"
      >
        <Header
          isFetching={isFetching}
          lastUpdated={lastUpdated}
          onRefresh={() => {
            void stats.refetch();
            void swaps.refetch();
            void users.refetch();
          }}
          isBackfilling={isBackfilling}
          onBackfill={async () => {
            if (isBackfilling) return;
            setIsBackfilling(true);
            let totalUpdated = 0;
            let totalFailed = 0;
            let cursor = 0;
            let finalRemaining = 0;
            let walkedToEnd = false;
            try {
              for (let i = 0; i < 40; i++) {
                const r = await backfillUsd(50, cursor);
                totalUpdated += r.updated;
                totalFailed += r.failed;
                finalRemaining = r.remaining;
                if (r.done) {
                  walkedToEnd = true;
                  break;
                }
                if (r.nextCursor == null) break;
                cursor = r.nextCursor;
              }
              if (walkedToEnd) {
                toast({
                  title: totalUpdated > 0 ? "USD backfill complete" : "Already up to date",
                  description:
                    totalUpdated > 0
                      ? `Priced ${totalUpdated} swap${totalUpdated === 1 ? "" : "s"}` +
                        (totalFailed > 0 ? ` · ${totalFailed} unpriced (no DEX listing)` : "")
                      : "All swaps already have USD pricing.",
                  variant: "success",
                });
              } else {
                toast({
                  title: "Backfill paused",
                  description:
                    `Priced ${totalUpdated} swap${totalUpdated === 1 ? "" : "s"} · ` +
                    `${finalRemaining} still missing. Click again to continue.`,
                });
              }
              void stats.refetch();
              void swaps.refetch();
              void users.refetch();
            } catch (err) {
              toast({
                title: "Backfill failed",
                description: err instanceof Error ? err.message : "Try again in a moment.",
                variant: "destructive",
              });
            } finally {
              setIsBackfilling(false);
            }
          }}
        />

        <Filters
          range={range}
          setRange={setRange}
          chainFilter={chainFilter}
          setChainFilter={setChainFilter}
        />

        <StatsGrid data={stats.data} loading={stats.isLoading} />

        <ChainBreakdown data={stats.data} />

        <div className="mt-12">
          {/* Tab bar */}
          <div className="flex items-center justify-between border-b border-white/[0.06] mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-1">
              <TabButton active={tab === "transactions"} onClick={() => setTab("transactions")}>
                <TrendingUp size={13} /> Transactions
              </TabButton>
              <TabButton active={tab === "users"} onClick={() => setTab("users")}>
                <UsersIcon size={13} /> Users
              </TabButton>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {tab === "transactions" ? (
                <TransactionsTable
                  rows={swaps.data?.rows ?? []}
                  total={swaps.data?.total ?? 0}
                  loading={swaps.isLoading}
                  addressFilter={addressFilter}
                  setAddressFilter={setAddressFilter}
                  moatLogoByTokenAddress={moatLogoByTokenAddress}
                />
              ) : (
                <UsersTable
                  rows={users.data?.rows ?? []}
                  loading={users.isLoading}
                  chainFilter={chainFilter}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Header ───────────────────────────────────────────

function Header({
  onRefresh,
  isFetching,
  lastUpdated,
  onBackfill,
  isBackfilling,
}: {
  onRefresh: () => void;
  isFetching: boolean;
  lastUpdated: number;
  onBackfill: () => void;
  isBackfilling: boolean;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-end justify-between mb-8 gap-4 flex-wrap">
      <div>
        {/* terminal badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/25 bg-primary/8 mb-3">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-70" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-primary/80">
            Live · Moat Swap
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-black tracking-tight bg-gradient-to-br from-foreground via-foreground/90 to-foreground/50 bg-clip-text text-transparent">
          Admin Dashboard
        </h1>

        <div className="mt-1.5 flex items-center gap-2 text-[11px] font-mono text-muted-foreground/60">
          <span>Real-time platform analytics. Auto-refresh every 30s.</span>
          {lastUpdated > 0 && (
            <>
              <span className="text-white/10">·</span>
              <span className="text-muted-foreground/40">
                Updated {formatRelative(new Date(lastUpdated).toISOString())}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onBackfill}
          disabled={isBackfilling}
          data-testid="btn-admin-backfill"
          title="Re-price any non-USDC swaps that are missing a USD volume value (uses current DexScreener prices)."
          className="group relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/10 bg-black/30 hover:border-primary/50 hover:bg-primary/5 hover:shadow-[0_0_20px_hsl(195_100%_50%/0.15)] disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-mono font-medium overflow-hidden"
        >
          <span className="absolute inset-0 btn-shimmer opacity-0 group-hover:opacity-100" />
          {isBackfilling ? (
            <Loader2 size={12} className="animate-spin text-primary" />
          ) : (
            <Sparkles size={12} className="group-hover:text-primary transition-colors" />
          )}
          {isBackfilling ? "Backfilling…" : "Backfill USD"}
        </button>

        <button
          onClick={onRefresh}
          data-testid="btn-admin-refresh"
          className="group relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/10 bg-black/30 hover:border-primary/50 hover:bg-primary/5 hover:shadow-[0_0_20px_hsl(195_100%_50%/0.15)] transition-all text-xs font-mono font-medium overflow-hidden"
        >
          <span className="absolute inset-0 btn-shimmer opacity-0 group-hover:opacity-100" />
          {isFetching ? (
            <Loader2 size={12} className="animate-spin text-primary" />
          ) : (
            <RefreshCw size={12} className="group-hover:text-primary transition-colors" />
          )}
          Refresh
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Filters ───────────────────────────────────────────

function Filters({
  range,
  setRange,
  chainFilter,
  setChainFilter,
}: {
  range: Range;
  setRange: (r: Range) => void;
  chainFilter: number | null;
  setChainFilter: (v: number | null) => void;
}) {
  const chains = useMemo(
    () => Object.entries(CHAIN_DISPLAY).map(([id, info]) => ({ id: Number(id), ...info })),
    [],
  );
  return (
    <div className="flex items-center gap-3 mb-7 flex-wrap">
      {/* range pill group */}
      <div className="flex items-center gap-0.5 p-1 rounded-xl border border-white/8 bg-black/30 backdrop-blur-sm">
        {RANGE_LABELS.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            data-testid={`range-${r.value}`}
            className={`relative px-3.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold tracking-wider transition-all ${
              range === r.value
                ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(195_100%_50%/0.35)] shadow-[0_0_12px_hsl(195_100%_50%/0.12)]"
                : "text-muted-foreground/70 hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
        <Filter size={10} /> Chain
      </div>

      {/* chain pill group */}
      <div className="flex items-center gap-0.5 p-1 rounded-xl border border-white/8 bg-black/30 backdrop-blur-sm flex-wrap">
        <button
          onClick={() => setChainFilter(null)}
          data-testid="chain-all"
          className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all ${
            chainFilter === null
              ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(195_100%_50%/0.35)]"
              : "text-muted-foreground/70 hover:text-foreground"
          }`}
        >
          All
        </button>
        {chains.map((c) => (
          <button
            key={c.id}
            onClick={() => setChainFilter(c.id)}
            data-testid={`chain-${c.network}`}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all ${
              chainFilter === c.id
                ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(195_100%_50%/0.35)]"
                : "text-muted-foreground/70 hover:text-foreground"
            }`}
          >
            <img src={c.logo} alt="" className="w-4 h-4 rounded-full" />
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────── Stats ───────────────────────────────────────────

function StatsGrid({
  data,
  loading,
}: {
  data:
    | {
        totals: { count: number; volumeUsd: number; feeUsd: number; uniqueUsers: number; avgSwapUsd?: number };
        allTime: { count: number; volumeUsd: number; feeUsd: number; uniqueUsers: number };
      }
    | undefined;
  loading: boolean;
}) {
  const t = data?.totals;
  const all = data?.allTime;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Stat
        icon={<DollarSign size={13} />}
        accentColor="from-cyan-500/25 via-cyan-500/5 to-transparent"
        borderGlow="hover:border-cyan-500/40 hover:shadow-[0_0_20px_hsl(195_100%_50%/0.1)]"
        topBar="bg-cyan-400/60"
        label="Volume (USD)"
        value={t ? formatUsd(t.volumeUsd) : "—"}
        sub={all ? `All time ${formatUsd(all.volumeUsd)}` : undefined}
        loading={loading}
        testId="stat-volume"
      />
      <Stat
        icon={<Activity size={13} />}
        accentColor="from-emerald-500/25 via-emerald-500/5 to-transparent"
        borderGlow="hover:border-emerald-500/40 hover:shadow-[0_0_20px_hsl(160_100%_50%/0.1)]"
        topBar="bg-emerald-400/60"
        label="Swaps"
        value={t ? formatInt(t.count) : "—"}
        sub={all ? `All time ${formatInt(all.count)}` : undefined}
        loading={loading}
        testId="stat-count"
      />
      <Stat
        icon={<Coins size={13} />}
        accentColor="from-amber-500/25 via-amber-500/5 to-transparent"
        borderGlow="hover:border-amber-500/40 hover:shadow-[0_0_20px_hsl(40_100%_50%/0.1)]"
        topBar="bg-amber-400/60"
        label="Fees collected"
        value={t ? formatUsd(t.feeUsd) : "—"}
        sub={all ? `All time ${formatUsd(all.feeUsd)}` : undefined}
        loading={loading}
        testId="stat-fees"
      />
      <Stat
        icon={<UsersIcon size={13} />}
        accentColor="from-violet-500/25 via-violet-500/5 to-transparent"
        borderGlow="hover:border-violet-500/40 hover:shadow-[0_0_20px_hsl(270_100%_65%/0.1)]"
        topBar="bg-violet-400/60"
        label="Unique users"
        value={t ? formatInt(t.uniqueUsers) : "—"}
        sub={
          t && t.count > 0 && t.avgSwapUsd
            ? `Avg swap ${formatUsd(t.avgSwapUsd)}`
            : all
              ? `All time ${formatInt(all.uniqueUsers)}`
              : undefined
        }
        loading={loading}
        testId="stat-users"
      />
    </div>
  );
}

function Stat({
  icon,
  accentColor,
  borderGlow,
  topBar,
  label,
  value,
  sub,
  loading,
  testId,
}: {
  icon: React.ReactNode;
  accentColor: string;
  borderGlow: string;
  topBar: string;
  label: string;
  value: string;
  sub?: string;
  loading: boolean;
  testId?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`group relative rounded-xl border border-white/8 bg-black/40 backdrop-blur-sm p-4 overflow-hidden transition-all ${borderGlow}`}
      data-testid={testId}
    >
      {/* top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${topBar} opacity-70 group-hover:opacity-100 transition-opacity`} />
      {/* gradient fill */}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentColor} opacity-50 group-hover:opacity-80 transition-opacity`} />

      <div className="relative">
        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.22em] text-muted-foreground/60 font-mono mb-2">
          <span className="text-primary/60">{icon}</span>
          {label}
        </div>
        <div className="text-2xl sm:text-3xl font-black tracking-tight tabular-nums font-mono">
          {loading ? (
            <span className="inline-block w-24 h-8 rounded-lg bg-white/5 animate-pulse" />
          ) : (
            value
          )}
        </div>
        {sub && (
          <div className="mt-1 text-[10px] text-muted-foreground/50 font-mono tabular-nums">{sub}</div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────── Chain / Routes ───────────────────────────────────────────

function ChainBreakdown({
  data,
}: {
  data:
    | {
        byChain: Array<{ chainId: number; network: string; count: number; volumeUsd: number; feeUsd: number }>;
        byRouter: Array<{ router: string; count: number }>;
      }
    | undefined;
}) {
  const byChain = data?.byChain ?? [];
  const byRouter = data?.byRouter ?? [];
  if (byChain.length === 0 && byRouter.length === 0) return null;
  const totalVolume = byChain.reduce((s, c) => s + c.volumeUsd, 0);
  const totalRouterCount = byRouter.reduce((s, r) => s + r.count, 0);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
      <Panel title="Volume by chain" icon={<TrendingUp size={11} />}>
        {byChain.length === 0 ? (
          <Empty>No swaps in this range.</Empty>
        ) : (
          <div className="space-y-3.5">
            {byChain
              .slice()
              .sort((a, b) => b.volumeUsd - a.volumeUsd)
              .map((c) => {
                const display = CHAIN_DISPLAY[c.chainId];
                const pct = totalVolume > 0 ? (c.volumeUsd / totalVolume) * 100 : 0;
                return (
                  <div key={c.chainId} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {display && (
                          <img src={display.logo} alt="" className="w-5 h-5 rounded-full" />
                        )}
                        <span className="text-xs font-mono font-semibold truncate">
                          {display?.label ?? c.network}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground/50">
                          {c.count} {c.count === 1 ? "swap" : "swaps"}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2 shrink-0">
                        <span className="text-sm font-mono font-bold tabular-nums">
                          {formatUsd(c.volumeUsd)}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground/50 tabular-nums w-10 text-right">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-primary to-cyan-400/70"
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Panel>

      <Panel title="Routes used" icon={<Activity size={11} />}>
        {byRouter.length === 0 ? (
          <Empty>No swaps in this range.</Empty>
        ) : (
          <div className="space-y-3.5">
            {byRouter
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((r) => {
                const pct = totalRouterCount > 0 ? (r.count / totalRouterCount) * 100 : 0;
                return (
                  <div key={r.router} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-mono font-semibold uppercase tracking-wider">
                        {prettyRouter(r.router)}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-mono font-bold tabular-nums">
                          {r.count}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground/50 tabular-nums w-10 text-right">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-primary/70"
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/40 backdrop-blur-sm p-5 relative overflow-hidden">
      {/* top accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.22em] text-muted-foreground/50 font-mono mb-5">
        {icon && <span className="text-primary/50">{icon}</span>}
        {title}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-mono text-muted-foreground/50 py-6 text-center">{children}</div>
  );
}

// ─────────────────────────────────────────── Tabs ───────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-mono font-bold uppercase tracking-wider transition-all ${
        active ? "text-primary" : "text-muted-foreground/50 hover:text-foreground"
      }`}
    >
      {children}
      {active && (
        <motion.span
          layoutId="admin-tab-underline"
          className="absolute left-0 right-0 -bottom-px h-[2px] bg-gradient-to-r from-primary/50 via-primary to-primary/50 shadow-[0_0_8px_hsl(195_100%_50%/0.6)]"
        />
      )}
    </button>
  );
}

// ─────────────────────────────────────── Transactions table ───────────────────────────────────

function TransactionsTable({
  rows,
  total,
  loading,
  addressFilter,
  setAddressFilter,
  moatLogoByTokenAddress,
}: {
  rows: SwapRow[];
  total: number;
  loading: boolean;
  addressFilter: string;
  setAddressFilter: (v: string) => void;
  moatLogoByTokenAddress: Record<string, string>;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/40 backdrop-blur-sm overflow-hidden relative">
      {/* top accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

      {/* table header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] gap-3 flex-wrap">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
          {loading
            ? "Loading…"
            : `${formatInt(rows.length)} of ${formatInt(total)} ${total === 1 ? "swap" : "swaps"}`}
        </div>
        <div className="relative flex-1 max-w-xs min-w-[200px]">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
          <input
            type="text"
            placeholder="Filter by wallet 0x…"
            value={addressFilter}
            onChange={(e) => setAddressFilter(e.target.value)}
            data-testid="input-address-filter"
            className="w-full pl-7 pr-3 py-2 rounded-lg bg-black/40 border border-white/8 focus:border-primary/50 focus:ring-1 focus:ring-primary/20 focus:shadow-[0_0_12px_hsl(195_100%_50%/0.1)] focus:outline-none text-[11px] font-mono tracking-wider text-foreground placeholder:text-muted-foreground/30 transition-all"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-black/70 backdrop-blur border-b border-white/[0.05]">
            <tr className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/40 font-mono">
              <Th>Time</Th>
              <Th>User</Th>
              <Th>Chain</Th>
              <Th>From → To</Th>
              <Th align="right">Volume</Th>
              <Th align="right">Fee</Th>
              <Th>Router</Th>
              <Th align="right">Status</Th>
              <Th align="right">Tx</Th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <SkeletonRows cols={9} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-14 text-center">
                  <div className="text-[11px] font-mono text-muted-foreground/40 uppercase tracking-wider">No swaps yet for this filter.</div>
                  <div className="text-[10px] font-mono text-muted-foreground/30 mt-1">
                    Activity will appear here as users swap.
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <TxRow
                  key={r.id}
                  row={r}
                  moatLogoByTokenAddress={moatLogoByTokenAddress}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TxRow({
  row: r,
  moatLogoByTokenAddress,
}: {
  row: SwapRow;
  moatLogoByTokenAddress: Record<string, string>;
}) {
  const display = CHAIN_DISPLAY[r.chainId];
  const fromLogoHint = moatLogoByTokenAddress[r.fromTokenAddress.toLowerCase()];
  const toLogoHint = moatLogoByTokenAddress[r.toTokenAddress.toLowerCase()];
  return (
    <tr
      className="border-b border-white/[0.04] hover:bg-primary/[0.03] transition-colors group"
      data-testid={`row-swap-${r.id}`}
    >
      <td className="px-3 py-3 text-[11px] font-mono whitespace-nowrap text-muted-foreground/50 tabular-nums">
        {formatRelative(r.createdAt)}
      </td>
      <td className="px-3 py-3 text-[11px] font-mono">
        <CopyableAddress address={r.walletAddress} chainId={r.chainId} />
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          {display && <img src={display.logo} alt="" className="w-4 h-4 rounded-full" />}
          <span className="font-semibold text-foreground/70">{display?.label ?? r.network}</span>
        </div>
      </td>
      <td className="px-3 py-3 text-[11px] font-mono">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            <TokenLogo
              address={r.fromTokenAddress}
              symbol={r.fromTokenSymbol}
              network={r.network}
              hint={fromLogoHint}
              size={20}
              className="ring-2 ring-black bg-black"
            />
            <TokenLogo
              address={r.toTokenAddress}
              symbol={r.toTokenSymbol}
              network={r.network}
              hint={toLogoHint}
              size={20}
              className="ring-2 ring-black bg-black"
            />
          </div>
          <div className="leading-tight">
            <div className="font-semibold tabular-nums text-foreground/90">
              {formatAmount(r.fromAmount)} {r.fromTokenSymbol}
            </div>
            <div className="text-[10px] text-muted-foreground/40 tabular-nums">
              → {formatAmount(r.toAmount)} {r.toTokenSymbol}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-[11px] text-right font-mono tabular-nums whitespace-nowrap text-foreground/80">
        {r.fromUsd != null ? formatUsd(r.fromUsd) : "—"}
      </td>
      <td className="px-3 py-3 text-[11px] text-right font-mono whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5">
          <div className="flex flex-col items-end leading-tight">
            {r.feeAmount != null && (
              <span className="text-primary/80 tabular-nums">
                {formatTokenAmount(r.feeAmount)} {r.fromTokenSymbol}
              </span>
            )}
            {r.feeUsd != null && (
              <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                {formatUsd(r.feeUsd)}
              </span>
            )}
            {r.feeAmount == null && r.feeUsd == null && <span className="text-muted-foreground/30">—</span>}
          </div>
          {r.feeTxHash && (
            <a
              href={explorerTx(r.chainId, r.feeTxHash)}
              target="_blank"
              rel="noreferrer"
              data-testid={`link-fee-tx-${r.id}`}
              title="View fee transfer on explorer"
              className="text-primary/50 hover:text-primary transition-colors"
            >
              <ArrowUpRight size={11} />
            </a>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-[10px] uppercase font-mono">
        <div className="flex flex-col items-start gap-0.5">
          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold tracking-widest border border-primary/15">
            {prettyRouter(r.router)}
          </span>
          {r.toolName && (
            <span className="text-muted-foreground/40 lowercase tracking-normal text-[10px]">
              via {r.toolName}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        <StatusPill status={r.status} />
      </td>
      <td className="px-3 py-3 text-right">
        <a
          href={explorerTx(r.chainId, r.txHash)}
          target="_blank"
          rel="noreferrer"
          data-testid={`link-tx-${r.id}`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors text-[11px] font-mono font-medium"
        >
          View <ArrowUpRight size={10} />
        </a>
      </td>
    </tr>
  );
}

function StatusPill({ status }: { status: string }) {
  const ok = status === "success";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase tracking-widest ${
        ok
          ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
          : "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20"
      }`}
    >
      {ok && <CheckCircle2 size={9} />}
      {status}
    </span>
  );
}

function CopyableAddress({
  address,
  chainId,
}: {
  address: string;
  chainId: number | null;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };
  return (
    <span className="group inline-flex items-center gap-1.5 font-mono">
      {chainId != null ? (
        <a
          href={explorerAddr(chainId, address)}
          target="_blank"
          rel="noreferrer"
          className="text-foreground/70 hover:text-primary transition-colors"
        >
          {shortAddr(address)}
        </a>
      ) : (
        <span className="text-foreground/70">{shortAddr(address)}</span>
      )}
      <button
        onClick={onCopy}
        aria-label={copied ? "Address copied" : "Copy wallet address"}
        title={copied ? "Copied!" : "Copy address"}
        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 rounded transition-opacity text-muted-foreground/40 hover:text-primary"
      >
        {copied ? <CheckCircle2 size={10} className="text-emerald-400" /> : <Copy size={10} />}
      </button>
    </span>
  );
}

function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-white/[0.04]">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-3 py-3.5">
              <div
                className="h-2.5 rounded bg-white/5 animate-pulse"
                style={{ width: `${50 + ((i * 7 + j * 11) % 40)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
  return (
    <th
      className={`px-3 py-3 font-bold ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

// ─────────────────────────────────────────── Users ───────────────────────────────────────────

function UsersTable({
  rows,
  loading,
  chainFilter,
}: {
  rows: UserRow[];
  loading: boolean;
  chainFilter: number | null;
}) {
  const topVolume = rows[0]?.volumeUsd ?? 0;
  return (
    <div className="rounded-xl border border-white/8 bg-black/40 backdrop-blur-sm overflow-hidden relative">
      {/* top accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

      <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
          {loading ? "Loading…" : `${formatInt(rows.length)} ${rows.length === 1 ? "user" : "users"}`}
        </div>
        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-muted-foreground/30">
          Sorted by volume
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-black/70 backdrop-blur border-b border-white/[0.05]">
            <tr className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/40 font-mono">
              <Th>Rank</Th>
              <Th>Wallet</Th>
              <Th align="right">Swaps</Th>
              <Th align="right">Volume</Th>
              <Th align="right">Fees paid</Th>
              <Th align="right">First</Th>
              <Th align="right">Last</Th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <SkeletonRows cols={7} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-14 text-center text-[11px] font-mono text-muted-foreground/40 uppercase tracking-wider">
                  No users yet.
                </td>
              </tr>
            ) : (
              rows.map((u, i) => {
                const pct = topVolume > 0 ? (u.volumeUsd / topVolume) * 100 : 0;
                return (
                  <tr
                    key={u.walletAddress}
                    className="border-b border-white/[0.04] hover:bg-primary/[0.03] transition-colors"
                    data-testid={`row-user-${u.walletAddress}`}
                  >
                    <td className="px-3 py-3">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="px-3 py-3 text-[11px] font-mono">
                      <div className="flex items-center gap-1.5">
                        <Wallet size={10} className="text-primary/50" />
                        <CopyableAddress address={u.walletAddress} chainId={chainFilter} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-right font-mono tabular-nums text-foreground/70">
                      {formatInt(u.swapCount)}
                    </td>
                    <td className="px-3 py-3 text-[11px] text-right font-mono tabular-nums">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-foreground/80">{formatUsd(u.volumeUsd)}</span>
                        <div className="w-20 h-0.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary/80 to-cyan-400/60"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-right font-mono tabular-nums text-primary/70">
                      {formatUsd(u.feeUsd)}
                    </td>
                    <td className="px-3 py-3 text-[11px] text-right font-mono text-muted-foreground/40 whitespace-nowrap tabular-nums">
                      {formatDate(u.firstSwap)}
                    </td>
                    <td className="px-3 py-3 text-[11px] text-right font-mono text-muted-foreground/40 whitespace-nowrap tabular-nums">
                      {formatRelative(u.lastSwap)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const variant =
    rank === 1
      ? "bg-gradient-to-br from-amber-300/30 to-amber-500/20 text-amber-300 ring-amber-400/30"
      : rank === 2
        ? "bg-gradient-to-br from-slate-300/30 to-slate-500/20 text-slate-200 ring-slate-400/30"
        : rank === 3
          ? "bg-gradient-to-br from-orange-400/30 to-orange-600/20 text-orange-300 ring-orange-400/30"
          : "bg-white/4 text-muted-foreground/40 ring-white/8";
  return (
    <span
      className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-mono font-bold tabular-nums ring-1 ${variant}`}
    >
      {rank}
    </span>
  );
}

// ───────────────────────────────────────── helpers ─────────────────────────────────────────

function shortAddr(a: string): string {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function prettyRouter(r: string): string {
  if (r === "lifi") return "Li.Fi";
  if (r === "0x") return "0x";
  if (r === "kyber") return "KyberSwap";
  return r;
}

function formatUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v === 0) return "$0";
  const abs = Math.abs(v);
  if (abs < 0.01) {
    if (abs < 0.0001) return `$${v.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")}`;
    return `$${v.toFixed(5).replace(/0+$/, "").replace(/\.$/, "")}`;
  }
  if (abs < 1) return `$${v.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
  if (abs < 1000) return `$${v.toFixed(2)}`;
  if (abs < 1_000_000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (abs < 1_000_000_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${(v / 1_000_000).toFixed(2)}M`;
}

function formatInt(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatAmount(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "0";
  if (v < 0.0001) return v.toExponential(2);
  if (v < 1) return v.toFixed(4).replace(/\.?0+$/, "");
  if (v < 1000) return v.toFixed(3).replace(/\.?0+$/, "");
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatTokenAmount(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "0";
  const abs = Math.abs(v);
  let decimals: number;
  if (abs >= 1) decimals = 4;
  else if (abs >= 0.01) decimals = 5;
  else if (abs >= 0.0001) decimals = 6;
  else if (abs >= 0.000001) decimals = 8;
  else decimals = 10;
  const s = v.toFixed(decimals);
  return s.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(iso);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

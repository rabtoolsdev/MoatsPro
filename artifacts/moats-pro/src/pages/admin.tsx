import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  TrendingUp,
  Users as UsersIcon,
  Wallet,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { CHAIN_DISPLAY } from "@/lib/wagmi-config";
import {
  fetchStats,
  fetchSwaps,
  fetchUsers,
  explorerTx,
  explorerAddr,
  type Range,
  type SwapRow,
  type UserRow,
} from "@/lib/admin-api";

const RANGE_LABELS: Array<{ value: Range; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All time" },
];

type Tab = "transactions" | "users";

export default function Admin() {
  const [range, setRange] = useState<Range>("24h");
  const [chainFilter, setChainFilter] = useState<number | null>(null);
  const [addressFilter, setAddressFilter] = useState<string>("");
  const [tab, setTab] = useState<Tab>("transactions");

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="pt-24 sm:pt-28 pb-24 px-4 max-w-7xl mx-auto" data-testid="admin-page">
        <Header
          onRefresh={() => {
            void stats.refetch();
            void swaps.refetch();
            void users.refetch();
          }}
          isFetching={stats.isFetching || swaps.isFetching || users.isFetching}
        />

        <Filters
          range={range}
          setRange={setRange}
          chainFilter={chainFilter}
          setChainFilter={setChainFilter}
        />

        <StatsGrid data={stats.data} loading={stats.isLoading} />

        <ChainBreakdown data={stats.data} />

        <div className="mt-8">
          <div className="flex items-center gap-1 border-b border-border/40 mb-4">
            <TabButton active={tab === "transactions"} onClick={() => setTab("transactions")}>
              <TrendingUp size={14} /> Transactions
            </TabButton>
            <TabButton active={tab === "users"} onClick={() => setTab("users")}>
              <UsersIcon size={14} /> Users
            </TabButton>
          </div>

          {tab === "transactions" ? (
            <TransactionsTable
              rows={swaps.data?.rows ?? []}
              total={swaps.data?.total ?? 0}
              loading={swaps.isLoading}
              addressFilter={addressFilter}
              setAddressFilter={setAddressFilter}
            />
          ) : (
            <UsersTable rows={users.data?.rows ?? []} loading={users.isLoading} />
          )}
        </div>
      </div>
    </div>
  );
}

function Header({
  onRefresh,
  isFetching,
}: {
  onRefresh: () => void;
  isFetching: boolean;
}) {
  return (
    <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Moat Swap
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Admin Dashboard</h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          data-testid="btn-admin-refresh"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card/40 hover:border-primary/60 hover:bg-card/70 transition-all text-xs"
        >
          {isFetching ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Refresh
        </button>
      </div>
    </div>
  );
}

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
    <div className="flex items-center gap-3 mb-5 flex-wrap">
      <div className="flex items-center gap-1 p-1 rounded-lg border border-border/60 bg-card/40">
        {RANGE_LABELS.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            data-testid={`range-${r.value}`}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              range === r.value
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Filter size={12} /> Chain:
      </div>
      <div className="flex items-center gap-1 p-1 rounded-lg border border-border/60 bg-card/40 flex-wrap">
        <button
          onClick={() => setChainFilter(null)}
          data-testid="chain-all"
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            chainFilter === null
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        {chains.map((c) => (
          <button
            key={c.id}
            onClick={() => setChainFilter(c.id)}
            data-testid={`chain-${c.network}`}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
              chainFilter === c.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
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
        label="Volume (USD)"
        value={t ? formatUsd(t.volumeUsd) : "—"}
        sub={all ? `All time: ${formatUsd(all.volumeUsd)}` : undefined}
        loading={loading}
        testId="stat-volume"
      />
      <Stat
        label="Swaps"
        value={t ? formatInt(t.count) : "—"}
        sub={all ? `All time: ${formatInt(all.count)}` : undefined}
        loading={loading}
        testId="stat-count"
      />
      <Stat
        label="Fees collected"
        value={t ? formatUsd(t.feeUsd) : "—"}
        sub={all ? `All time: ${formatUsd(all.feeUsd)}` : undefined}
        loading={loading}
        testId="stat-fees"
      />
      <Stat
        label="Unique users"
        value={t ? formatInt(t.uniqueUsers) : "—"}
        sub={
          t && t.count > 0 && t.avgSwapUsd
            ? `Avg swap: ${formatUsd(t.avgSwapUsd)}`
            : all
              ? `All time: ${formatInt(all.uniqueUsers)}`
              : undefined
        }
        loading={loading}
        testId="stat-users"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  loading,
  testId,
}: {
  label: string;
  value: string;
  sub?: string;
  loading: boolean;
  testId?: string;
}) {
  return (
    <div
      className="rounded-xl border border-border/60 bg-card/40 p-4"
      data-testid={testId}
    >
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight">
        {loading ? <span className="inline-block w-20 h-7 rounded bg-muted/30 animate-pulse" /> : value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground/70">{sub}</div>}
    </div>
  );
}

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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Volume by chain
        </div>
        {byChain.length === 0 ? (
          <div className="text-xs text-muted-foreground/70">No swaps in this range.</div>
        ) : (
          <div className="space-y-2">
            {byChain
              .slice()
              .sort((a, b) => b.volumeUsd - a.volumeUsd)
              .map((c) => {
                const display = CHAIN_DISPLAY[c.chainId];
                const max = Math.max(...byChain.map((x) => x.volumeUsd), 1);
                const pct = (c.volumeUsd / max) * 100;
                return (
                  <div key={c.chainId} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-32 shrink-0">
                      {display && (
                        <img src={display.logo} alt="" className="w-4 h-4 rounded-full" />
                      )}
                      <span className="text-xs font-medium">{display?.label ?? c.network}</span>
                    </div>
                    <div className="flex-1 h-2 rounded-full bg-muted/20 overflow-hidden">
                      <div
                        className="h-full bg-primary/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-xs font-mono w-28 text-right">
                      {formatUsd(c.volumeUsd)}
                    </div>
                    <div className="text-[10px] text-muted-foreground w-12 text-right">
                      {c.count} sw
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
          Routes used
        </div>
        {byRouter.length === 0 ? (
          <div className="text-xs text-muted-foreground/70">No swaps in this range.</div>
        ) : (
          <div className="space-y-2">
            {byRouter
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((r) => {
                const max = Math.max(...byRouter.map((x) => x.count), 1);
                const pct = (r.count / max) * 100;
                return (
                  <div key={r.router} className="flex items-center gap-3">
                    <div className="w-32 shrink-0 text-xs font-medium uppercase">
                      {r.router === "lifi" ? "Li.Fi" : r.router}
                    </div>
                    <div className="flex-1 h-2 rounded-full bg-muted/20 overflow-hidden">
                      <div
                        className="h-full bg-primary/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-xs font-mono w-16 text-right">{r.count}</div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}

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
      className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-all ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function TransactionsTable({
  rows,
  total,
  loading,
  addressFilter,
  setAddressFilter,
}: {
  rows: SwapRow[];
  total: number;
  loading: boolean;
  addressFilter: string;
  setAddressFilter: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border/40 gap-3 flex-wrap">
        <div className="text-sm font-medium">
          {loading ? "Loading…" : `${formatInt(rows.length)} of ${formatInt(total)} swaps`}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter by wallet 0x…"
            value={addressFilter}
            onChange={(e) => setAddressFilter(e.target.value)}
            data-testid="input-address-filter"
            className="w-full pl-7 pr-2 py-1.5 rounded-md bg-muted/20 border border-border/60 focus:border-primary/60 focus:outline-none text-xs font-mono"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
              <th className="text-left px-3 py-2 font-semibold">Time</th>
              <th className="text-left px-3 py-2 font-semibold">User</th>
              <th className="text-left px-3 py-2 font-semibold">Chain</th>
              <th className="text-left px-3 py-2 font-semibold">From → To</th>
              <th className="text-right px-3 py-2 font-semibold">Volume</th>
              <th className="text-right px-3 py-2 font-semibold">Fee</th>
              <th className="text-left px-3 py-2 font-semibold">Router</th>
              <th className="text-right px-3 py-2 font-semibold">Tx</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground text-xs">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground text-xs">No swaps yet for this filter.</td></tr>
            ) : rows.map((r) => {
              const display = CHAIN_DISPLAY[r.chainId];
              return (
                <tr key={r.id} className="border-b border-border/30 hover:bg-muted/10" data-testid={`row-swap-${r.id}`}>
                  <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
                    {formatRelative(r.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono">
                    <a
                      href={explorerAddr(r.chainId, r.walletAddress)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground hover:text-primary"
                    >
                      {shortAddr(r.walletAddress)}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      {display && <img src={display.logo} alt="" className="w-3.5 h-3.5 rounded-full" />}
                      <span>{display?.label ?? r.network}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className="font-medium">{formatAmount(r.fromAmount)} {r.fromTokenSymbol}</span>
                    <span className="text-muted-foreground mx-1">→</span>
                    <span className="font-medium">{formatAmount(r.toAmount)} {r.toTokenSymbol}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono whitespace-nowrap">
                    {r.fromUsd != null ? formatUsd(r.fromUsd) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-right font-mono whitespace-nowrap text-primary/90">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="flex flex-col items-end leading-tight">
                        {r.feeAmount != null && (
                          <span>{formatTokenAmount(r.feeAmount)} {r.fromTokenSymbol}</span>
                        )}
                        {r.feeUsd != null && (
                          <span className="text-[10px] text-muted-foreground/70">
                            {formatUsd(r.feeUsd)}
                          </span>
                        )}
                        {r.feeAmount == null && r.feeUsd == null && <span>—</span>}
                      </div>
                      {r.feeTxHash && (
                        <a
                          href={explorerTx(r.chainId, r.feeTxHash)}
                          target="_blank"
                          rel="noreferrer"
                          data-testid={`link-fee-tx-${r.id}`}
                          title="View fee transfer on explorer"
                          className="text-primary/70 hover:text-primary"
                        >
                          <ArrowUpRight size={11} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-[10px] uppercase">
                    <span className="px-1.5 py-0.5 rounded bg-muted/30 font-semibold">
                      {r.router === "lifi" ? "Li.Fi" : r.router}
                    </span>
                    {r.toolName && (
                      <span className="text-muted-foreground/70 ml-1.5 lowercase">via {r.toolName}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <a
                      href={explorerTx(r.chainId, r.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      data-testid={`link-tx-${r.id}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                    >
                      View <ArrowUpRight size={11} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UsersTable({ rows, loading }: { rows: UserRow[]; loading: boolean }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <div className="p-3 border-b border-border/40 text-sm font-medium">
        {loading ? "Loading…" : `${formatInt(rows.length)} users`}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
              <th className="text-left px-3 py-2 font-semibold">Wallet</th>
              <th className="text-right px-3 py-2 font-semibold">Swaps</th>
              <th className="text-right px-3 py-2 font-semibold">Volume</th>
              <th className="text-right px-3 py-2 font-semibold">Fees paid</th>
              <th className="text-right px-3 py-2 font-semibold">First</th>
              <th className="text-right px-3 py-2 font-semibold">Last</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-xs">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-xs">No users yet.</td></tr>
            ) : rows.map((u) => (
              <tr key={u.walletAddress} className="border-b border-border/30 hover:bg-muted/10" data-testid={`row-user-${u.walletAddress}`}>
                <td className="px-3 py-2 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <Wallet size={11} className="text-muted-foreground" />
                    {shortAddr(u.walletAddress)}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-right font-mono">{formatInt(u.swapCount)}</td>
                <td className="px-3 py-2 text-xs text-right font-mono">{formatUsd(u.volumeUsd)}</td>
                <td className="px-3 py-2 text-xs text-right font-mono text-primary/90">{formatUsd(u.feeUsd)}</td>
                <td className="px-3 py-2 text-xs text-right text-muted-foreground whitespace-nowrap">
                  {formatDate(u.firstSwap)}
                </td>
                <td className="px-3 py-2 text-xs text-right text-muted-foreground whitespace-nowrap">
                  {formatRelative(u.lastSwap)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- helpers ----------

function shortAddr(a: string): string {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (v === 0) return "$0";
  const abs = Math.abs(v);
  if (abs < 0.01) {
    // Show extra precision for sub-cent amounts (fees on tiny swaps).
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

// Always-readable token amount that never collapses to "0" or scientific form,
// even for tiny fee transfers (e.g. 0.00099 AVAX).
function formatTokenAmount(v: number): string {
  if (!Number.isFinite(v) || v === 0) return "0";
  const abs = Math.abs(v);
  let decimals: number;
  if (abs >= 1) decimals = 4;
  else if (abs >= 0.01) decimals = 5;
  else if (abs >= 0.0001) decimals = 6;
  else if (abs >= 0.000001) decimals = 8;
  else decimals = 10;
  // Trim trailing zeros but keep at least 2 decimals for readability.
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

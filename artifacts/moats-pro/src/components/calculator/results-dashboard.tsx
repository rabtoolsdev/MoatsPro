import { useState } from "react";
import { Download, Users, Ticket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WheelSpinner } from "./wheel-spinner";
import { WalletSpotlightModal } from "./wallet-spotlight-modal";
import type { CalculatorResponse, CalculatorWalletResult } from "@/lib/moats-api";

interface ResultsDashboardProps {
  data: CalculatorResponse | null;
  isLoading: boolean;
  error: string | null;
}

const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

function exportCsv(results: CalculatorWalletResult[]) {
  const header = [
    "address",
    "entries",
    "totalAmount",
    "transactionCount",
    "burnAmount",
    "stakeAmount",
    "lockAmount",
    "tokenSymbol",
  ];
  const rows = results.map((r) =>
    [
      r.address,
      r.entries,
      r.totalAmount,
      r.transactionCount,
      r.burnAmount,
      r.stakeAmount,
      r.lockAmount,
      r.tokenSymbol ?? "",
    ].join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `moat-entries-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultsDashboard({ data, isLoading, error }: ResultsDashboardProps) {
  const [spotlight, setSpotlight] = useState<CalculatorWalletResult | null>(null);
  const [showWheel, setShowWheel] = useState(false);

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/40 p-10 flex flex-col items-center gap-3 text-muted-foreground">
        <Sparkles className="animate-pulse text-primary" />
        <p className="text-sm">Reading on-chain transactions…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/20 p-10 text-center text-muted-foreground">
        <Ticket className="mx-auto mb-3 text-primary/60" size={28} />
        <p className="text-sm">
          Configure your criteria and run the calculator to see qualifying wallets.
        </p>
      </div>
    );
  }

  const sorted = [...data.results].sort((a, b) => b.entries - a.entries);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Qualifying Wallets</p>
            <p className="text-xl font-bold text-foreground" data-testid="stat-total-wallets">
              {data.totalWallets.toLocaleString()}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/40 p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Ticket size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Entries</p>
            <p className="text-xl font-bold text-foreground" data-testid="stat-total-entries">
              {data.totalEntries.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCsv(sorted)}
          disabled={sorted.length === 0}
          data-testid="button-export-csv"
          className="gap-2"
        >
          <Download size={14} /> Export CSV
        </Button>
        <Button
          size="sm"
          onClick={() => setShowWheel((v) => !v)}
          disabled={sorted.length === 0}
          data-testid="button-toggle-wheel"
          className="gap-2"
        >
          <Sparkles size={14} /> {showWheel ? "Hide" : "Pick a"} Winner
        </Button>
      </div>

      {showWheel && (
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
          <WheelSpinner wallets={sorted} />
        </div>
      )}

      <div className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Wallet</th>
                <th className="text-right px-4 py-3 font-medium">Entries</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Total</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Tx</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((w, i) => (
                <tr
                  key={w.address}
                  onClick={() => setSpotlight(w)}
                  data-testid={`result-row-${i}`}
                  className="border-b border-border/30 last:border-0 hover:bg-primary/5 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 font-mono text-foreground">
                    {short(w.address)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-primary">
                    {w.entries.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">
                    {w.totalAmount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                    {w.transactionCount}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No wallets matched the selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <WalletSpotlightModal wallet={spotlight} onClose={() => setSpotlight(null)} />
    </div>
  );
}

import { Flame, Lock, Layers, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CalculatorWalletResult } from "@/lib/moats-api";

interface WalletSpotlightModalProps {
  wallet: CalculatorWalletResult | null;
  onClose: () => void;
}

const TYPE_META: Record<string, { icon: typeof Flame; color: string }> = {
  burn: { icon: Flame, color: "text-orange-400" },
  stake: { icon: Layers, color: "text-emerald-400" },
  lock: { icon: Lock, color: "text-purple-400" },
};

export function WalletSpotlightModal({ wallet, onClose }: WalletSpotlightModalProps) {
  if (!wallet) return null;

  return (
    <Dialog open={!!wallet} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
        data-testid="wallet-spotlight-modal"
      >
        <DialogHeader>
          <DialogTitle className="text-base">Wallet Breakdown</DialogTitle>
        </DialogHeader>

        <p className="font-mono text-xs text-muted-foreground break-all -mt-2">
          {wallet.address}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
          <Stat label="Entries" value={wallet.entries.toLocaleString()} highlight />
          <Stat label="Transactions" value={wallet.transactionCount.toLocaleString()} />
          <Stat
            label="Total Amount"
            value={wallet.totalAmount.toLocaleString()}
          />
          <Stat
            label="Token"
            value={wallet.tokenSymbol ?? "—"}
          />
        </div>

        <div className="grid grid-cols-3 gap-3 mt-1">
          <Stat label="Burned" value={wallet.burnAmount.toLocaleString()} sub={`${wallet.burnCount} tx`} />
          <Stat label="Staked" value={wallet.stakeAmount.toLocaleString()} sub={`${wallet.stakeCount} tx`} />
          <Stat label="Locked" value={wallet.lockAmount.toLocaleString()} sub={`${wallet.lockCount} tx`} />
        </div>

        <div className="mt-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Transactions
          </p>
          <div className="space-y-1.5">
            {wallet.transactions.map((tx, i) => {
              const meta = TYPE_META[tx.type];
              const Icon = meta?.icon;
              return (
                <a
                  key={`${tx.hash}-${i}`}
                  href={`https://snowtrace.io/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`spotlight-tx-${i}`}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-sm hover:border-primary/40 transition-colors group"
                >
                  {Icon && <Icon size={14} className={meta.color} />}
                  <span className="capitalize text-foreground w-14">{tx.type}</span>
                  <span className="font-mono text-foreground flex-1">
                    {tx.amount.toLocaleString()} {tx.tokenSymbol ?? ""}
                  </span>
                  <span className="text-muted-foreground text-xs">{tx.date}</span>
                  <ExternalLink
                    size={12}
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </a>
              );
            })}
            {wallet.transactions.length === 0 && (
              <p className="text-sm text-muted-foreground">No transactions recorded.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-sm font-semibold ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

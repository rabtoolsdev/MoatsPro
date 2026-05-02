import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Wallet } from "lucide-react";
import type { MoatToken } from "@/lib/moat-tokens";
import { TokenLogo } from "@/components/swap/token-logo";
import type { WalletBalances } from "@/hooks/use-wallet-assets";

interface TokenSelectModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (token: MoatToken) => void;
  tokens: MoatToken[];
  excludeAddress?: string;
  title?: string;
  footerLabel?: string;
  balances?: WalletBalances;
  showBalances?: boolean;
}

function formatBalance(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(6).replace(/\.?0+$/, "");
  if (n < 1000) return n.toFixed(4).replace(/\.?0+$/, "");
  if (n < 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function TokenSelectModal({
  open,
  onClose,
  onSelect,
  tokens,
  excludeAddress,
  title = "Select a token",
  footerLabel,
  balances,
  showBalances = false,
}: TokenSelectModalProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ex = excludeAddress?.toLowerCase();
    const list = tokens.filter((t) => {
      if (ex && t.address.toLowerCase() === ex) return false;
      if (!q) return true;
      return (
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q)
      );
    });
    if (!showBalances || !balances) return list;
    // Sort: tokens with balance > 0 first (by balance desc), then alphabetical.
    return [...list].sort((a, b) => {
      const ba = balances[a.address.toLowerCase()];
      const bb = balances[b.address.toLowerCase()];
      const ha = !!ba && ba.raw > 0n;
      const hb = !!bb && bb.raw > 0n;
      if (ha && !hb) return -1;
      if (!ha && hb) return 1;
      if (ha && hb) {
        const fa = parseFloat(ba.formatted);
        const fb = parseFloat(bb.formatted);
        if (Number.isFinite(fa) && Number.isFinite(fb) && fa !== fb) return fb - fa;
      }
      return a.symbol.localeCompare(b.symbol);
    });
  }, [tokens, query, excludeAddress, balances, showBalances]);

  const heldCount = useMemo(() => {
    if (!showBalances || !balances) return 0;
    return tokens.filter((t) => {
      const b = balances[t.address.toLowerCase()];
      return !!b && b.raw > 0n;
    }).length;
  }, [tokens, balances, showBalances]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="token-select-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-background/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            data-testid="token-select-modal"
          >
            <div className="flex items-center justify-between p-4 border-b border-border/40">
              <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors"
                aria-label="Close"
                data-testid="btn-close-token-select"
              >
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="p-3 border-b border-border/40">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by symbol or address"
                  data-testid="input-token-search"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-muted/30 border border-border/50 focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/30 text-sm"
                />
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No matching tokens found.
                </div>
              ) : (
                filtered.map((token) => {
                  const bal = balances?.[token.address.toLowerCase()];
                  const heldNum = bal ? parseFloat(bal.formatted) : 0;
                  const held = !!bal && bal.raw > 0n;
                  return (
                    <button
                      key={token.address}
                      onClick={() => {
                        onSelect(token);
                        onClose();
                      }}
                      data-testid={`btn-select-token-${token.symbol}`}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
                    >
                      <TokenLogo
                        address={token.address}
                        symbol={token.symbol}
                        hint={token.logoUrl}
                        size={36}
                        className="border border-border/40"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{token.symbol}</div>
                        <div className="text-xs text-muted-foreground truncate">{token.name}</div>
                      </div>
                      {showBalances && (
                        <div
                          className={`text-right shrink-0 ${held ? "text-foreground" : "text-muted-foreground/50"}`}
                          data-testid={`text-balance-${token.symbol}`}
                        >
                          <div className="text-sm font-medium tabular-nums">
                            {held ? formatBalance(heldNum) : "—"}
                          </div>
                          {held && (
                            <div className="text-[10px] text-muted-foreground/70 flex items-center justify-end gap-0.5">
                              <Wallet size={9} />
                              <span>in wallet</span>
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-border/40 bg-muted/10 text-[10px] uppercase tracking-wider text-muted-foreground text-center">
              {showBalances && heldCount > 0
                ? `${heldCount} in wallet · ${footerLabel ?? `${tokens.length} tokens`}`
                : footerLabel ?? `${tokens.length} tokens`}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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
          className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-black/75 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md rounded-2xl border border-primary/20 bg-black/90 backdrop-blur-xl shadow-2xl shadow-black/70 overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
            data-testid="token-select-modal"
          >
            {/* Neon top accent bar */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-1 h-4 bg-primary shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
                <h3 className="text-[10px] font-mono uppercase tracking-widest text-foreground font-bold">
                  {title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg border border-transparent hover:border-primary/30 hover:bg-primary/10 hover:shadow-[0_0_10px_rgba(0,212,255,0.2)] transition-all duration-200"
                aria-label="Close"
                data-testid="btn-close-token-select"
              >
                <X size={14} className="text-muted-foreground hover:text-primary transition-colors" />
              </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-white/5">
              <div className="relative group">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-focus-within:text-primary transition-colors duration-200"
                />
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by symbol or address"
                  data-testid="input-token-search"
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-black/40 border border-white/8 focus:border-primary/50 focus:outline-none focus:shadow-[0_0_15px_rgba(0,212,255,0.15)] text-sm font-mono placeholder:text-muted-foreground/40 transition-all duration-200"
                />
              </div>
            </div>

            {/* Token list */}
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
                    No matching tokens found.
                  </p>
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
                      className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/[0.03] hover:bg-primary/5 hover:border-l-2 hover:border-l-primary/40 hover:shadow-[inset_0_0_24px_rgba(0,212,255,0.04)] transition-all duration-150 text-left group"
                    >
                      <div className="relative shrink-0">
                        <TokenLogo
                          address={token.address}
                          symbol={token.symbol}
                          hint={token.logoUrl}
                          size={36}
                          className="border border-white/10 group-hover:border-primary/30 transition-colors duration-150"
                        />
                        {held && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-black shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono font-bold group-hover:text-primary transition-colors duration-150">
                          {token.symbol}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground/60 truncate tracking-wide">
                          {token.name}
                        </div>
                      </div>
                      {showBalances && (
                        <div
                          className={`text-right shrink-0 ${held ? "text-foreground" : "text-muted-foreground/30"}`}
                          data-testid={`text-balance-${token.symbol}`}
                        >
                          <div className={`text-sm font-mono font-medium tabular-nums ${held ? "text-emerald-400" : ""}`}>
                            {held ? formatBalance(heldNum) : "—"}
                          </div>
                          {held && (
                            <div className="text-[9px] font-mono text-emerald-400/60 flex items-center justify-end gap-0.5 uppercase tracking-widest">
                              <Wallet size={8} />
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

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-white/5 bg-black/20 text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 text-center">
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

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import type { MoatToken } from "@/lib/moat-tokens";
import { TokenLogo } from "@/components/swap/token-logo";

interface TokenSelectModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (token: MoatToken) => void;
  tokens: MoatToken[];
  excludeAddress?: string;
  title?: string;
}

export function TokenSelectModal({
  open,
  onClose,
  onSelect,
  tokens,
  excludeAddress,
  title = "Select a token",
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
    return tokens.filter((t) => {
      if (ex && t.address.toLowerCase() === ex) return false;
      if (!q) return true;
      return (
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.address.toLowerCase().includes(q)
      );
    });
  }, [tokens, query, excludeAddress]);

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
                  No matching moat-backed tokens found.
                </div>
              ) : (
                filtered.map((token) => (
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
                  </button>
                ))
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-border/40 bg-muted/10 text-[10px] uppercase tracking-wider text-muted-foreground text-center">
              {tokens.length} moat-backed tokens
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

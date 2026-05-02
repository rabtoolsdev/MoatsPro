import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Settings } from "lucide-react";
import { SLIPPAGE_HIGH_THRESHOLD, SLIPPAGE_PRESETS } from "@/hooks/use-slippage";

interface SlippageSettingsProps {
  slippage: number;
  onChange: (v: number) => void;
}

function fractionToPercentString(f: number): string {
  const pct = f * 100;
  if (Math.abs(pct - Math.round(pct)) < 1e-9) return pct.toFixed(0);
  return parseFloat(pct.toFixed(3)).toString();
}

export function SlippageSettings({ slippage, onChange }: SlippageSettingsProps) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const isPreset = SLIPPAGE_PRESETS.some((p) => Math.abs(p - slippage) < 1e-9);
  const isHigh = slippage > SLIPPAGE_HIGH_THRESHOLD;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Sync custom field when popover opens with a non-preset value
  useEffect(() => {
    if (open && !isPreset) {
      setCustom(fractionToPercentString(slippage));
    } else if (open && isPreset) {
      setCustom("");
    }
  }, [open, slippage, isPreset]);

  const commitCustom = (raw: string) => {
    const cleaned = raw.replace(/,/g, ".").trim();
    setCustom(cleaned);
    if (cleaned === "" || cleaned === ".") return;
    const n = parseFloat(cleaned);
    if (!Number.isFinite(n) || n <= 0) return;
    onChange(n / 100);
  };

  const labelPct = fractionToPercentString(slippage);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="btn-slippage-settings"
        className={`flex items-center gap-1 text-[10px] rounded-md px-1.5 py-1 transition-colors ${
          isHigh
            ? "text-amber-400 bg-amber-500/10 hover:bg-amber-500/15"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        }`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {isHigh ? <AlertTriangle size={11} /> : <Settings size={11} />}
        <span data-testid="text-slippage-value">{labelPct}% slippage</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            data-testid="popover-slippage"
            className="absolute right-0 top-full mt-2 z-30 w-64 rounded-xl border border-border/70 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40 p-3"
            role="dialog"
            aria-label="Slippage settings"
          >
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
              Slippage tolerance
            </div>

            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {SLIPPAGE_PRESETS.map((p) => {
                const active = Math.abs(p - slippage) < 1e-9;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      onChange(p);
                      setCustom("");
                    }}
                    data-testid={`btn-slippage-preset-${fractionToPercentString(p)}`}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/30 text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {fractionToPercentString(p)}%
                  </button>
                );
              })}
            </div>

            <div
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors ${
                !isPreset && custom !== ""
                  ? "border-primary/60 bg-primary/5"
                  : "border-border/60 bg-muted/10"
              }`}
            >
              <span className="text-[11px] text-muted-foreground font-semibold">Custom</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.50"
                value={custom}
                onChange={(e) => {
                  const v = e.target.value.replace(/,/g, ".");
                  if (v === "" || /^[0-9]*\.?[0-9]*$/.test(v)) {
                    commitCustom(v);
                  }
                }}
                data-testid="input-slippage-custom"
                className="flex-1 min-w-0 bg-transparent text-right text-sm font-semibold focus:outline-none placeholder:text-muted-foreground/40"
              />
              <span className="text-[11px] text-muted-foreground">%</span>
            </div>

            {isHigh && (
              <div
                data-testid="warn-slippage-high"
                className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-400/95 px-2 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20"
              >
                <AlertTriangle size={12} className="mt-px shrink-0" />
                <span>This is unusually high — your trade may be front-run.</span>
              </div>
            )}

            <div className="mt-2 text-[10px] text-muted-foreground/80 leading-relaxed px-0.5">
              The maximum price movement you'll accept between quote and execution.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

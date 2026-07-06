import { useState, type FormEvent, type ReactNode } from "react";
import { Lock, Loader2, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const PASSWORD = "admin123";
const STORAGE_KEY = "moats-pro:gate-unlocked";

function isUnlocked(scope: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(`${STORAGE_KEY}:${scope}`) === "1";
  } catch {
    return false;
  }
}

function setUnlocked(scope: string) {
  try {
    window.sessionStorage.setItem(`${STORAGE_KEY}:${scope}`, "1");
  } catch {
    /* ignore */
  }
}

interface PasswordGateProps {
  scope: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function PasswordGate({ scope, title, subtitle, children }: PasswordGateProps) {
  const [unlocked, setUnlockedState] = useState(() => isUnlocked(scope));
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (unlocked) return <>{children}</>;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setTimeout(() => {
      if (value === PASSWORD) {
        setUnlocked(scope);
        setUnlockedState(true);
      } else {
        setError("Incorrect password");
        setValue("");
      }
      setSubmitting(false);
    }, 250);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background relative overflow-hidden">
      {/* cyber-grid bg */}
      <div className="cyber-grid pointer-events-none" />
      {/* ambient radial glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,hsl(195_100%_50%/0.12),transparent_70%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/5 blur-[80px]" />

      {/* scan line sweep */}
      <motion.div
        className="pointer-events-none absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent"
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-sm"
      >
        {/* bracket corner decorations */}
        <div className="pointer-events-none absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 border-primary/60" />
        <div className="pointer-events-none absolute -top-3 -right-3 w-6 h-6 border-t-2 border-r-2 border-primary/60" />
        <div className="pointer-events-none absolute -bottom-3 -left-3 w-6 h-6 border-b-2 border-l-2 border-primary/60" />
        <div className="pointer-events-none absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 border-primary/60" />

        <div className="rounded-2xl border border-primary/20 bg-black/80 backdrop-blur-2xl shadow-[0_0_60px_rgba(0,212,255,0.08)] p-6 sm:p-8">

          {/* terminal label */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            <span className="h-px flex-1 bg-primary/20" />
            <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-primary/50">
              /// secure terminal ///
            </span>
            <span className="h-px flex-1 bg-primary/20" />
          </div>

          {/* lock icon with rings */}
          <div className="relative flex items-center justify-center w-16 h-16 mx-auto mb-5">
            <motion.div
              className="absolute inset-0 rounded-full border border-primary/20"
              animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute inset-2 rounded-full border border-primary/15"
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            />
            <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 border border-primary/40 shadow-[0_0_20px_hsl(195_100%_50%/0.2)] text-primary">
              <Lock size={18} />
            </div>
          </div>

          <h1 className="text-center text-base font-black tracking-[0.12em] uppercase font-mono text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-center text-[11px] font-mono text-muted-foreground/70">
              {subtitle}
            </p>
          )}

          {/* restricted banner */}
          <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/5 border border-rose-500/20">
            <ShieldAlert size={12} className="text-rose-400 shrink-0" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-rose-400/80">
              Restricted Access · Authorised Personnel Only
            </span>
          </div>

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <div className="relative">
              <input
                type="password"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter access code"
                data-testid="input-gate-password"
                aria-label="Password"
                className={`w-full px-3.5 py-2.5 rounded-xl bg-black/50 border font-mono text-sm tracking-wider placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? "border-rose-500/50 focus:ring-rose-500/30 text-rose-300"
                    : "border-white/10 focus:border-primary/60 focus:ring-primary/20 text-foreground"
                }`}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-rose-400 px-1"
                  data-testid="text-gate-error"
                >
                  <span className="text-rose-500">▸</span>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={submitting || value.length === 0}
              data-testid="btn-gate-submit"
              className="relative w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-black text-sm font-mono tracking-widest uppercase transition-all duration-200 hover:shadow-[0_0_24px_hsl(195_100%_50%/0.45)] disabled:bg-muted/20 disabled:text-muted-foreground/40 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2 overflow-hidden group"
            >
              <span className="absolute inset-0 btn-shimmer opacity-0 group-hover:opacity-100 disabled:opacity-0" />
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? "Verifying…" : "Unlock"}
            </button>
          </form>

          <p className="mt-5 text-center text-[10px] font-mono uppercase tracking-[0.25em] text-muted-foreground/40">
            Restricted Area · Session Only
          </p>
        </div>
      </motion.div>
    </div>
  );
}

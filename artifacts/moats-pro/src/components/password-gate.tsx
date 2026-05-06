import { useState, type FormEvent, type ReactNode } from "react";
import { Lock, Loader2 } from "lucide-react";

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
    // Tiny delay so the spinner is perceptible and brute-force feels slow.
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
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-2xl shadow-black/40 p-6 sm:p-7">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 border border-primary/30 text-primary">
            <Lock size={18} />
          </div>
          <h1 className="text-center text-lg font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1.5 text-center text-xs text-muted-foreground">{subtitle}</p>
          )}

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <input
              type="password"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Password"
              data-testid="input-gate-password"
              aria-label="Password"
              className={`w-full px-3.5 py-2.5 rounded-xl bg-muted/20 border text-sm focus:outline-none focus:ring-2 transition-all ${
                error
                  ? "border-rose-500/50 focus:ring-rose-500/30"
                  : "border-border/60 focus:border-primary/60 focus:ring-primary/30"
              }`}
            />
            {error && (
              <div
                className="text-[11px] text-rose-400 px-1"
                data-testid="text-gate-error"
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || value.length === 0}
              data-testid="btn-gate-submit"
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(0,212,255,0.35)] disabled:bg-muted/40 disabled:text-muted-foreground disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Unlock
            </button>
          </form>

          <p className="mt-4 text-center text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Restricted area · Session only
          </p>
        </div>
      </div>
    </div>
  );
}

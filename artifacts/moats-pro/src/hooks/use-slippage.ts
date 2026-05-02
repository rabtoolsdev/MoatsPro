import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "moats-pro:slippage";
const DEFAULT_SLIPPAGE_FRACTION = 0.005;
const MIN_SLIPPAGE_FRACTION = 0.0001;
const MAX_SLIPPAGE_FRACTION = 0.5;

function clamp(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_SLIPPAGE_FRACTION;
  return Math.min(MAX_SLIPPAGE_FRACTION, Math.max(MIN_SLIPPAGE_FRACTION, v));
}

function readStored(): number {
  if (typeof window === "undefined") return DEFAULT_SLIPPAGE_FRACTION;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SLIPPAGE_FRACTION;
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return DEFAULT_SLIPPAGE_FRACTION;
    return clamp(n);
  } catch {
    return DEFAULT_SLIPPAGE_FRACTION;
  }
}

export function useSlippage() {
  const [slippage, setSlippageState] = useState<number>(DEFAULT_SLIPPAGE_FRACTION);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSlippageState(readStored());
    setHydrated(true);
  }, []);

  const setSlippage = useCallback((next: number) => {
    const clamped = clamp(next);
    setSlippageState(clamped);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, []);

  return { slippage, setSlippage, hydrated };
}

export const SLIPPAGE_PRESETS = [0.001, 0.005, 0.01] as const;
export const SLIPPAGE_HIGH_THRESHOLD = 0.05;

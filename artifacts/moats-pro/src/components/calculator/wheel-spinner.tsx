import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Sparkles, Copy, Check, Star, RotateCcw } from "lucide-react";
import { SiX } from "react-icons/si";
import confetti from "canvas-confetti";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface WalletResult {
  address: string;
  entries: number;
  tokenSymbol?: string;
  totalAmount?: number;
}

interface WheelSpinnerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: WalletResult[];
  winnerCount?: number;
}

const SEGMENT_COLORS = [
  "hsl(210, 95%, 58%)", "hsl(270, 65%, 55%)", "hsl(142, 70%, 45%)",
  "hsl(38, 92%, 50%)", "hsl(0, 72%, 55%)", "hsl(190, 80%, 45%)",
  "hsl(330, 70%, 55%)", "hsl(50, 90%, 50%)", "hsl(160, 60%, 45%)",
  "hsl(280, 50%, 60%)", "hsl(20, 85%, 55%)", "hsl(200, 75%, 50%)",
];
const TICK_COUNT = 60;

function fireConfetti() {
  const duration = 2500;
  const end = Date.now() + duration;
  const frame = () => {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: ["#fbbf24", "#f59e0b", "#eab308", "#3b82f6", "#8b5cf6"] });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: ["#fbbf24", "#f59e0b", "#eab308", "#3b82f6", "#8b5cf6"] });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
  confetti({ particleCount: 80, spread: 100, origin: { x: 0.5, y: 0.5 }, colors: ["#fbbf24", "#f59e0b", "#eab308", "#3b82f6", "#8b5cf6", "#10b981"] });
}

function SegmentedWheel({ segments, rotation, spinning, phase }: {
  segments: { address: string; entries: number; fraction: number }[];
  rotation: number;
  spinning: boolean;
  phase: "idle" | "fast" | "slowing" | "done";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(280);
  const center = size / 2;
  const radius = size / 2 - 12;
  useEffect(() => {
    const updateSize = () => setSize(window.innerWidth < 480 ? 220 : 280);
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);
    let startAngle = -Math.PI / 2;
    segments.forEach((seg, i) => {
      const sliceAngle = seg.fraction * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (sliceAngle > 0.15) {
        const midAngle = startAngle + sliceAngle / 2;
        const lx = center + Math.cos(midAngle) * radius * 0.7;
        const ly = center + Math.sin(midAngle) * radius * 0.7;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(midAngle + Math.PI / 2);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(seg.address.slice(0, 4) + ".." + seg.address.slice(-3), 0, 0);
        ctx.restore();
      }
      startAngle = endAngle;
    });
    const tickRadius = radius + 4;
    for (let i = 0; i < TICK_COUNT; i++) {
      const angle = (i / TICK_COUNT) * Math.PI * 2 - Math.PI / 2;
      const isMajor = i % 5 === 0;
      const innerR = isMajor ? tickRadius - 6 : tickRadius - 3;
      ctx.beginPath();
      ctx.moveTo(center + Math.cos(angle) * innerR, center + Math.sin(angle) * innerR);
      ctx.lineTo(center + Math.cos(angle) * tickRadius, center + Math.sin(angle) * tickRadius);
      ctx.strokeStyle = isMajor ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.25)";
      ctx.lineWidth = isMajor ? 2 : 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(center, center, 28, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, 28);
    gradient.addColorStop(0, "hsl(220, 15%, 20%)");
    gradient.addColorStop(1, "hsl(220, 15%, 10%)");
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPIN", center, center);
  }, [segments, size, center, radius]);
  const getTransitionConfig = () => {
    if (phase === "fast") return { duration: 2, ease: [0.2, 0.8, 0.4, 1] as [number, number, number, number] };
    if (phase === "slowing") return { duration: 3, ease: [0.1, 0.3, 0.15, 1] as [number, number, number, number] };
    if (phase === "done") return { duration: 0.5, ease: "easeOut" as const };
    return { duration: 0, ease: "linear" as const };
  };
  const transitionConfig = getTransitionConfig();
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <motion.div
        className="absolute inset-[-6px] rounded-full"
        animate={{
          boxShadow: spinning
            ? ["0 0 20px 2px hsl(210,95%,58%,0.2)", "0 0 50px 8px hsl(210,95%,58%,0.6)", "0 0 20px 2px hsl(210,95%,58%,0.2)"]
            : "0 0 15px 1px hsl(210,95%,58%,0.15)",
        }}
        transition={spinning ? { duration: 0.8, repeat: Infinity, ease: "easeInOut" } : { duration: 0.6 }}
      />
      <motion.div className="absolute inset-0" animate={{ rotate: rotation }} transition={{ duration: transitionConfig.duration, ease: transitionConfig.ease }}>
        <canvas ref={canvasRef} style={{ width: size, height: size }} className="rounded-full" />
      </motion.div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
        <motion.div animate={spinning ? { y: [0, -3, 0], scaleY: [1, 1.1, 1] } : { y: 0, scaleY: 1 }} transition={spinning ? { duration: 0.15, repeat: Infinity } : { duration: 0.3 }}>
          <div className="w-0 h-0" style={{ borderLeft: "12px solid transparent", borderRight: "12px solid transparent", borderTop: "22px solid hsl(0,72%,51%)", filter: spinning ? "drop-shadow(0 3px 8px rgba(239,68,68,0.7))" : "drop-shadow(0 2px 4px rgba(239,68,68,0.5))" }} />
        </motion.div>
      </div>
    </div>
  );
}

export default function WheelSpinner({ open, onOpenChange, results, winnerCount = 1 }: WheelSpinnerProps) {
  const [spinning, setSpinning] = useState(false);
  const [winners, setWinners] = useState<WalletResult[]>([]);
  const [revealedWinners, setRevealedWinners] = useState<WalletResult[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [phase, setPhase] = useState<"idle" | "fast" | "slowing" | "done">("idle");
  const [resetting, setResetting] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const addTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);
  const segments = useMemo(() => {
    const totalEntries = results.reduce((sum, r) => sum + r.entries, 0);
    if (totalEntries === 0) return results.map((r) => ({ ...r, fraction: 1 / Math.max(results.length, 1) }));
    return results.map((r) => ({ ...r, fraction: r.entries / totalEntries }));
  }, [results]);
  const selectWinners = useCallback((count: number): WalletResult[] => {
    const selected: WalletResult[] = [];
    const usedAddresses = new Set<string>();
    for (let i = 0; i < count; i++) {
      const remaining = results.filter((r) => !usedAddresses.has(r.address));
      if (remaining.length === 0) break;
      const remainingTotal = remaining.reduce((sum, r) => sum + r.entries, 0);
      if (remainingTotal === 0) {
        const idx = Math.floor(Math.random() * remaining.length);
        selected.push(remaining[idx]);
        usedAddresses.add(remaining[idx].address);
        continue;
      }
      const random = Math.random() * remainingTotal;
      let cumulative = 0;
      let pick = remaining[remaining.length - 1];
      for (const result of remaining) {
        cumulative += result.entries;
        if (random <= cumulative) { pick = result; break; }
      }
      selected.push(pick);
      usedAddresses.add(pick.address);
    }
    return selected;
  }, [results]);
  const spinWheel = () => {
    if (segments.length === 0) return;
    const selected = selectWinners(winnerCount);
    if (selected.length === 0) return;
    clearTimers();
    setSpinning(true);
    setWinners([]);
    setRevealedWinners([]);
    setPhase("fast");
    const spins = 5 + Math.random() * 2;
    const midRotation = rotation + spins * 360 * 0.6;
    setRotation(midRotation);
    addTimer(() => {
      setPhase("slowing");
      const primaryWinner = selected[0];
      let cumulativeFraction = 0;
      let winnerMidAngle = 0;
      let found = false;
      for (const seg of segments) {
        if (seg.address === primaryWinner.address) { winnerMidAngle = (cumulativeFraction + seg.fraction / 2) * 360; found = true; break; }
        cumulativeFraction += seg.fraction;
      }
      let finalRotation: number;
      if (found) {
        const targetRemainder = (360 - (winnerMidAngle % 360) + 360) % 360;
        const currentRemainder = ((midRotation % 360) + 360) % 360;
        let forwardAdjustment = targetRemainder - currentRemainder;
        if (forwardAdjustment < 0) forwardAdjustment += 360;
        const extraSpins = Math.max(2, Math.ceil(spins * 0.4));
        finalRotation = midRotation + extraSpins * 360 + forwardAdjustment;
      } else {
        finalRotation = midRotation + spins * 360 * 0.4 + Math.random() * 360;
      }
      setRotation(finalRotation);
    }, 1800);
    addTimer(() => {
      setWinners(selected);
      setSpinning(false);
      setPhase("done");
      fireConfetti();
      selected.forEach((winner, index) => {
        addTimer(() => setRevealedWinners((prev) => [...prev, winner]), index * 600);
      });
    }, 4800);
  };
  const copyAddress = async (address: string, index: number) => {
    await navigator.clipboard.writeText(address);
    setCopiedIndex(index);
    addTimer(() => setCopiedIndex(null), 2000);
  };
  const shareOnX = () => {
    const totalEntries = results.reduce((sum, r) => sum + r.entries, 0);
    const shortAddr = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;
    const winnerLines = winners.map((w, i) => {
      const pct = totalEntries > 0 ? ((w.entries / totalEntries) * 100).toFixed(2) : "0.00";
      return `#${i + 1} ${shortAddr(w.address)}\n${w.entries.toLocaleString()} entries (${pct}% chance)`;
    }).join("\n\n");
    const text = `🏆 ${winners.length === 1 ? "Winner" : "Winners"} selected on Moat Calculator!\n\n${winnerLines}\n\nTotal pool: ${totalEntries.toLocaleString()} entries`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };
  const reset = () => {
    clearTimers();
    setResetting(true);
    addTimer(() => { setWinners([]); setRevealedWinners([]); setRotation(0); setCopiedIndex(null); setPhase("idle"); setResetting(false); }, 400);
  };
  useEffect(() => {
    if (!open) { clearTimers(); setSpinning(false); setWinners([]); setRevealedWinners([]); setRotation(0); setCopiedIndex(null); setPhase("idle"); setResetting(false); }
  }, [open, clearTimers]);
  const totalEntries = results.reduce((sum, r) => sum + r.entries, 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Winner Selection
          </DialogTitle>
          <DialogDescription>
            Selecting {winnerCount} winner{winnerCount > 1 ? "s" : ""} from {totalEntries.toLocaleString()} total entries
          </DialogDescription>
        </DialogHeader>
        <motion.div className="flex flex-col items-center gap-6 py-4" animate={resetting ? { opacity: 0, scale: 0.95 } : { opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <SegmentedWheel segments={segments} rotation={rotation} spinning={spinning} phase={phase} />
          <AnimatePresence mode="wait">
            {revealedWinners.length > 0 && !spinning && (
              <motion.div initial={{ opacity: 0, scale: 0.6, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="text-center space-y-3 w-full">
                <div className="flex items-center justify-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  <h3 className="text-lg font-bold" style={{ background: "linear-gradient(135deg,#fbbf24,#f59e0b,#d97706)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {winners.length === 1 ? "Winner Selected!" : `${winners.length} Winners Selected!`}
                  </h3>
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {revealedWinners.map((w, index) => (
                    <motion.div key={w.address} initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 250, damping: 18 }} className="p-3 rounded-md bg-card border space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">#{index + 1}</span>
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <span className="font-mono text-sm break-all text-foreground">{w.address}</span>
                          <Button variant="ghost" size="icon" onClick={() => copyAddress(w.address, index)}>
                            {copiedIndex === index ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-center gap-4 text-xs">
                        <div className="text-muted-foreground"><span className="font-semibold text-foreground">{w.entries.toLocaleString()}</span> entries</div>
                        <div className="text-muted-foreground"><span className="font-semibold text-foreground">{totalEntries > 0 ? ((w.entries / totalEntries) * 100).toFixed(2) : "0.00"}%</span> chance</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                {revealedWinners.length === winners.length && winners.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    <Button variant="outline" className="w-full gap-2" onClick={shareOnX}>
                      <SiX className="h-3.5 w-3.5" />
                      Share on X
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3 w-full">
            {!spinning && winners.length === 0 && !resetting && (
              <Button onClick={spinWheel} disabled={results.length === 0} className="w-full flex-1" size="lg">
                <Sparkles className="mr-2 h-4 w-4" />
                {results.length === 0 ? "No wallets to spin" : "Spin the Wheel"}
              </Button>
            )}
            {spinning && (
              <Button disabled className="flex-1" size="lg">
                <motion.div className="h-4 w-4 rounded-full border-2 border-primary-foreground border-t-transparent mr-2" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
                Selecting Winner...
              </Button>
            )}
            {!spinning && winners.length > 0 && (
              <Button variant="outline" onClick={reset} className="flex-1 gap-2" size="lg">
                <RotateCcw className="h-4 w-4" />
                Spin Again
              </Button>
            )}
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

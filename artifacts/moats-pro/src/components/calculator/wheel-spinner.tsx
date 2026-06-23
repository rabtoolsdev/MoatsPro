import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalculatorWalletResult } from "@/lib/moats-api";

interface WheelSpinnerProps {
  wallets: CalculatorWalletResult[];
}

const SEGMENT_COLORS = [
  "#00d4ff",
  "#7c3aed",
  "#06b6d4",
  "#3b82f6",
  "#0ea5e9",
  "#8b5cf6",
  "#2563eb",
  "#22d3ee",
];

const short = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

export function WheelSpinner({ wallets }: WheelSpinnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const animRef = useRef<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<CalculatorWalletResult | null>(null);

  // Weight each wallet by its number of entries — more entries, bigger slice.
  const pool = wallets.filter((w) => w.entries > 0);

  const draw = (rotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;

    ctx.clearRect(0, 0, size, size);
    if (pool.length === 0) return;

    const totalEntries = pool.reduce((s, w) => s + w.entries, 0);
    let start = rotation;

    pool.forEach((w, i) => {
      const slice = (w.entries / totalEntries) * Math.PI * 2;
      const end = start + slice;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      if (slice > 0.18) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + slice / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#0a0a0a";
        ctx.font = "600 11px ui-monospace, monospace";
        ctx.fillText(short(w.address), radius - 12, 4);
        ctx.restore();
      }
      start = end;
    });

    // Center hub
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = "#0b0f17";
    ctx.fill();
    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  useEffect(() => {
    draw(rotationRef.current);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets]);

  const pickWeightedIndex = () => {
    const total = pool.reduce((s, w) => s + w.entries, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].entries;
      if (r <= 0) return i;
    }
    return pool.length - 1;
  };

  const spin = () => {
    if (spinning || pool.length === 0) return;
    setSpinning(true);
    setWinner(null);

    const totalEntries = pool.reduce((s, w) => s + w.entries, 0);
    const winnerIndex = pickWeightedIndex();

    // Angle of the middle of the winning slice.
    let acc = 0;
    for (let i = 0; i < winnerIndex; i++) acc += pool[i].entries;
    const sliceMid =
      ((acc + pool[winnerIndex].entries / 2) / totalEntries) * Math.PI * 2;

    // Pointer sits at the top (-90°). Solve for final rotation so the slice
    // mid lands under the pointer, plus several full turns.
    const pointer = -Math.PI / 2;
    const turns = 6 + Math.floor(Math.random() * 3);
    const target =
      turns * Math.PI * 2 + (pointer - sliceMid) - (rotationRef.current % (Math.PI * 2));

    const startRot = rotationRef.current;
    const duration = 4200;
    const startTime = performance.now();

    const animate = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      rotationRef.current = startRot + target * eased;
      draw(rotationRef.current);
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setSpinning(false);
        setWinner(pool[winnerIndex]);
        confetti({
          particleCount: 140,
          spread: 80,
          origin: { y: 0.4 },
          colors: SEGMENT_COLORS,
        });
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  if (pool.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No eligible wallets to spin yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        {/* Pointer */}
        <div className="absolute left-1/2 -top-1 -translate-x-1/2 z-10">
          <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-primary drop-shadow-[0_0_6px_rgba(0,212,255,0.6)]" />
        </div>
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          data-testid="wheel-canvas"
          className="rounded-full"
        />
      </div>

      <Button
        onClick={spin}
        disabled={spinning}
        data-testid="button-spin"
        className="gap-2 btn-shimmer"
      >
        <Trophy size={16} />
        {spinning ? "Spinning…" : "Spin the Wheel"}
      </Button>

      {winner && (
        <div
          data-testid="wheel-winner"
          className="w-full rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-center"
        >
          <p className="text-[11px] uppercase tracking-wider text-primary/80">
            Winner
          </p>
          <p className="font-mono text-sm text-foreground break-all">
            {winner.address}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {winner.entries.toLocaleString()} entries
          </p>
        </div>
      )}
    </div>
  );
}

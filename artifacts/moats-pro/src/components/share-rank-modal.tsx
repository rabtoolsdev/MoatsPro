import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Twitter, Copy, Check } from "lucide-react";

interface ShareRankModalProps {
  open: boolean;
  onClose: () => void;
  rank: number;
  totalUsers: number;
  username: string | null;
  address: string;
  points: number;
  weightPct: number;
}

const W = 1200;
const H = 675;

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtWeight(pct: number): string {
  if (pct >= 10) return `${pct.toFixed(1)}%`;
  if (pct >= 1) return `${pct.toFixed(2)}%`;
  if (pct >= 0.01) return `${pct.toFixed(2)}%`;
  return `<0.01%`;
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  data: {
    rank: number;
    totalUsers: number;
    handle: string;
    sub: string;
    points: number;
    weightPct: number;
  },
) {
  // Background gradient — dark navy with cyan glow
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#020617");
  bg.addColorStop(1, "#0a1929");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Cyan glow orb top-right
  const glow1 = ctx.createRadialGradient(W * 0.85, H * 0.15, 0, W * 0.85, H * 0.15, 480);
  glow1.addColorStop(0, "rgba(0,212,255,0.22)");
  glow1.addColorStop(1, "rgba(0,212,255,0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);

  // Amber glow orb bottom-left
  const glow2 = ctx.createRadialGradient(W * 0.1, H * 0.85, 0, W * 0.1, H * 0.85, 420);
  glow2.addColorStop(0, "rgba(251,191,36,0.16)");
  glow2.addColorStop(1, "rgba(251,191,36,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // Card border
  ctx.strokeStyle = "rgba(0,212,255,0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  // Top-left brand
  ctx.fillStyle = "#00d4ff";
  ctx.font = "700 28px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("THE MOATS PRO", 80, 100);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 18px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("MAPS Leaderboard", 80, 128);

  // Big rank number
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 64px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Rank", 80, 240);

  // The rank itself — gold/silver/bronze/cyan
  let rankColor = "#00d4ff";
  if (data.rank === 1) rankColor = "#fbbf24";
  else if (data.rank === 2) rankColor = "#d4d4d8";
  else if (data.rank === 3) rankColor = "#d97706";

  ctx.fillStyle = rankColor;
  ctx.font = "900 200px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(`#${data.rank}`, 80, 420);

  // "of N" subtitle
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "500 24px system-ui, -apple-system, Segoe UI, sans-serif";
  const rankWidth = ctx.measureText(`#${data.rank}`).width;
  ctx.fillText(
    `of ${data.totalUsers.toLocaleString()}`,
    80,
    460,
  );

  // Handle / address — bottom of card
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 36px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(data.handle, 80, 540);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "500 22px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(data.sub, 80, 575);

  // Right side stats panel
  const panelX = W - 460;
  const panelY = 200;
  const panelW = 380;
  const panelH = 320;

  // Panel background
  ctx.fillStyle = "rgba(15,23,42,0.7)";
  ctx.beginPath();
  ctx.roundRect(panelX, panelY, panelW, panelH, 24);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,212,255,0.3)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // MAPS Points
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 16px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("MAPS POINTS", panelX + 32, panelY + 56);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 56px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(data.points.toLocaleString(), panelX + 32, panelY + 116);

  // Divider
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(panelX + 32, panelY + 152, panelW - 64, 1);

  // Weight %
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 16px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("WEIGHT", panelX + 32, panelY + 196);

  ctx.fillStyle = "#00d4ff";
  ctx.font = "800 56px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(fmtWeight(data.weightPct), panelX + 32, panelY + 256);

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "500 18px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("of total MAPS supply", panelX + 32, panelY + 286);

  // Footer URL
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "500 18px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("themoats.pro", W - 80, H - 60);

  // Bottom accent line
  const accent = ctx.createLinearGradient(80, 0, W - 80, 0);
  accent.addColorStop(0, "rgba(0,212,255,0)");
  accent.addColorStop(0.5, "rgba(0,212,255,0.6)");
  accent.addColorStop(1, "rgba(0,212,255,0)");
  ctx.fillStyle = accent;
  ctx.fillRect(80, H - 100, W - 160, 2);
}

export function ShareRankModal({
  open,
  onClose,
  rank,
  totalUsers,
  username,
  address,
  points,
  weightPct,
}: ShareRankModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dataUrl, setDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const handle = username && !username.startsWith("0x") ? username : shortAddr(address);
  const sub = username && !username.startsWith("0x") ? shortAddr(address) : "";

  useEffect(() => {
    if (!open) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawCard(ctx, { rank, totalUsers, handle, sub, points, weightPct });
    setDataUrl(c.toDataURL("image/png"));
  }, [open, rank, totalUsers, handle, sub, points, weightPct]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `moats-rank-${rank}-${address.slice(2, 8)}.png`;
    a.click();
  };

  const tweetText = `I'm ranked #${rank} on the Moats Pro MAPS leaderboard with ${points.toLocaleString()} points (${fmtWeight(
    weightPct,
  )} weight).\n\nStake. Lock. Burn. Earn.`;

  const handleTweet = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      tweetText,
    )}&url=${encodeURIComponent("https://themoats.pro")}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleCopyImage = async () => {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-2 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <div className="p-5 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold mb-1">Share your rank</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                A clean preview card you can post or download.
              </p>

              <div className="rounded-xl overflow-hidden border border-border/60 bg-background/40">
                {/* Canvas is drawn at 1200x675; we display it responsively */}
                <canvas
                  ref={canvasRef}
                  width={W}
                  height={H}
                  className="w-full h-auto block"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleTweet}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all hover:shadow-[0_0_16px_rgba(0,212,255,0.4)]"
                >
                  <Twitter size={15} />
                  Post on X
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-muted/20 text-foreground text-sm font-medium hover:bg-muted/40 transition-colors"
                >
                  <Download size={15} />
                  Download PNG
                </button>
                <button
                  onClick={handleCopyImage}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-muted/20 text-foreground text-sm font-medium hover:bg-muted/40 transition-colors"
                >
                  {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  {copied ? "Copied" : "Copy image"}
                </button>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                Tip: clicking <span className="text-foreground font-medium">Post on X</span>{" "}
                opens X with the message pre-filled. Use{" "}
                <span className="text-foreground font-medium">Copy image</span> or{" "}
                <span className="text-foreground font-medium">Download PNG</span> to attach
                the card to your post.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

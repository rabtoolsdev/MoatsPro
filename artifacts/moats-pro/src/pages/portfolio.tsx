import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, Zap, Award, AlertCircle } from "lucide-react";
import { useAllMoatPoints, useMapsScore } from "@/hooks/use-moats-api";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { formatPoints, formatAddress } from "@/lib/moat-metadata";

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const { data: allPoints, isLoading } = useAllMoatPoints();
  const { data: mapsScore } = useMapsScore(address);

  const userPoints = allPoints?.filter(
    (p) => p.walletAddress.toLowerCase() === address?.toLowerCase()
  ) || [];

  const totalPoints = userPoints.reduce((sum, p) => sum + p.points, 0);
  const uniqueMoats = new Set(userPoints.map((p) => p.contractAddress)).size;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 pt-28 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2">Portfolio</h1>
          <p className="text-muted-foreground">
            {isConnected && address
              ? `Viewing positions for ${formatAddress(address)}`
              : "Connect your wallet to view your positions"}
          </p>
        </motion.div>

        {!isConnected ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-border bg-card/30 p-16 text-center"
            data-testid="wallet-connect-prompt"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Wallet size={28} className="text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Connect Your Wallet</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Connect your wallet to view your Moats positions, points earned,
              and MAPS score across all active Moats.
            </p>
            <w3m-button />
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  label: "Total Points",
                  value: formatPoints(totalPoints),
                  icon: Zap,
                  color: "text-primary",
                  bg: "bg-primary/10",
                  testId: "stat-total-points",
                },
                {
                  label: "Active Moats",
                  value: uniqueMoats.toLocaleString(),
                  icon: TrendingUp,
                  color: "text-cyan-400",
                  bg: "bg-cyan-400/10",
                  testId: "stat-active-moats",
                },
                {
                  label: "MAPS Score",
                  value: mapsScore?.score
                    ? mapsScore.score.toLocaleString()
                    : "—",
                  icon: Award,
                  color: "text-violet-400",
                  bg: "bg-violet-400/10",
                  testId: "stat-maps-score",
                },
              ].map((card, i) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  data-testid={card.testId}
                  className="rounded-2xl border border-border bg-card/30 p-6 flex items-center gap-4"
                >
                  <div className={`p-3 rounded-xl ${card.bg} shrink-0`}>
                    <card.icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-3xl font-bold tabular-nums">
                      {card.value}
                    </p>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Position Table */}
            <div className="rounded-2xl border border-border bg-card/30 backdrop-blur-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
                <h2 className="font-semibold">Your Positions</h2>
                <span className="text-sm text-muted-foreground">
                  {userPoints.length} position{userPoints.length !== 1 ? "s" : ""}
                </span>
              </div>

              {isLoading ? (
                <div className="p-8 space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="h-16 rounded-xl bg-muted/30 animate-pulse"
                    />
                  ))}
                </div>
              ) : userPoints.length === 0 ? (
                <div className="p-16 text-center text-muted-foreground">
                  <AlertCircle
                    size={40}
                    className="mx-auto mb-3 opacity-30"
                  />
                  <p className="font-medium">No positions found</p>
                  <p className="text-sm mt-1">
                    Visit a Moat to stake and start earning points
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  <div className="px-6 py-3 grid grid-cols-12 gap-4 text-xs text-muted-foreground font-medium">
                    <span className="col-span-5">Contract</span>
                    <span className="col-span-4">Points Earned</span>
                    <span className="col-span-3 text-right">Last Updated</span>
                  </div>
                  {userPoints.map((position, i) => (
                    <motion.div
                      key={position.contractAddress}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.04 }}
                      data-testid={`row-position-${i}`}
                      className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-muted/20 transition-colors"
                    >
                      <span className="col-span-5 font-mono text-sm">
                        {formatAddress(position.contractAddress)}
                      </span>
                      <span className="col-span-4 font-bold text-primary">
                        {formatPoints(position.points)}
                      </span>
                      <span className="col-span-3 text-right text-xs text-muted-foreground">
                        {new Date(
                          position.lastUpdated > 1e12
                            ? position.lastUpdated
                            : position.lastUpdated * 1000
                        ).toLocaleDateString()}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

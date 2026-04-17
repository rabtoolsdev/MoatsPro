import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { Wallet, TrendingUp, Award, AlertCircle } from "lucide-react";
import { useMapsScore, useAllMoatConfigs } from "@/hooks/use-moats-api";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { formatAddress } from "@/lib/moat-metadata";
import { MoatCard } from "@/components/moat-card";

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const { data: mapsScore, isLoading: scoreLoading } = useMapsScore(address);
  const { data: configs, isLoading: configsLoading } = useAllMoatConfigs();

  const verifiedMoats = configs?.filter((c) => c.status === "Verified") || [];

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
              Connect your wallet to view your Moats positions and MAPS score.
            </p>
            <w3m-button />
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* MAPS Score Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                data-testid="stat-maps-score"
                className="rounded-2xl border border-border bg-card/30 p-6 flex items-center gap-4"
              >
                <div className="p-3 rounded-xl bg-violet-400/10 shrink-0">
                  <Award className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <p className="text-3xl font-bold tabular-nums">
                    {scoreLoading
                      ? "..."
                      : mapsScore?.points
                      ? mapsScore.points.toLocaleString()
                      : "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">MAPS Score</p>
                  {mapsScore?.rank && (
                    <p className="text-xs text-primary mt-0.5">Rank #{mapsScore.rank}</p>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                data-testid="stat-active-moats"
                className="rounded-2xl border border-border bg-card/30 p-6 flex items-center gap-4"
              >
                <div className="p-3 rounded-xl bg-cyan-400/10 shrink-0">
                  <TrendingUp className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <p className="text-3xl font-bold tabular-nums">
                    {configsLoading ? "..." : (configs?.length || 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Available Moats</p>
                </div>
              </motion.div>
            </div>

            {/* Alert if no MAPS score */}
            {!scoreLoading && !mapsScore && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
                <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-400">No MAPS Score Found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your wallet hasn't earned MAPS points yet. Stake or interact with a Moat
                    below to start earning points and appear on the leaderboard.
                  </p>
                </div>
              </div>
            )}

            {/* Explore Moats to interact with */}
            <div>
              <h2 className="text-xl font-bold mb-4">Verified Moats</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Connect to any Moat below to stake tokens and start earning rewards and points.
              </p>
              {configsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-52 rounded-2xl bg-card/50 animate-pulse border border-border" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {verifiedMoats.slice(0, 6).map((moat) => (
                    <MoatCard key={moat.contractAddress} moat={moat} />
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

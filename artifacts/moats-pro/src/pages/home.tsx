import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useAllMoatConfigs, useMapsLeaderboard, useEvents } from "@/hooks/use-moats-api";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { MoatCard } from "@/components/moat-card";
import { StatsBar } from "@/components/stats-bar";
import { ActivityFeed } from "@/components/activity-feed";

export default function Home() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: configs, isLoading: configsLoading } = useAllMoatConfigs();
  const { data: leaderboard } = useMapsLeaderboard();
  const { data: eventsData } = useEvents();

  const statusOptions = configs
    ? ["all", ...new Set(configs.map((c) => c.status))]
    : ["all"];

  const filteredMoats =
    statusFilter === "all"
      ? (configs || [])
      : (configs || []).filter((c) => c.status === statusFilter);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
          <div className="absolute top-20 right-1/4 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-[80px]" />
        </div>
        <div className="max-w-5xl mx-auto text-center relative">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Live on Avalanche, Ethereum & More
            </span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
          >
            <span className="text-foreground">Earn with </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-400">
              Moats Pro
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            Stake, lock, and earn real yield from the most powerful DeFi liquidity
            positions. Premium analytics. On-chain forever.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <w3m-button />
            <Link
              href="/leaderboard"
              data-testid="btn-leaderboard"
              className="px-8 py-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-foreground font-medium"
            >
              View Leaderboard
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <StatsBar moatConfigs={configs} leaderboard={leaderboard} />

      {/* Moats Grid */}
      <section className="flex-1 px-4 py-16 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold" data-testid="section-moats">Active Moats</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {filteredMoats.length} active{" "}
              {filteredMoats.length === 1 ? "moat" : "moats"}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {statusOptions.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                data-testid={`filter-${status}`}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${
                  statusFilter === status
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {configsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-72 rounded-2xl bg-card/50 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : filteredMoats.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">No Moats found</p>
            <p className="text-sm mt-2">
              Check back soon or connect your wallet to explore positions
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredMoats.map((moat) => (
              <motion.div key={moat.contractAddress} variants={itemVariants}>
                <MoatCard moat={moat} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>

      {/* Activity Feed */}
      {eventsData && eventsData.results.length > 0 && (
        <section className="px-4 py-12 max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Recent Activity</h2>
            <span className="text-sm text-muted-foreground">
              {eventsData.total.toLocaleString()} total events
            </span>
          </div>
          <ActivityFeed events={eventsData.results.slice(0, 12)} />
        </section>
      )}

      <Footer />
    </div>
  );
}

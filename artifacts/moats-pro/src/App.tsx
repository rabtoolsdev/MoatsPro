import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import { wagmiConfig } from "@/lib/wagmi-config";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Portfolio from "@/pages/portfolio";
import MoatDetail from "@/pages/moat-detail";
import Leaderboard from "@/pages/leaderboard";
import Analytics from "@/pages/analytics";
import Swap from "@/pages/swap";
import MoatCalculator from "@/pages/moat-calculator";
import Admin from "@/pages/admin";
import { PasswordGate } from "@/components/password-gate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const pageTransition: Transition = {
  duration: 0.2,
  ease: "easeOut",
};

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [location]);
  return null;
}

function Router() {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
      >
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/portfolio" component={Portfolio} />
          <Route path="/moat/:address" component={MoatDetail} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/swap" component={Swap} />
          <Route path="/calculator" component={MoatCalculator} />
          <Route path="/admin">
            <PasswordGate scope="admin" title="Admin Console" subtitle="Enter the password to continue.">
              <Admin />
            </PasswordGate>
          </Route>
          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ScrollToTop />
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;

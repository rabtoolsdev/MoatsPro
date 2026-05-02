import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, TrendingUp, LayoutDashboard, Trophy, Wallet, ChevronDown, Check, ArrowLeftRight } from "lucide-react";
import { useAccount } from "wagmi";
import { useAppKit, useAppKitNetwork } from "@reown/appkit/react";
import { CHAIN_DISPLAY, networks } from "@/lib/wagmi-config";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { isConnected, address } = useAccount();
  const { open } = useAppKit();
  const { chainId, switchNetwork } = useAppKitNetwork();
  const currentChain =
    typeof chainId === "number" ? CHAIN_DISPLAY[chainId] : undefined;
  const [chainMenuOpen, setChainMenuOpen] = useState(false);
  const chainMenuRef = useRef<HTMLDivElement>(null);

  // Close the chain dropdown when clicking outside
  useEffect(() => {
    if (!chainMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (chainMenuRef.current && !chainMenuRef.current.contains(e.target as Node)) {
        setChainMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [chainMenuOpen]);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const links = [
    { href: "/", label: "Explore", icon: TrendingUp },
    { href: "/portfolio", label: "Portfolio", icon: LayoutDashboard },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/swap", label: "Swap", icon: ArrowLeftRight },
  ];

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";

  return (
    <header
      data-testid="navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-background/85 backdrop-blur-2xl shadow-xl shadow-black/30"
          : "bg-transparent"
      }`}
    >
      {/* Glowing bottom border on scroll */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-px transition-opacity duration-500 ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)",
        }}
      />

      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex md:grid md:grid-cols-3 items-center justify-between md:justify-stretch gap-2">
        {/* Logo */}
        <Link href="/" className="md:justify-self-start shrink-0">
          <div
            data-testid="nav-logo"
            className="flex items-center cursor-pointer group"
          >
            <div className="relative h-12 sm:h-14 md:h-20 lg:h-24 w-auto transition-transform duration-300 group-hover:scale-105">
              <div className="absolute inset-0 -m-2 rounded-full bg-primary/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <img
                src="/moats-pro-logo.png"
                alt="The Moats Pro"
                className="relative h-12 sm:h-14 md:h-20 lg:h-24 w-auto object-contain drop-shadow-[0_0_8px_rgba(0,212,255,0.15)]"
              />
            </div>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center justify-center gap-1 relative">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = location === href;
            return (
              <Link
                key={href}
                href={href}
                data-testid={`nav-${label.toLowerCase()}`}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <Icon size={15} />
                {label}
                {isActive && (
                  <motion.div
                    layoutId="nav-underline"
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary"
                    style={{ boxShadow: "0 0 8px rgba(0,212,255,0.6)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Wallet Button */}
        <div className="flex items-center md:justify-self-end gap-2 sm:gap-3 shrink-0">
          {/* Chain Selector */}
          <div ref={chainMenuRef} className="relative">
            <button
              data-testid="btn-chain-selector"
              onClick={() => setChainMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-border bg-card/40 hover:border-primary/60 hover:bg-card/70 transition-all duration-200 text-xs sm:text-sm font-medium whitespace-nowrap"
            >
              {currentChain ? (
                <>
                  <img
                    src={currentChain.logo}
                    alt={currentChain.label}
                    className="w-5 h-5 rounded-full shrink-0 object-cover"
                  />
                  <span className="hidden md:inline">{currentChain.label}</span>
                </>
              ) : (
                <span className="hidden md:inline text-muted-foreground">Select Network</span>
              )}
              <ChevronDown
                size={14}
                className={`text-muted-foreground shrink-0 transition-transform duration-200 ${
                  chainMenuOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <AnimatePresence>
              {chainMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden z-50"
                >
                  <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                    Select Network
                  </div>
                  <ul className="py-1">
                    {networks.map((n) => {
                      const display = CHAIN_DISPLAY[Number(n.id)];
                      if (!display) return null;
                      const isActive = Number(n.id) === chainId;
                      return (
                        <li key={String(n.id)}>
                          <button
                            data-testid={`chain-option-${display.network}`}
                            onClick={() => {
                              if (!isActive) switchNetwork(n);
                              setChainMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                              isActive
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-muted/40 text-foreground"
                            }`}
                          >
                            <img
                              src={display.logo}
                              alt={display.label}
                              className="w-6 h-6 rounded-full shrink-0 object-cover"
                            />
                            <span className="flex-1 text-left font-medium">
                              {display.label}
                            </span>
                            {isActive && (
                              <Check size={14} className="text-primary shrink-0" />
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {isConnected && address ? (
            <button
              data-testid="btn-wallet-connected"
              onClick={() => open({ view: "Account" })}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-all duration-200 text-xs sm:text-sm font-medium hover:shadow-[0_0_12px_rgba(0,212,255,0.2)] whitespace-nowrap"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 live-dot" />
              <Wallet size={13} className="text-primary shrink-0" />
              <span className="font-mono text-foreground">{shortAddress}</span>
            </button>
          ) : (
            <button
              data-testid="btn-wallet-connect"
              onClick={() => open({ view: "Connect" })}
              className="px-3 sm:px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-medium hover:bg-primary/90 transition-all duration-200 hover:shadow-[0_0_16px_rgba(0,212,255,0.4)] btn-shimmer whitespace-nowrap"
            >
              <span className="hidden sm:inline">Connect Wallet</span>
              <span className="sm:hidden">Connect</span>
            </button>
          )}
          <button
            className="md:hidden p-2 rounded-lg border border-border hover:border-primary/50 transition-all shrink-0"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="btn-mobile-menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-t border-border/50 glass-strong"
          >
            <nav className="px-4 py-4 flex flex-col gap-1">
              {links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    location === href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

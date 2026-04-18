import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, TrendingUp, LayoutDashboard, Trophy, Wallet } from "lucide-react";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit/react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();
  const { isConnected, address } = useAccount();
  const { open } = useAppKit();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const links = [
    { href: "/", label: "Explore", icon: TrendingUp },
    { href: "/portfolio", label: "Portfolio", icon: LayoutDashboard },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
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

      <div className="max-w-7xl mx-auto px-4 h-16 grid grid-cols-3 items-center">
        {/* Logo */}
        <Link href="/" className="justify-self-start">
          <div
            data-testid="nav-logo"
            className="flex items-center cursor-pointer group"
          >
            <div className="relative h-24 w-auto transition-transform duration-300 group-hover:scale-105">
              <div className="absolute inset-0 -m-2 rounded-full bg-primary/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <img
                src="/moats-pro-logo.png"
                alt="The Moats Pro"
                className="relative h-24 w-auto object-contain drop-shadow-[0_0_8px_rgba(0,212,255,0.15)]"
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
        <div className="flex items-center justify-self-end gap-3">
          {isConnected && address ? (
            <button
              data-testid="btn-wallet-connected"
              onClick={() => open({ view: "Account" })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-all duration-200 text-sm font-medium hover:shadow-[0_0_12px_rgba(0,212,255,0.2)]"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 live-dot" />
              <Wallet size={13} className="text-primary shrink-0" />
              <span className="font-mono text-foreground">{shortAddress}</span>
            </button>
          ) : (
            <button
              data-testid="btn-wallet-connect"
              onClick={() => open({ view: "Connect" })}
              className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-200 hover:shadow-[0_0_16px_rgba(0,212,255,0.4)] btn-shimmer"
            >
              Connect Wallet
            </button>
          )}
          <button
            className="md:hidden p-2 rounded-lg border border-border hover:border-primary/50 transition-all"
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

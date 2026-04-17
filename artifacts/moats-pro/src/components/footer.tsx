import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t border-border/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">
            Moats <span className="text-primary">Pro</span>
          </span>
          <span className="text-muted-foreground text-xs">|</span>
          <span className="text-muted-foreground text-xs">
            Premium DeFi Liquidity
          </span>
        </div>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">Explore</Link>
          <Link href="/portfolio" className="hover:text-foreground transition-colors">Portfolio</Link>
          <Link href="/leaderboard" className="hover:text-foreground transition-colors">Leaderboard</Link>
          <a
            href="https://moats.app"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            moats.app
          </a>
        </nav>
        <p className="text-muted-foreground text-xs">
          Powered by FortiFi Protocol. All on-chain.
        </p>
      </div>
    </footer>
  );
}

import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="relative border-t border-border/50 mt-auto overflow-hidden">
      {/* Subtle top glow */}
      <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      {/* Ambient glow orb */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-24 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-4 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/moats-pro-logo.png"
            alt="The Moats Pro"
            className="h-[60px] w-auto object-contain"
          />
        </div>
        <nav className="flex items-center gap-6 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground hover:text-primary transition-colors">Explore</Link>
          <Link href="/portfolio" className="hover:text-foreground hover:text-primary transition-colors">Portfolio</Link>
          <Link href="/leaderboard" className="hover:text-foreground hover:text-primary transition-colors">Leaderboard</Link>
          <a
            href="https://moats.app"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            moats.app ↗
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-xs">Powered by RABTools</p>
          <img
            src="/rabtools-logo.png"
            alt="RABtools"
            className="h-[62px] w-auto object-contain opacity-80"
          />
        </div>
      </div>
    </footer>
  );
}

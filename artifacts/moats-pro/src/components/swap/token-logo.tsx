import { useMemo, useState } from "react";

interface TokenLogoProps {
  address: string;
  symbol: string;
  hint?: string;
  size?: number;
  className?: string;
}

function buildSources(address: string, hint?: string): string[] {
  const lower = address.toLowerCase();
  const sources: string[] = [];
  if (hint) sources.push(hint);
  // DexScreener — works for most actively-traded Avalanche tokens
  sources.push(`https://dd.dexscreener.com/ds-data/tokens/avalanche/${lower}.png`);
  // TrustWallet — needs checksum address; we approximate by using lower (works for some)
  sources.push(
    `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/assets/${address}/logo.png`,
  );
  return Array.from(new Set(sources.filter(Boolean)));
}

function symbolGradient(symbol: string): string {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) % 360;
  const h2 = (h + 60) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 35%) 0%, hsl(${h2} 70% 25%) 100%)`;
}

export function TokenLogo({
  address,
  symbol,
  hint,
  size = 24,
  className,
}: TokenLogoProps) {
  const sources = useMemo(() => buildSources(address, hint), [address, hint]);
  // Reset the source index whenever the token (address/hint) changes, so a
  // newly-picked token always starts from the highest-priority source instead
  // of inheriting the previous token's failure state.
  const [prevKey, setPrevKey] = useState(`${address}|${hint ?? ""}`);
  const [idx, setIdx] = useState(0);
  const currentKey = `${address}|${hint ?? ""}`;
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setIdx(0);
  }

  const currentSrc = idx < sources.length ? sources[idx] : null;
  const showFallback = currentSrc === null;

  if (showFallback) {
    return (
      <div
        className={`rounded-full flex items-center justify-center text-white font-bold shrink-0 ${className ?? ""}`}
        style={{
          width: size,
          height: size,
          background: symbolGradient(symbol),
          fontSize: Math.max(8, Math.floor(size * 0.42)),
          letterSpacing: "-0.02em",
        }}
        aria-label={symbol}
      >
        {symbol.slice(0, Math.min(3, symbol.length)).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      key={currentSrc}
      src={currentSrc}
      alt={symbol}
      className={`rounded-full object-cover shrink-0 ${className ?? ""}`}
      style={{ width: size, height: size }}
      onError={() => setIdx((i) => i + 1)}
      loading="lazy"
    />
  );
}

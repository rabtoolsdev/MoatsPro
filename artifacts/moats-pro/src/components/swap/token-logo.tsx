import { useMemo, useState } from "react";

interface TokenLogoProps {
  address: string;
  symbol: string;
  /** Optional network slug (avalanche, ethereum, base, …). Defaults to avalanche
   * for backwards compatibility with the swap UI. */
  network?: string;
  /** Optional explicit URL to try first (highest priority). */
  hint?: string;
  size?: number;
  className?: string;
}

// Native sentinel addresses used by aggregators / Moats: 0x0…0 (most common)
// and 0xeeee…eeee (Li.Fi / 1inch convention).
const NATIVE_SENTINELS = new Set([
  "0x0000000000000000000000000000000000000000",
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
]);

// Trust Wallet's `blockchains/<folder>` for ERC20 contracts and native logos.
const TRUSTWALLET_FOLDER: Record<string, string> = {
  avalanche: "avalanchec",
  ethereum: "ethereum",
  base: "base",
  optimism: "optimism",
  arbitrum: "arbitrum",
  polygon: "polygon",
  bsc: "smartchain",
};

// DexScreener token logo CDN; covers most actively-traded ERC20s.
const DEXSCREENER_CHAIN: Record<string, string> = {
  avalanche: "avalanche",
  ethereum: "ethereum",
  base: "base",
  optimism: "optimism",
  arbitrum: "arbitrum",
  polygon: "polygon",
  bsc: "bsc",
};

// CoinGecko fallback for the most common native tokens. URLs taken from the
// public CoinGecko coin pages (large variant). These cover the chains Moats
// currently supports.
const NATIVE_COINGECKO: Record<string, string> = {
  avalanche:
    "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
  ethereum:
    "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  base: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  optimism:
    "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  arbitrum:
    "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  polygon:
    "https://assets.coingecko.com/coins/images/4713/large/polygon.png",
  bsc: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
};

function buildSources(
  address: string,
  network: string,
  hint?: string,
): string[] {
  const sources: string[] = [];
  if (hint) sources.push(hint);

  const lower = address.toLowerCase();
  const isNative = NATIVE_SENTINELS.has(lower);
  const tw = TRUSTWALLET_FOLDER[network];
  const ds = DEXSCREENER_CHAIN[network];

  if (isNative) {
    // Trust Wallet keeps the native coin logo at <chain>/info/logo.png.
    if (tw) {
      sources.push(
        `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${tw}/info/logo.png`,
      );
    }
    // CoinGecko fallback for native tokens — almost always reachable.
    const cg = NATIVE_COINGECKO[network];
    if (cg) sources.push(cg);
  } else {
    // ERC20 token: prefer DexScreener (usually has a logo), then Trust Wallet
    // (uses the original-case address). We also try the lowercase variant in
    // case the input was already checksum-cased.
    if (ds) sources.push(`https://dd.dexscreener.com/ds-data/tokens/${ds}/${lower}.png`);
    if (tw) {
      sources.push(
        `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${tw}/assets/${address}/logo.png`,
      );
      // Also try the address as-stored (not always checksum-cased).
      if (address !== lower) {
        sources.push(
          `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${tw}/assets/${lower}/logo.png`,
        );
      }
    }
  }

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
  network = "avalanche",
  hint,
  size = 24,
  className,
}: TokenLogoProps) {
  const sources = useMemo(
    () => buildSources(address, network, hint),
    [address, network, hint],
  );
  // Reset the source index whenever the token (address/hint/network) changes,
  // so a newly-picked token always starts from the highest-priority source
  // instead of inheriting the previous token's failure state.
  const cacheKey = `${address}|${network}|${hint ?? ""}`;
  const [prevKey, setPrevKey] = useState(cacheKey);
  const [idx, setIdx] = useState(0);
  if (prevKey !== cacheKey) {
    setPrevKey(cacheKey);
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

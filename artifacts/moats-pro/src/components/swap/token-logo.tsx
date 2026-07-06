import { useMemo, useState } from "react";
import { getAddress } from "viem";

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

// Brand logos for the major stablecoins / wrapped natives, keyed by uppercase
// symbol. Used as a high-priority source so popular tokens always render even
// when DexScreener / Trust Wallet don't have them indexed. URLs are CoinGecko
// (stable, well-cached).
const SYMBOL_LOGOS: Record<string, string> = {
  USDC: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  "USDC.E": "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  USDBC: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  USDT: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
  "USDT.E": "https://assets.coingecko.com/coins/images/325/large/Tether.png",
  DAI: "https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png",
  BUSD: "https://assets.coingecko.com/coins/images/9576/large/BUSD.png",
  FRAX: "https://assets.coingecko.com/coins/images/13422/large/FRAX_icon.png",
  LUSD: "https://assets.coingecko.com/coins/images/14666/large/Group_3.png",
  PYUSD: "https://assets.coingecko.com/coins/images/31212/large/PYUSD_Logo_%282%29.png",
  USDS: "https://assets.coingecko.com/coins/images/39926/large/usds.webp",
  WETH: "https://assets.coingecko.com/coins/images/2518/large/weth.png",
  WAVAX:
    "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/assets/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7/logo.png",
  WBTC: "https://assets.coingecko.com/coins/images/7598/large/wrapped_bitcoin_wbtc.png",
  // BTC.b — Avalanche-bridged Bitcoin; TrustWallet has no entry for it.
  "BTC.B": "https://assets.coingecko.com/coins/images/26115/small/btcb.png",
  BTCB: "https://assets.coingecko.com/coins/images/26115/small/btcb.png",
};

function safeChecksum(address: string): string | null {
  try {
    return getAddress(address);
  } catch {
    return null;
  }
}

function buildSources(
  address: string,
  network: string,
  symbol: string,
  hint?: string,
): string[] {
  const sources: string[] = [];
  if (hint) sources.push(hint);

  const lower = address.toLowerCase();
  const isNative = NATIVE_SENTINELS.has(lower);
  const tw = TRUSTWALLET_FOLDER[network];

  // Symbol-based brand logo (USDC, USDT, DAI, …) — highest signal for popular
  // assets and works regardless of which chain-specific path actually has the
  // asset indexed.
  const symKey = symbol.toUpperCase();
  if (SYMBOL_LOGOS[symKey]) sources.push(SYMBOL_LOGOS[symKey]);

  if (isNative) {
    // Trust Wallet keeps the native coin logo at <chain>/info/logo.png.
    if (tw) {
      sources.push(
        `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${tw}/info/logo.png`,
      );
    }
    const cg = NATIVE_COINGECKO[network];
    if (cg) sources.push(cg);
  } else if (tw) {
    // ERC20: Trust Wallet requires EIP-55 checksum casing for the asset path.
    const checksum = safeChecksum(address);
    if (checksum) {
      sources.push(
        `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${tw}/assets/${checksum}/logo.png`,
      );
    }
    // As a last-ditch try, the lowercase path (rarely works but cheap).
    sources.push(
      `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${tw}/assets/${lower}/logo.png`,
    );
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
    () => buildSources(address, network, symbol, hint),
    [address, network, symbol, hint],
  );
  const cacheKey = `${address}|${network}|${symbol}|${hint ?? ""}`;
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

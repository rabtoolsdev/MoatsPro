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

// DefiLlama token icon service chain IDs.
// URL: https://token-icons.llamao.fi/icons/tokens/{chainId}/{address_lower}?h=48&w=48
// Returns 200 image/webp for virtually every DeFi token, publicly accessible
// without authentication, with a 1-year cache. Used as a reliable fallback
// after TrustWallet to catch long-tail tokens (HEFE, BLAZE, JOE, GMX, etc.)
const LLAMA_CHAIN_ID: Record<string, number> = {
  avalanche: 43114,
  ethereum: 1,
  base: 8453,
  optimism: 10,
  arbitrum: 42161,
  polygon: 137,
  bsc: 56,
  sonic: 146,
};

// CoinGecko fallback for the most common native tokens. URLs taken from the
// public CoinGecko coin pages (large variant). These cover the chains Moats
// currently supports.
const NATIVE_COINGECKO: Record<string, string> = {
  avalanche:
    "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
  ethereum: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  base: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  optimism: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  arbitrum: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  polygon: "https://assets.coingecko.com/coins/images/4713/large/polygon.png",
  bsc: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
};

// Brand logos for the major stablecoins / wrapped natives / popular DeFi tokens,
// keyed by UPPERCASE symbol. Used as a high-priority source so popular tokens
// always render even when TrustWallet doesn't have them indexed. URLs are
// CoinGecko (stable, well-cached).
const SYMBOL_LOGOS: Record<string, string> = {
  // ── Stablecoins ──
  USDC: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  "USDC.E": "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  USDBC: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  USDT: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
  "USDT.E": "https://assets.coingecko.com/coins/images/325/large/Tether.png",
  DAI: "https://assets.coingecko.com/coins/images/9956/large/Badge_Dai.png",
  BUSD: "https://assets.coingecko.com/coins/images/9576/large/BUSD.png",
  FRAX: "https://assets.coingecko.com/coins/images/13422/large/FRAX_icon.png",
  LUSD: "https://assets.coingecko.com/coins/images/14666/large/Group_3.png",
  PYUSD:
    "https://assets.coingecko.com/coins/images/31212/large/PYUSD_Logo_%282%29.png",
  USDS: "https://assets.coingecko.com/coins/images/39926/large/usds.webp",
  CRVUSD:
    "https://assets.coingecko.com/coins/images/30118/large/crvusd.png",
  SUSD: "https://assets.coingecko.com/coins/images/5013/large/sUSD.png",
  TUSD: "https://assets.coingecko.com/coins/images/3449/large/tusd.png",

  // ── Native / Wrapped natives ──
  AVAX: "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
  WAVAX:
    "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/assets/0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7/logo.png",
  ETH: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  WETH: "https://assets.coingecko.com/coins/images/2518/large/weth.png",
  BNB: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
  WBNB: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
  MATIC: "https://assets.coingecko.com/coins/images/4713/large/polygon.png",
  WMATIC: "https://assets.coingecko.com/coins/images/4713/large/polygon.png",

  // ── Bitcoin variants ──
  WBTC: "https://assets.coingecko.com/coins/images/7598/large/wrapped_bitcoin_wbtc.png",
  // BTC.b — Avalanche-bridged Bitcoin; TrustWallet has no entry.
  "BTC.B": "https://assets.coingecko.com/coins/images/26115/small/btcb.png",
  BTCB: "https://assets.coingecko.com/coins/images/26115/small/btcb.png",
  CBBTC:
    "https://assets.coingecko.com/coins/images/40143/large/cbbtc.webp",
  TBTC: "https://assets.coingecko.com/coins/images/11224/large/0x18084fba666a33d37592fa2633fd49a74dd93a88.png",

  // ── Major DeFi / blue-chip ──
  LINK: "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png",
  AAVE: "https://assets.coingecko.com/coins/images/12645/large/AAVE.png",
  UNI: "https://assets.coingecko.com/coins/images/12504/large/uniswap-uni.png",
  SUSHI: "https://assets.coingecko.com/coins/images/12271/large/512x512_Logo_no_chop.png",
  CRV: "https://assets.coingecko.com/coins/images/12124/large/Curve.png",
  CVX: "https://assets.coingecko.com/coins/images/15585/large/convex.png",
  GMX: "https://assets.coingecko.com/coins/images/18323/large/arbit.png",
  GLP: "https://assets.coingecko.com/coins/images/23435/large/glp.png",
  SNX: "https://assets.coingecko.com/coins/images/3406/large/SNX.png",
  COMP: "https://assets.coingecko.com/coins/images/10775/large/COMP.png",
  MKR: "https://assets.coingecko.com/coins/images/1364/large/Mark_Maker.png",
  LDO: "https://assets.coingecko.com/coins/images/13573/large/Lido_DAO.png",
  RPL: "https://assets.coingecko.com/coins/images/2090/large/rocket_pool_%28RPL%29.png",
  BAL: "https://assets.coingecko.com/coins/images/11683/large/Balancer.png",
  "1INCH": "https://assets.coingecko.com/coins/images/13469/large/1inch-token.png",
  OP: "https://assets.coingecko.com/coins/images/25244/large/Optimism.png",
  ARB: "https://assets.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg",
  WLD: "https://assets.coingecko.com/coins/images/31069/large/worldcoin.jpeg",

  // ── Avalanche ecosystem ──
  JOE: "https://assets.coingecko.com/coins/images/17953/large/trader-joe.png",
  XJOE: "https://assets.coingecko.com/coins/images/17953/large/trader-joe.png",
  PNG: "https://assets.coingecko.com/coins/images/14023/large/pangolin.jpg",
  QI: "https://assets.coingecko.com/coins/images/15545/large/BENQI.png",
  BENQI: "https://assets.coingecko.com/coins/images/15545/large/BENQI.png",
  SPELL: "https://assets.coingecko.com/coins/images/15861/large/abracadabra-3.png",
  MIM: "https://assets.coingecko.com/coins/images/16786/large/mimlogopng.png",
  TIME: "https://assets.coingecko.com/coins/images/19382/large/Screenshot_2021-11-30_at_9.15.52_AM.png",
  WMEMO: "https://assets.coingecko.com/coins/images/21781/large/wMEMO_token.png",
  XAVA: "https://assets.coingecko.com/coins/images/16455/large/XAVA_token.png",
  YAK: "https://assets.coingecko.com/coins/images/17891/large/yak_200.png",
  GGP: "https://assets.coingecko.com/coins/images/27398/large/gogopool_icon_orange.png",
  GGAVAX: "https://assets.coingecko.com/coins/images/27398/large/gogopool_icon_orange.png",
  SAVAX: "https://assets.coingecko.com/coins/images/22270/large/stakedAVAX.jpg",
  YYAVAX: "https://assets.coingecko.com/coins/images/27110/large/yyavax.png",
  USDC_E: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
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
  const llamaChainId = LLAMA_CHAIN_ID[network];

  // Symbol-based brand logo — highest signal for popular assets, works
  // regardless of which chain-specific path has the asset indexed.
  const symKey = symbol.toUpperCase().replace(/[.\s-]/g, "_");
  // Try exact match first, then normalised key
  const symExact = symbol.toUpperCase();
  if (SYMBOL_LOGOS[symExact]) sources.push(SYMBOL_LOGOS[symExact]);
  else if (SYMBOL_LOGOS[symKey]) sources.push(SYMBOL_LOGOS[symKey]);

  if (isNative) {
    // TrustWallet native coin logo
    if (tw) {
      sources.push(
        `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${tw}/info/logo.png`,
      );
    }
    const cg = NATIVE_COINGECKO[network];
    if (cg) sources.push(cg);
  } else {
    // ERC20: TrustWallet requires EIP-55 checksum casing for the asset path.
    if (tw) {
      const checksum = safeChecksum(address);
      if (checksum) {
        sources.push(
          `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${tw}/assets/${checksum}/logo.png`,
        );
      }
      // Lowercase path as a cheap secondary attempt.
      sources.push(
        `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${tw}/assets/${lower}/logo.png`,
      );
    }

    // DefiLlama token icon service — covers virtually every DeFi token,
    // publicly accessible, 1-year cache, no auth required.
    if (llamaChainId) {
      sources.push(
        `https://token-icons.llamao.fi/icons/tokens/${llamaChainId}/${lower}?h=48&w=48`,
      );
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

export interface MoatMeta {
  name: string;
  protocol: string;
  tokenSymbol: string;
  tokenAddress?: string;
  logoUrl?: string;
  chain?: string;
  description?: string;
  website?: string;
}

const TW = (addr: string) =>
  `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/assets/${addr}/logo.png`;

export const MOAT_METADATA: Record<string, MoatMeta> = {
  "0xd4280e25a7969da08b7093e8b54068d693def66e": {
    name: "Gator Dont Play Moat",
    protocol: "GatorOS",
    tokenSymbol: "GATOR",
    tokenAddress: "0x1a31a8fd8bacb64b32dbcdcf5b2215f58baf70c1",
    chain: "avalanche",
    description: "10% of the $GATOR supply distributed daily over 1 year. Built on GatorOS and SwampSwap.",
    website: "https://gatorswap.com",
  },
  "0xec7a708c9a9ac691d5e8be056bbd5c8251f003ea": {
    name: "SEEDS Moat",
    protocol: "SEEDS",
    tokenSymbol: "SEEDS",
    tokenAddress: "0x4c515fb7ddb31ef5cb53895b614e6dbf356f0041",
    chain: "avalanche",
    description: "Stake SEEDS tokens and earn rewards managed by the SEEDS team.",
  },
  "0xe5a12711f9fe7e5263ec43a2a18eaec0a6b4c7cb": {
    name: "AVAX Drama Moat",
    protocol: "AVAX Drama",
    tokenSymbol: "DRAMA",
    tokenAddress: "0x58f075ffce3b299ff81966a24063b357455a7ddf",
    chain: "avalanche",
    description: "Stake DRAMA tokens and earn rewards from the AVAX Drama community.",
  },
  "0x7a4d20261a765bd9ba67d49fbf8189843eec3393": {
    name: "Lil Coq Moat",
    protocol: "Lil Coq",
    tokenSymbol: "LIL",
    tokenAddress: "0x22683bbadd01473969f23709879187705a253763",
    chain: "avalanche",
    description: "Stake LIL tokens and earn rewards from the Lil Coq community.",
  },
  "0x7e1f28c9622aa68001fe0b200f5e5f93f6b35cc9": {
    name: "Balln Chikn Moat",
    protocol: "Balln Chikn",
    tokenSymbol: "Balln",
    tokenAddress: "0x4afc7838167b77530278483c3d8c1ffe698a912e",
    chain: "avalanche",
    description: "Stake Balln tokens and earn rewards from the Balln Chikn project.",
  },
  "0x940b7f7d73a504ec566157eebb0566b81d57e8f8": {
    name: "Vitrene Moat",
    protocol: "Vitrene",
    tokenSymbol: "VIT",
    tokenAddress: "0xde34c06de75fb446b5e7b8dd272d014f2a19009d",
    chain: "avalanche",
    description: "Stake VIT tokens and earn rewards from the Vitrene protocol.",
  },
  "0x9c5f177cdc0332e61e423ee9ad9e4f2333f62685": {
    name: "Where Is Malek Moat",
    protocol: "Where Is Malek",
    tokenSymbol: "WHEREMALEK",
    tokenAddress: "0xeb55fab1c23ec0aa5024ee593a12edcd031ecd9b",
    chain: "avalanche",
    description: "3M $WHEREMALEK + 100 $ARENA distributed daily. Community-powered Moat.",
  },
  "0x501f6e7bec3db63d8dacbc9fa0ce42d5d2329d53": {
    name: "LP WAVAX/hCASH Moat",
    protocol: "Pharaoh Exchange",
    tokenSymbol: "WAVAX/hCASH",
    tokenAddress: "0x8f961980518bc9ab302948de7948580666dc35d9",
    logoUrl: "https://pharaoh.exchange/favicon.ico",
    chain: "avalanche",
    description: "Stake WAVAX/hCASH LP tokens from Pharaoh Exchange v2 to earn rewards.",
    website: "https://pharaoh.exchange",
  },
  "0x93d8cc111233f8c5b9a019df7c159b6f9be7b44b": {
    name: "Dimish Moat",
    protocol: "Dimish",
    tokenSymbol: "DISH",
    tokenAddress: "0x40146e96ee5297187022d1ca62a3169b5e45b0a4",
    chain: "avalanche",
    description: "Stake DISH tokens and earn rewards from the Dimish protocol.",
  },
  "0x020c73b55d139d5e259bad89b126f2a446c22ac6": {
    name: "FREAK Anon Moat",
    protocol: "FREAK",
    tokenSymbol: "FREAK",
    tokenAddress: "0x201d04f88bc9b3bdacdf0519a95e117f25062d38",
    chain: "avalanche",
    description: "Stake FREAK tokens and earn FREAK and USDC rewards.",
  },
  "0xcf65744c955a292d11de2a4184e9fabedbfc7b40": {
    name: "HEFE Moat",
    protocol: "HEFE",
    tokenSymbol: "HEFE",
    tokenAddress: "0x18e3605b13f10016901eac609b9e188cf7c18973",
    logoUrl: TW("0x18e3605B13F10016901EAc609b9E188Cf7C18973"),
    chain: "avalanche",
    description: "Stake HEFE tokens and earn HEFE, WAVAX, USDC, and BTC.b rewards.",
  },
  "0x464b2817f16f6117602ad05bae446c2fc5ba6fb7": {
    name: "supercycle (real) Moat",
    protocol: "supercycle (real)",
    tokenSymbol: "SUPER",
    tokenAddress: "0xca2e0f72653337d05b1abcebea5718a4a3e57a0b",
    chain: "avalanche",
    description: "Rewards come from our treasury balance of over 700 Backstage Passes on the Blaze platform.",
    website: "https://blaze.stream",
  },
  "0x3399d03566bb6db0cb4f1e13047589a1499cebbc": {
    name: "Bensi Box Token Moat",
    protocol: "Bensi Box",
    tokenSymbol: "BENSI",
    tokenAddress: "0x00697f5f6dc2ca0a17e6c89bccd1173a61ea24a6",
    chain: "avalanche",
    description: "Bensi Box is a fine art tokenization and fractionalization DAO on Avalanche.",
  },
  "0x42f33a4f98bc5ba0af733c624683580a013d1c80": {
    name: "ArenaToken Moat",
    protocol: "Arena.Social",
    tokenSymbol: "ARENA",
    tokenAddress: "0xb8d7710f7d8349a506b75dd184f05777c82dad0c",
    logoUrl: TW("0xB8D7710f7D8349A506B75DD184F05777C82dAD0c"),
    chain: "avalanche",
    description: "Stake ARENA tokens from Arena.Social and earn rewards.",
    website: "https://arena.social",
  },
};

// Runtime-resolved metadata for Moats not in the hardcoded MOAT_METADATA map.
// Populated by useResolveMoatMetas() based on the on-chain stakingToken's
// symbol() and name(), so newly-deployed Moats get a proper name automatically
// instead of falling back to "Moat 0xabcd…".
const RESOLVED_OVERRIDES: Record<string, Partial<MoatMeta>> = {};

export function setResolvedMoatMeta(contractAddress: string, override: Partial<MoatMeta>) {
  RESOLVED_OVERRIDES[contractAddress.toLowerCase()] = {
    ...RESOLVED_OVERRIDES[contractAddress.toLowerCase()],
    ...override,
  };
}

export function getMoatMeta(contractAddress: string): MoatMeta {
  const lower = contractAddress.toLowerCase();
  const hardcoded = MOAT_METADATA[lower];
  if (hardcoded) return hardcoded;
  const resolved = RESOLVED_OVERRIDES[lower];
  if (resolved && resolved.name) {
    return {
      name: resolved.name,
      protocol: resolved.protocol ?? resolved.tokenSymbol ?? "Moats Protocol",
      tokenSymbol: resolved.tokenSymbol ?? "TOKEN",
      tokenAddress: resolved.tokenAddress,
      chain: resolved.chain ?? "avalanche",
      description: resolved.description ?? "A Moats liquidity staking position.",
      logoUrl: resolved.logoUrl,
      website: resolved.website,
    };
  }
  return {
    name: `Moat ${contractAddress.slice(0, 6)}…${contractAddress.slice(-4)}`,
    protocol: "Moats Protocol",
    tokenSymbol: "TOKEN",
    description: "A Moats liquidity staking position on Avalanche.",
  };
}

export function formatUSD(amount: number): string {
  if (amount <= 0) return "";
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1)}K`;
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  return "<$0.01";
}

export function getTokenLogoUrl(tokenAddress: string): string {
  const checksumMap: Record<string, string> = {
    "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7": "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    "0x152b9d0fdc40c096757f570a51e494bd4b943e50": "0x152b9d0FDC40C096757F570A51E494bd4b943E50",
    "0xb8d7710f7d8349a506b75dd184f05777c82dad0c": "0xB8D7710f7D8349A506B75DD184F05777C82dAD0c",
    "0x18e3605b13f10016901eac609b9e188cf7c18973": "0x18e3605B13F10016901EAc609b9E188Cf7C18973",
  };
  const lower = tokenAddress.toLowerCase();
  const checksum = checksumMap[lower];
  if (checksum) return TW(checksum);
  return "";
}

export function formatPoints(points: number): string {
  return points.toLocaleString("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(
    timestamp > 1e12 ? timestamp : timestamp * 1000
  );
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(timestamp: number): string {
  const now = Date.now();
  const ts = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const diff = Math.floor((now - ts) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function getEventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    Staked: "Stake",
    Withdrawn: "Withdraw",
    Locked: "Lock",
    Burned: "Burn",
    RewardClaimed: "Claim",
    LockExited: "Exit Lock",
    EarlyExit: "Early Exit",
  };
  return labels[eventType] || eventType;
}

export function getEventTypeColor(eventType: string): string {
  const colors: Record<string, string> = {
    Staked: "text-emerald-400",
    Locked: "text-cyan-400",
    Burned: "text-rose-400",
    Withdrawn: "text-amber-400",
    RewardClaimed: "text-violet-400",
    LockExited: "text-blue-400",
    EarlyExit: "text-orange-400",
  };
  return colors[eventType] || "text-muted-foreground";
}

const EXPLORER_URLS: Record<string, string> = {
  avalanche: "https://snowtrace.io",
  avax: "https://snowtrace.io",
  ethereum: "https://etherscan.io",
  mainnet: "https://etherscan.io",
  arbitrum: "https://arbiscan.io",
  base: "https://basescan.org",
  optimism: "https://optimistic.etherscan.io",
  polygon: "https://polygonscan.com",
  bsc: "https://bscscan.com",
  bnb: "https://bscscan.com",
  monad: "https://monadvision.com",
  thegrotto: "https://subnets.avax.network/thegrotto",
  blaze: "https://subnets.avax.network/blaze",
};

export function getExplorerUrl(network: string): string {
  const key = network.toLowerCase();
  return EXPLORER_URLS[key] || "https://snowtrace.io";
}

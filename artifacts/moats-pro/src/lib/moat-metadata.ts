export interface MoatMeta {
  name: string;
  protocol: string;
  tokenSymbol: string;
  tokenAddress?: string;
  logoURL?: string;
  chain?: string;
  chainId?: number;
  description?: string;
  website?: string;
  twitterHandle?: string;
}

export const MOAT_METADATA: Record<string, MoatMeta> = {
  "0xd4280e25a7969da08b7093e8b54068d693def66e": {
    name: "Gator Moat",
    protocol: "GatorOS",
    tokenSymbol: "GATOR",
    chain: "avalanche",
    description: "Earn GATOR rewards — 10% of supply distributed daily over 1 year. Built on GatorOS and SwampSwap.",
    website: "https://gatorswap.com",
  },
  "0xec7a708c9a9ac691d5e8be056bbd5c8251f003ea": {
    name: "Blaze Social Moat",
    protocol: "Blaze.stream",
    tokenSymbol: "BLAZE",
    chain: "avalanche",
    description: "Earn BLAZE and USDC from Blaze.stream earnings and Arena.Social tips.",
    website: "https://blaze.stream",
  },
  "0xe5a12711f9fe7e5263ec43a2a18eaec0a6b4c7cb": {
    name: "Blaze USDC Moat",
    protocol: "Blaze.stream",
    tokenSymbol: "USDC",
    chain: "avalanche",
    description: "Earn USDC and BLAZE rewards from the Blaze social platform.",
    website: "https://blaze.stream",
  },
  "0x7a4d20261a765bd9ba67d49fbf8189843eec3393": {
    name: "WAVAX Rewards Moat",
    protocol: "FortiFi",
    tokenSymbol: "WAVAX",
    chain: "avalanche",
    description: "Earn Wrapped AVAX rewards through the FortiFi protocol.",
  },
  "0x940b7f7d73a504ec566157eebb0566b81d57e8f8": {
    name: "Arena Social Moat",
    protocol: "Arena.Social",
    tokenSymbol: "ARENA",
    chain: "avalanche",
    description: "Rewards generated from Blaze.stream earnings and Arena.Social tips. 50% to stakers.",
    website: "https://arena.social",
  },
  "0x9c5f177cdc0332e61e423ee9ad9e4f2333f62685": {
    name: "Wheremalek Moat",
    protocol: "Where Is Malek",
    tokenSymbol: "WHEREMALEK",
    chain: "avalanche",
    description: "3M $WHEREMALEK + 100 $ARENA distributed daily. Community-powered Moat.",
  },
  "0x501f6e7bec3db63d8dacbc9fa0ce42d5d2329d53": {
    name: "hCASH-WAVAX LP Moat",
    protocol: "Pharaoh Exchange",
    tokenSymbol: "hCASH/WAVAX",
    chain: "avalanche",
    description: "Stake hCASH/WAVAX LP tokens from Pharaoh Exchange v2 to earn rewards.",
    website: "https://pharaoh.exchange",
  },
  "0xcf65744c955a292d11de2a4184e9fabedbfc7b40": {
    name: "HEFE Moat",
    protocol: "HEFE",
    tokenSymbol: "HEFE",
    chain: "avalanche",
    description: "Earn HEFE, WAVAX, USDC, and BTC.b rewards from the HEFE protocol.",
  },
  "0x464b2817f16f6117602ad05bae446c2fc5ba6fb7": {
    name: "Backstage Pass Moat",
    protocol: "Blaze.stream",
    tokenSymbol: "BLAZE",
    chain: "avalanche",
    description: "Rewards from 700+ Backstage Passes on the Blaze platform.",
    website: "https://blaze.stream",
  },
  "0x3399d03566bb6db0cb4f1e13047589a1499cebbc": {
    name: "Bensi Box Moat",
    protocol: "Bensi Box",
    tokenSymbol: "WAVAX",
    chain: "avalanche",
    description: "Bensi Box is a fine art tokenization and fractionalization DAO on Avalanche.",
  },
  "0x020c73b55d139d5e259bad89b126f2a446c22ac6": {
    name: "FREAK USDC Moat",
    protocol: "FREAK",
    tokenSymbol: "USDC",
    chain: "avalanche",
    description: "Earn USDC and FREAK token rewards.",
  },
};

export function getMoatMeta(contractAddress: string): MoatMeta {
  const lower = contractAddress.toLowerCase();
  return (
    MOAT_METADATA[lower] || {
      name: `Moat ${contractAddress.slice(0, 6)}…${contractAddress.slice(-4)}`,
      protocol: "Moats Protocol",
      tokenSymbol: "TOKEN",
      description: "A Moats liquidity staking position on Avalanche.",
    }
  );
}

export function formatPoints(points: number): string {
  if (points >= 1_000_000) return `${(points / 1_000_000).toFixed(2)}M`;
  if (points >= 1_000) return `${(points / 1_000).toFixed(1)}K`;
  return points.toFixed(0);
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
};

export function getExplorerUrl(network: string): string {
  const key = network.toLowerCase();
  return EXPLORER_URLS[key] || "https://snowtrace.io";
}

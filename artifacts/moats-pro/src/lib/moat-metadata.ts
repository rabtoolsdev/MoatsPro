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

export const MOAT_METADATA: Record<string, MoatMeta> = {};

export function getMoatMeta(contractAddress: string): MoatMeta {
  const lower = contractAddress.toLowerCase();
  return (
    MOAT_METADATA[lower] || {
      name: `Moat ${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`,
      protocol: "Unknown Protocol",
      tokenSymbol: "TOKEN",
      description: "A Moats liquidity staking position",
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

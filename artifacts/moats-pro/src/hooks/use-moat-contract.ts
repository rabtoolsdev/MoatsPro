import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useBalance } from "wagmi";
import { useAccount } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { useMemo } from "react";
import { MOAT_V3_ABI, ERC20_ABI } from "@/lib/moat-abi";
import { isNativeToken, type MoatToken } from "@/lib/moat-tokens";

export type MoatContractAddress = `0x${string}`;

export function useMoatStats(contractAddress: MoatContractAddress | undefined) {
  const enabled = !!contractAddress;

  const totalStaked = useReadContract({
    address: contractAddress,
    abi: MOAT_V3_ABI,
    functionName: "totalStaked",
    query: { enabled },
  });

  const totalLocked = useReadContract({
    address: contractAddress,
    abi: MOAT_V3_ABI,
    functionName: "totalLocked",
    query: { enabled },
  });

  const totalBurned = useReadContract({
    address: contractAddress,
    abi: MOAT_V3_ABI,
    functionName: "totalBurned",
    query: { enabled },
  });

  const totalPoints = useReadContract({
    address: contractAddress,
    abi: MOAT_V3_ABI,
    functionName: "totalPoints",
    query: { enabled },
  });

  const activeUserCount = useReadContract({
    address: contractAddress,
    abi: MOAT_V3_ABI,
    functionName: "activeUserCount",
    query: { enabled },
  });

  const stakingEnabled = useReadContract({
    address: contractAddress,
    abi: MOAT_V3_ABI,
    functionName: "stakingEnabled",
    query: { enabled },
  });

  const stakingToken = useReadContract({
    address: contractAddress,
    abi: MOAT_V3_ABI,
    functionName: "stakingToken",
    query: { enabled },
  });

  const unstakeFee = useReadContract({
    address: contractAddress,
    abi: MOAT_V3_ABI,
    functionName: "unstakeFee",
    query: { enabled },
  });

  return {
    totalStaked: totalStaked.data,
    totalLocked: totalLocked.data,
    totalBurned: totalBurned.data,
    totalPoints: totalPoints.data,
    activeUserCount: activeUserCount.data,
    stakingEnabled: stakingEnabled.data,
    stakingToken: stakingToken.data,
    unstakeFee: unstakeFee.data,
    isLoading:
      totalStaked.isLoading ||
      totalLocked.isLoading ||
      totalPoints.isLoading,
    refetch: () => {
      totalStaked.refetch();
      totalLocked.refetch();
      totalBurned.refetch();
      totalPoints.refetch();
      activeUserCount.refetch();
    },
  };
}

export function useUserMoatInfo(
  contractAddress: MoatContractAddress | undefined
) {
  const { address } = useAccount();
  const enabled = !!contractAddress && !!address;

  const userInfo = useReadContract({
    address: contractAddress,
    abi: MOAT_V3_ABI,
    functionName: "userInfo",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  const pendingRewards = useReadContract({
    address: contractAddress,
    abi: MOAT_V3_ABI,
    functionName: "getAllPendingRewards",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  return {
    userInfo: userInfo.data,
    pendingRewards: pendingRewards.data,
    pendingRewardsError: pendingRewards.error,
    isLoading: userInfo.isLoading || pendingRewards.isLoading,
    refetch: () => {
      userInfo.refetch();
      pendingRewards.refetch();
    },
  };
}

export function useTokenBalance(
  tokenAddress: MoatContractAddress | undefined
) {
  const { address } = useAccount();
  const enabled = !!tokenAddress && !!address;

  const balance = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled, refetchInterval: 15_000 },
  });

  const decimals = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled },
  });

  const symbol = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled },
  });

  return {
    balance: balance.data,
    decimals: decimals.data,
    symbol: symbol.data,
    formatted:
      balance.data !== undefined && decimals.data !== undefined
        ? formatUnits(balance.data, decimals.data)
        : undefined,
    isLoading: balance.isLoading,
    refetch: balance.refetch,
  };
}

export function useSwapFromBalance(token: MoatToken | null) {
  const { address } = useAccount();
  const isNative = !!token && isNativeToken(token.address);
  const erc20Enabled = !!token && !isNative && !!address;
  const nativeEnabled = isNative && !!address;

  const erc20Bal = useReadContract({
    address: token?.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: erc20Enabled, refetchInterval: 15_000 },
  });

  const erc20Decimals = useReadContract({
    address: token?.address,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: erc20Enabled },
  });

  const erc20Symbol = useReadContract({
    address: token?.address,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: erc20Enabled },
  });

  const native = useBalance({
    address: nativeEnabled ? address : undefined,
    query: { enabled: nativeEnabled, refetchInterval: 15_000 },
  });

  if (isNative) {
    const value = native.data?.value;
    const dec = native.data?.decimals ?? token?.decimals ?? 18;
    return {
      balance: value,
      decimals: dec,
      symbol: native.data?.symbol ?? token?.symbol,
      formatted: value !== undefined ? formatUnits(value, dec) : undefined,
      isLoading: native.isLoading,
    };
  }

  return {
    balance: erc20Bal.data,
    decimals: erc20Decimals.data,
    symbol: erc20Symbol.data,
    formatted:
      erc20Bal.data !== undefined && erc20Decimals.data !== undefined
        ? formatUnits(erc20Bal.data, erc20Decimals.data)
        : undefined,
    isLoading: erc20Bal.isLoading,
  };
}

export function useTokenAllowance(
  tokenAddress: MoatContractAddress | undefined,
  spenderAddress: MoatContractAddress | undefined
) {
  const { address } = useAccount();
  const enabled = !!tokenAddress && !!spenderAddress && !!address;

  return useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && spenderAddress ? [address, spenderAddress] : undefined,
    query: { enabled, refetchInterval: 15_000 },
  });
}

export function useStakeMoat(contractAddress: MoatContractAddress | undefined) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const stake = (amount: string, decimals: number = 18) => {
    if (!contractAddress) return;
    writeContract({
      address: contractAddress,
      abi: MOAT_V3_ABI,
      functionName: "stake",
      args: [parseUnits(amount, decimals)],
    });
  };

  return { stake, isPending, isConfirming, isSuccess, error, hash };
}

export function useLockMoat(contractAddress: MoatContractAddress | undefined) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const lock = (amount: string, durationDays: number, decimals: number = 18) => {
    if (!contractAddress) return;
    const durationSeconds = BigInt(durationDays * 24 * 60 * 60);
    writeContract({
      address: contractAddress,
      abi: MOAT_V3_ABI,
      functionName: "lock",
      args: [parseUnits(amount, decimals), durationSeconds],
    });
  };

  return { lock, isPending, isConfirming, isSuccess, error, hash };
}

export function useClaimRewards(contractAddress: MoatContractAddress | undefined) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claim = () => {
    if (!contractAddress) return;
    writeContract({
      address: contractAddress,
      abi: MOAT_V3_ABI,
      functionName: "claimAllRewards",
    });
  };

  return { claim, isPending, isConfirming, isSuccess, error, hash };
}

export function useApproveToken(tokenAddress: MoatContractAddress | undefined) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (spender: MoatContractAddress, amount: string, decimals: number = 18) => {
    if (!tokenAddress) return;
    writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [spender, parseUnits(amount, decimals)],
    });
  };

  return { approve, isPending, isConfirming, isSuccess, error, hash };
}

export function useNftBoostBalance(
  nftContractAddress: MoatContractAddress | undefined
) {
  const { address } = useAccount();
  const enabled = !!nftContractAddress && !!address;

  return useReadContract({
    address: nftContractAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled },
  });
}

/**
 * Batches balanceOf calls across every active NFT boost contract attached
 * to a moat. Returns one entry per input contract address (in the same
 * order). Out-of-range / non-ERC20 reads are silently treated as 0n via
 * allowFailure so a single bad boost contract can't break the whole panel.
 */
export function useNftBoostBalances(
  nftContractAddresses: readonly `0x${string}`[],
) {
  const { address } = useAccount();
  const contracts = useMemo(() => {
    if (!address || nftContractAddresses.length === 0) return [];
    return nftContractAddresses.map((nft) => ({
      address: nft,
      abi: ERC20_ABI,
      functionName: "balanceOf" as const,
      args: [address] as const,
    }));
  }, [address, nftContractAddresses]);

  const { data, isLoading, refetch } = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: contracts.length > 0 },
  });

  const balances = useMemo<bigint[]>(() => {
    if (!data) return nftContractAddresses.map(() => 0n);
    return data.map((r) => (r.status === "success" ? (r.result as bigint) : 0n));
  }, [data, nftContractAddresses]);

  return { balances, isLoading, refetch };
}

export function useUnstakeMoat(contractAddress: MoatContractAddress | undefined) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const unstake = (amount: string, decimals: number = 18) => {
    if (!contractAddress) return;
    writeContract({
      address: contractAddress,
      abi: MOAT_V3_ABI,
      functionName: "unstake",
      args: [parseUnits(amount, decimals)],
    });
  };

  return { unstake, isPending, isConfirming, isSuccess, error, hash };
}

export function useBurnMoat(contractAddress: MoatContractAddress | undefined) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const burn = (amount: string, decimals: number = 18) => {
    if (!contractAddress) return;
    writeContract({
      address: contractAddress,
      abi: MOAT_V3_ABI,
      functionName: "burn",
      args: [parseUnits(amount, decimals)],
    });
  };

  return { burn, isPending, isConfirming, isSuccess, error, hash };
}

export function useExitLock(contractAddress: MoatContractAddress | undefined) {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const exitLock = (lockIndex: number) => {
    if (!contractAddress) return;
    writeContract({
      address: contractAddress,
      abi: MOAT_V3_ABI,
      functionName: "exitLock",
      args: [BigInt(lockIndex)],
    });
  };

  const earlyExitLock = (lockIndex: number) => {
    if (!contractAddress) return;
    writeContract({
      address: contractAddress,
      abi: MOAT_V3_ABI,
      functionName: "earlyExitLock",
      args: [BigInt(lockIndex)],
    });
  };

  return { exitLock, earlyExitLock, isPending, isConfirming, isSuccess, error, hash };
}

export interface UserLock {
  index: number;
  amount: bigint;
  end: bigint;
  points: bigint;
  originalDuration: bigint;
  lastUpdated: bigint;
  active: boolean;
}

export function useUserLocks(
  contractAddress: MoatContractAddress | undefined,
  userAddress: `0x${string}` | undefined,
  activeLockCount: number
) {
  // The contract's userInfo.activeLockCount is the count of *currently active*
  // locks, but lock slots are stored sparsely: a user who has exited 2 locks
  // and then opened 1 new one will have activeLockCount=1 with the active lock
  // at slot index 2 (slots 0,1 still exist but with active=false). So we must
  // probe beyond activeLockCount and stop at the first revert (= no more slots).
  // We use allowFailure so out-of-range slots return as failed entries rather
  // than throwing the whole multicall.
  const probeCount = useMemo(() => {
    if (activeLockCount === 0) return 0;
    // Headroom to cover historical exited locks. 128 covers any realistic
    // protocol user; we also keep an 8x multiplier for power users who hold
    // many concurrent active locks. allowFailure makes out-of-range slots
    // free (returned as failed entries inside the multicall).
    return Math.max(activeLockCount * 8, 128);
  }, [activeLockCount]);

  const contracts = useMemo(() => {
    if (!contractAddress || !userAddress || probeCount === 0) return [];
    return Array.from({ length: probeCount }, (_, i) => ({
      address: contractAddress,
      abi: MOAT_V3_ABI,
      functionName: "getUserLock" as const,
      args: [userAddress, BigInt(i)] as const,
    }));
  }, [contractAddress, userAddress, probeCount]);

  const { data, isLoading, refetch } = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: contracts.length > 0 },
  });

  const locks = useMemo((): UserLock[] => {
    if (!data) return [];
    return data
      .map((r, index) => {
        if (r.status !== "success") return null;
        const [amount, end, points, originalDuration, lastUpdated, active] = r.result as [
          bigint, bigint, bigint, bigint, bigint, boolean
        ];
        return { index, amount, end, points, originalDuration, lastUpdated, active };
      })
      .filter((l): l is UserLock => l !== null && l.active);
  }, [data]);

  return { locks, isLoading, refetch };
}

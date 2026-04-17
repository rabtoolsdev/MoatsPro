import { useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useAccount } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { useMemo } from "react";
import { MOAT_V3_ABI, ERC20_ABI } from "@/lib/moat-abi";

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
    functionName: "pendingRewards",
    args: address ? [address] : undefined,
    query: { enabled },
  });

  return {
    userInfo: userInfo.data,
    pendingRewards: pendingRewards.data,
    isLoading: userInfo.isLoading,
    refetch: userInfo.refetch,
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
  const contracts = useMemo(() => {
    if (!contractAddress || !userAddress || activeLockCount === 0) return [];
    return Array.from({ length: activeLockCount }, (_, i) => ({
      address: contractAddress,
      abi: MOAT_V3_ABI,
      functionName: "getUserLock" as const,
      args: [userAddress, BigInt(i)] as const,
    }));
  }, [contractAddress, userAddress, activeLockCount]);

  const { data, isLoading, refetch } = useReadContracts({
    contracts,
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

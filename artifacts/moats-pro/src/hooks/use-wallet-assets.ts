import { useMemo } from "react";
import { useAccount, useBalance, useReadContracts } from "wagmi";
import { erc20Abi, formatUnits } from "viem";
import { isNativeToken, type MoatToken } from "@/lib/moat-tokens";
import { AVALANCHE_CHAIN_ID } from "@/lib/swap-routers";

export interface AssetBalance {
  raw: bigint;
  formatted: string;
}

export type WalletBalances = Record<string, AssetBalance | undefined>;

export function useWalletAssetBalances(tokens: MoatToken[]): {
  balances: WalletBalances;
  isLoading: boolean;
} {
  const { address, isConnected } = useAccount();

  const erc20Tokens = useMemo(
    () => tokens.filter((t) => !isNativeToken(t.address)),
    [tokens],
  );
  const nativeToken = useMemo(
    () => tokens.find((t) => isNativeToken(t.address)),
    [tokens],
  );

  const native = useBalance({
    address,
    chainId: AVALANCHE_CHAIN_ID,
    query: { enabled: isConnected && !!address && !!nativeToken },
  });

  const erc20s = useReadContracts({
    contracts: erc20Tokens.map((t) => ({
      address: t.address,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: address ? [address] : undefined,
      chainId: AVALANCHE_CHAIN_ID,
    })),
    query: {
      enabled: isConnected && !!address && erc20Tokens.length > 0,
    },
  });

  const balances = useMemo<WalletBalances>(() => {
    const out: WalletBalances = {};
    if (nativeToken && native.data) {
      out[nativeToken.address.toLowerCase()] = {
        raw: native.data.value,
        formatted: formatUnits(native.data.value, native.data.decimals),
      };
    }
    erc20Tokens.forEach((t, i) => {
      const r = erc20s.data?.[i];
      if (r?.status === "success" && typeof r.result === "bigint") {
        out[t.address.toLowerCase()] = {
          raw: r.result,
          formatted: formatUnits(r.result, t.decimals),
        };
      }
    });
    return out;
  }, [nativeToken, native.data, erc20s.data, erc20Tokens]);

  return {
    balances,
    isLoading: native.isLoading || erc20s.isLoading,
  };
}

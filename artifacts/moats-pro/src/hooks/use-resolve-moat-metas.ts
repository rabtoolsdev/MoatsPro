import { useEffect, useMemo } from "react";
import { useReadContracts } from "wagmi";
import { ERC20_ABI } from "@/lib/moat-abi";
import { MOAT_METADATA, setResolvedMoatMeta } from "@/lib/moat-metadata";

export interface MoatTokenLookup {
  contractAddress: string;
  stakingToken?: string;
  network?: string;
}

export function useResolveMoatMetas(lookups: MoatTokenLookup[]) {
  const unresolved = useMemo(
    () =>
      lookups.filter(
        (l) =>
          l.stakingToken &&
          !MOAT_METADATA[l.contractAddress.toLowerCase()],
      ),
    [lookups],
  );

  const contracts = useMemo(
    () =>
      unresolved.flatMap((l) => [
        {
          address: l.stakingToken as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "symbol" as const,
        },
        {
          address: l.stakingToken as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "name" as const,
        },
      ]),
    [unresolved],
  );

  const { data } = useReadContracts({
    contracts,
    query: { enabled: contracts.length > 0, staleTime: 10 * 60 * 1000 },
  });

  useEffect(() => {
    if (!data) return;
    unresolved.forEach((l, i) => {
      const symRes = data[i * 2];
      const nameRes = data[i * 2 + 1];
      const symbol =
        symRes?.status === "success" ? (symRes.result as string) : undefined;
      const tokenName =
        nameRes?.status === "success" ? (nameRes.result as string) : undefined;
      if (!symbol && !tokenName) return;
      const display = tokenName || symbol || "Token";
      setResolvedMoatMeta(l.contractAddress, {
        name: `${display} Moat`,
        protocol: tokenName || symbol || "Moats Protocol",
        tokenSymbol: symbol || "TOKEN",
        tokenAddress: l.stakingToken,
        chain: l.network ?? "avalanche",
      });
    });
  }, [data, unresolved]);
}

/**
 * Robinhood public RPCs support live state reads but require authenticated
 * archive access for historical logs. Its history comes from the Moats API.
 * This policy must not affect contract reads or wallet transactions.
 */
export function usesIndexedMoatHistory(chainId?: number, network?: string): boolean {
  const name = network?.toLowerCase();
  return chainId === 4663 || name === "robinhood" || name === "robinhoodchain";
}

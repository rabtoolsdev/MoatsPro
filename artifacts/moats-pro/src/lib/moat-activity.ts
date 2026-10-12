import type { MoatEvent } from "./moats-api";

function transactionKey(event: MoatEvent): string {
  return [
    event.network.toLowerCase(),
    event.contractAddress.toLowerCase(),
    event.transactionHash.toLowerCase(),
    event.eventType,
  ].join(":");
}

/** Prefer indexed logs over confirmed-call records once the indexer catches up. */
export function mergeMoatActivity(
  indexed: MoatEvent[],
  supplemental: MoatEvent[],
): MoatEvent[] {
  const logKeys = new Set(indexed.map((event) =>
    `${transactionKey(event)}:${event.logIndex}`,
  ));
  const indexedCalls = new Set(indexed.map(transactionKey));
  const missed = supplemental.filter((event) =>
    event.source === "confirmed-transaction"
      ? !indexedCalls.has(transactionKey(event))
      : !logKeys.has(`${transactionKey(event)}:${event.logIndex}`),
  );
  return [...indexed, ...missed].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
  );
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { moatsApi, type MoatEvent } from "./moats-api";
import { DataSourceError, shouldRetryQuery } from "./data-source-status";

test("history refresh preserves oldest events, deduplicates, and reconciles full history", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let clock = originalNow();
  let calls = 0;
  let addNew = false;
  let removed = false;
  Date.now = () => clock;
  const events = Array.from({ length: 2001 }, (_, i): MoatEvent => ({
    _id: `event-${i}`,
    network: "blaze", contractAddress: `0x${"a".repeat(40)}`,
    eventType: "Staked", blockNumber: 3000 - i,
    transactionHash: `0x${i.toString(16).padStart(64, "0")}`,
    logIndex: 0, timestamp: new Date(1_700_000_000_000 - i * 1000).toISOString(),
    args: { amount: "100" },
  }));
  globalThis.fetch = async (input) => {
    calls++;
    const url = new URL(String(input), "https://local.test");
    assert.equal(url.pathname, "/api/moats-data");
    const path = new URL(url.searchParams.get("path")!, "https://indexer.test");
    const skip = Number(path.searchParams.get("skip"));
    const limit = Number(path.searchParams.get("limit"));
    const values = [
      ...(addNew ? [{ ...events[0], _id: "new-event", timestamp: new Date(1_700_000_001_000).toISOString() }] : []),
      ...events.filter((event) => !(removed && event._id === "event-2000")),
    ];
    return new Response(JSON.stringify({ results: values.slice(skip, skip + limit), total: values.length }), { status: 200 });
  };
  try {
    const [first, duplicate] = await Promise.all([
      moatsApi.getAllEvents("Staked", 3000, "blaze"),
      moatsApi.getAllEvents("Staked", 3000, "blaze"),
    ]);
    assert.deepEqual(first, duplicate);
    assert.equal(first.length, 2001);
    assert.equal(calls, 3);
    addNew = true;
    const refresh = await moatsApi.getAllEvents("Staked", 3000, "blaze");
    assert.equal(calls, 4, "refresh needs only the newest page");
    assert.equal(refresh.length, 2002);
    assert.equal(refresh[0]._id, "new-event");
    assert.ok(refresh.some((event) => event._id === "event-2000"));
    assert.equal(new Set(refresh.map((event) => event._id)).size, refresh.length);
    clock += 31 * 60_000;
    removed = true;
    const reconciled = await moatsApi.getAllEvents("Staked", 3000, "blaze");
    assert.equal(calls, 7);
    assert.equal(reconciled.length, 2001);
    assert.ok(!reconciled.some((event) => event._id === "event-2000"));
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test("a rate limit pauses other indexer reads and is not retried", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("Unavailable", { status: 503, headers: { "Retry-After": "60" } });
  };
  try {
    await assert.rejects(moatsApi.getEvents({ network: "blaze" }), DataSourceError);
    await assert.rejects(moatsApi.getEvents({ network: "avalanche" }), DataSourceError);
    assert.equal(calls, 1);
    assert.equal(shouldRetryQuery(0, new DataSourceError("limited", 503, Date.now() + 60_000)), false);
    assert.equal(shouldRetryQuery(0, { cause: { status: 429 } }), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

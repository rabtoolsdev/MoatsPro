import assert from "node:assert/strict";
import { test } from "node:test";
import { getMoatsData, MoatsSourceError, normalizeMoatsPath } from "./moats-data";

test("resource allowlist, canonical query, and API pagination cap", () => {
  assert.equal(normalizeMoatsPath("/events?network=blaze&limit=10000&skip=0"), "/events?limit=1000&network=blaze&skip=0");
  for (const path of ["//evil.example/events", "/admin", "/events?url=https://evil.example", "/events?limit=-1", "/events?skip=100001", "/events?network=a&network=b", "/events?contractAddress=not-an-address"]) {
    assert.throws(() => normalizeMoatsPath(path));
  }
});

test("concurrent reads share a request; cache, backoff, stale flag and recovery", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let clock = originalNow();
  let calls = 0;
  let mode: "success" | "limited" = "success";
  Date.now = () => clock;
  globalThis.fetch = async () => {
    calls++;
    return mode === "success"
      ? new Response(JSON.stringify({ results: [{ _id: String(calls) }], total: 1 }), { status: 200 })
      : new Response("Rate limited", { status: 429, headers: { "Retry-After": "45" } });
  };
  try {
    const path = "/events?eventType=Staked&limit=50";
    const [a, b] = await Promise.all([getMoatsData(path), getMoatsData(path)]);
    assert.deepEqual(a.data, b.data);
    assert.equal(calls, 1);
    assert.equal((await getMoatsData(path)).stale, false);
    assert.equal(calls, 1);
    clock += 20_000;
    mode = "limited";
    const stale = await getMoatsData(path);
    assert.equal(stale.stale, true);
    assert.deepEqual(stale.data, a.data);
    assert.equal(stale.updatedAt, a.updatedAt);
    assert.equal(calls, 2);
    await assert.rejects(getMoatsData("/events?eventType=Burned"), (error: unknown) =>
      error instanceof MoatsSourceError && error.status === 503 && error.retryAfterSeconds === 45);
    assert.equal(calls, 2, "cooldown must not make another upstream request");
    clock += 46_000;
    mode = "success";
    const recovered = await getMoatsData(path);
    assert.equal(recovered.stale, false);
    assert.equal(calls, 3);
    assert.ok(recovered.updatedAt > stale.updatedAt);
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

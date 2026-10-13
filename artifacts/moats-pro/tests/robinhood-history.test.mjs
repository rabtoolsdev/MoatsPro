import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Exercise the real hook query functions without a browser or live RPCs.
// Only React's hook shell and external clients are replaced.
function loadModule(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  const require = (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  };
  new Function("require", "exports", outputText)(require, exports);
  return exports;
}

const policy = loadModule("../src/lib/moat-history-policy.ts");
const chains = {
  avalanche: 43114, mainnet: 1, base: 8453, bsc: 56,
  monad: 10143, grotto: 36463, blaze: 46975,
  robinhood: 4663, robinhoodchain: 4663,
};
const config = (network) => ({
  network,
  contractAddress: "0x1cc326b8a13f89e7de64dd073e5a1a9fdcdd1d28",
});

function fixture() {
  const queries = [];
  const calls = [];
  const apiCalls = [];
  const hooks = loadModule("../src/hooks/use-moats-api.ts", {
    react: { useMemo: (fn) => fn() },
    "@tanstack/react-query": {
      useQuery: (options) => {
        queries.push(options);
        return options;
      },
      useQueries: ({ queries: options }) => {
        queries.push(...options);
        return options.map((query) => ({
          data: [],
          isLoading: false,
          refetch: query.queryFn,
        }));
      },
    },
    wagmi: {
      usePublicClient: ({ chainId }) => ({
        chain: { id: chainId },
        getBlockNumber: async () => {
          calls.push({ chainId, method: "getBlockNumber" });
          return 100_000n;
        },
        getLogs: async () => {
          calls.push({ chainId, method: "getLogs" });
          return [];
        },
      }),
    },
    "@/lib/moats-api": {
      moatsApi: {
        getEvents: async (params) => {
          apiCalls.push(params);
          return { results: [{ network: "robinhood", eventType: params?.eventType ?? "Staked" }] };
        },
      },
    },
    "@/lib/moat-abi": { REWARDS_DEPOSITED_EVENT_ABI: [{}], MOAT_ALL_EVENTS_ABI: [] },
    viem: { parseEventLogs: () => [] },
    "@/lib/wagmi-config": { networkToChainId: (network) => chains[network?.toLowerCase()] },
    "@/lib/blaze-activity": {
      fetchBlazeRecentActivity: async () => {
        calls.push({ chainId: 46975, method: "fetchBlazeRecentActivity" });
        return [];
      },
    },
    "@/lib/moat-history-policy": policy,
  });
  return { hooks, queries, calls, apiCalls };
}

test("indexed-only history identifies Robinhood by chain ID and both network aliases", () => {
  assert.equal(policy.usesIndexedMoatHistory(4663), true);
  for (const name of ["robinhood", "robinhoodchain", "RobinhoodChain"]) {
    assert.equal(policy.usesIndexedMoatHistory(undefined, name), true);
  }
  for (const [network, chainId] of Object.entries(chains).filter(([, id]) => id !== 4663)) {
    assert.equal(policy.usesIndexedMoatHistory(chainId, network), false);
  }
});

test("Robinhood activity and reward-deposit queries retain their Moats API source", async () => {
  const f = fixture();
  f.hooks.useEvents(config("robinhood").contractAddress);
  f.hooks.useRewardsDepositedEvents(config("robinhood").contractAddress);
  for (const query of f.queries) {
    const response = await query.queryFn();
    assert.equal(response.results[0].network, "robinhood");
  }
  assert.equal(f.apiCalls.length, 2);
  assert.equal(f.apiCalls[1].eventType, "RewardsDeposited");
  assert.deepEqual(f.calls, []);
});

test("each Robinhood moat requests its own network-scoped activity and reward deposits", async () => {
  const addresses = [
    "0x1cc326b8a13f89e7de64dd073e5a1a9fdcdd1d28",
    "0x989ea8325138026c80d11167f0e04ea5ce6047da", // ARENA
    "0x527c5ff76247fec4d26d3fc664c0192313786b0e",
    "0x56b6864ebf43d8fa5f4b729fd706627d466115e9",
    "0x57e7e1d6eb7c9e3a5d2a5b4d8fff0d667c840272",
  ];
  const f = fixture();
  for (const address of addresses) {
    f.hooks.useEvents(address, "robinhood");
    f.hooks.useRewardsDepositedEvents(address, "robinhood");
  }
  for (const query of f.queries) await query.queryFn();
  addresses.forEach((address, index) => {
    assert.deepEqual(f.apiCalls[index * 2], { contractAddress: address, network: "robinhood" });
    assert.deepEqual(f.apiCalls[index * 2 + 1], {
      contractAddress: address, network: "robinhood", eventType: "RewardsDeposited", limit: 100,
    });
    assert.ok(f.queries[index * 2].queryKey.includes(address));
    assert.ok(f.queries[index * 2].queryKey.includes("robinhood"));
    assert.equal(f.queries[index * 2].refetchInterval, 30_000);
  });
  assert.deepEqual(f.calls, []);
});

test("network-scoped event caches do not collide and existing unscoped callers stay unchanged", () => {
  const f = fixture();
  const address = config("robinhood").contractAddress;
  f.hooks.useEvents(address);
  f.hooks.useEvents(address, "robinhood");
  f.hooks.useEvents(address, "avalanche");
  assert.deepEqual(f.queries[0].queryKey, ["moats", "events", address]);
  assert.notDeepEqual(f.queries[1].queryKey, f.queries[2].queryKey);
  f.hooks.useRewardsDepositedEvents(address);
  assert.deepEqual(f.queries[3].queryKey, ["moats", "events", address, "RewardsDeposited"]);
});

test("single-moat reward and full-analytics scans cannot issue Robinhood RPCs", async () => {
  for (const network of ["robinhood", "RobinhoodChain"]) {
    const f = fixture();
    f.hooks.useOnChainRewardsDeposited(config(network).contractAddress, 4663, network);
    f.hooks.useOnChainMoatAnalyticsEvents(config(network), true);
    for (const query of f.queries) {
      assert.equal(query.enabled, false);
      // React Query permits manual refetch of disabled queries: guard that too.
      assert.deepEqual(await query.queryFn(), []);
    }
    assert.deepEqual(f.calls, []);
  }
  const f = fixture();
  f.hooks.useOnChainRewardsDeposited(config("robinhood").contractAddress, 4663, undefined);
  assert.equal(f.queries[0].enabled, false);
  await f.queries[0].queryFn();
  assert.deepEqual(f.calls, []);
});

test("all-moat reward scans skip Robinhood but keep other networks' RPC scans", async () => {
  const f = fixture();
  f.hooks.useAllOnChainRewardsDeposited(Object.keys(chains).map(config));
  await f.queries[0].queryFn();
  assert.equal(f.calls.some((call) => call.chainId === 4663), false);
  for (const chainId of new Set(Object.values(chains).filter((id) => id !== 4663))) {
    assert.ok(f.calls.some((call) => call.chainId === chainId && call.method === "getLogs"));
  }
});

test("recent activity scans and manual refetch skip Robinhood, preserving Avalanche and Blaze", async () => {
  const f = fixture();
  const result = f.hooks.useAllOnChainRecentEvents(Object.keys(chains).map(config));
  assert.equal(f.queries.find((query) => query.queryKey.includes(4663)).enabled, false);
  await result.refetch();
  assert.equal(f.calls.some((call) => call.chainId === 4663), false);
  assert.ok(f.calls.some((call) => call.chainId === 43114 && call.method === "getLogs"));
  assert.ok(f.calls.some((call) => call.method === "fetchBlazeRecentActivity"));
});

test("all-moat full-history analytics exclude Robinhood while other networks remain enabled", async () => {
  const f = fixture();
  f.hooks.useOnChainAllMoatAnalyticsEvents(Object.keys(chains).map(config), true);
  assert.equal(f.queries.some((query) => query.queryKey.includes(4663)), false);
  for (const query of f.queries) {
    assert.equal(query.enabled, true);
    await query.queryFn();
  }
  assert.equal(f.calls.some((call) => call.chainId === 4663), false);
  assert.equal(f.calls.filter((call) => call.method === "getLogs").length, 7);
});

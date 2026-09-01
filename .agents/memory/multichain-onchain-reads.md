---
name: Multichain on-chain reads need per-contract chainId
description: In Moats Pro, wagmi useReadContracts defaults to the wallet's connected chain; cross-chain moat reads silently fail unless each contract sets chainId.
---

# Multichain on-chain reads (Moats Pro)

Moats Pro lists Moats from MANY chains at once (Avalanche, Ethereum, Base, The Grotto, Blaze). The trending carousel and aggregate views are NOT network-filtered, so they render moats from every chain regardless of which chain the wallet is connected to.

**Rule:** Any `useReadContracts` / on-chain read for a moat (or its token) MUST set a per-contract `chainId` derived from that moat's own network. Otherwise wagmi runs the call against the wallet's currently-connected chain, and reads for moats on other chains silently return failures (empty data, missing logos/stats).

**Why:** Reported bug — switching the wallet to The Grotto blanked the Avalanche trending-moat logos (and back to Avalanche they reappeared). Cause was the `getLogoURL` read defaulting to the connected chain.

**How to apply:** Use the shared `networkToChainId(network?)` helper exported from `lib/wagmi-config.ts` (network slug -> chainId, with aliases incl. `thegrotto`/`grotto`); add `chainId: networkToChainId(c.network)` to each contract entry. The chain must also exist in the wagmi config transports (all five do). When deduping token reads (decimals/totalSupply) across moats, dedupe by address but KEEP each token's chainId — a plain `Set<address>` loses the network and reintroduces the bug. Pinned pages: `home.tsx` (moat stats + ERC20 + logo reads — has its own local `NETWORK_TO_CHAIN_ID` const) and `analytics.tsx` (stakingToken/totalLocked/decimals + the name/symbol reads in `use-resolve-moat-metas.ts`). Analytics DOES aggregate cross-chain (the "All Moats" selector and charts), so the truncated `Moat 0x…` label for Grotto's Greg Moat was the same bug; it now uses `networkToChainId`.

**Related:** The Moats API network slug for The Grotto is `thegrotto` (not `grotto`); `CHAIN_DISPLAY` must use the API's exact slug or network filtering hides those moats.

**Live activity rule:** When an aggregate activity query reads multiple chains, fetch each chain concurrently and tolerate individual block-timestamp failures. A slow or rate-limited secondary RPC should not delay or discard fresh events from another chain.

**Why:** The Explore feed was slower than a single-moat Live Activity feed because its all-network RPC scan ran serially; one failed timestamp lookup could also remove the whole on-chain result.

**How to apply:** Use `Promise.all` over grouped chain reads, return an empty result for an unavailable chain, and retain decoded events with a fallback timestamp when a block lookup fails.

**Provider constraint:** The public Avalanche C-Chain RPC rejects `eth_getLogs` requests larger than 2,048 blocks.

**Why:** An 80,000-block request followed by a 10,000-block fallback caused Explore to receive no on-chain activity even though single-moat activity was available.

**How to apply:** Use a 2,000-block maximum for chunked activity log reads, with a smaller retry for a rejected chunk.

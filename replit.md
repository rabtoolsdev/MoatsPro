# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Moats Pro (`artifacts/moats-pro`)
- **Kind**: Web (React + Vite)
- **Preview path**: `/`
- **Description**: Premium DeFi frontend for the Moats Protocol (moats.app)
- **Stack**: React 18 + Vite, WalletConnect AppKit (wagmi v2 / viem), TanStack Query, Framer Motion, Tailwind CSS v4, Wouter
- **WalletConnect Project ID**: `13318bff388bcd13cf50b4a10e9d7671`
- **Supported chains**: Avalanche (primary), Ethereum, Arbitrum, Base, Optimism, Polygon
- **API**: Live data from `https://moat-api.fortifi.network/api`
- **Admin Volume USD**: New swaps are USD-priced server-side in `POST /swaps` via `artifacts/api-server/src/lib/usd-pricing.ts` (stablecoin → DexScreener → fee-bps cross-fill → derived feeUsd). Historical rows can be re-priced via `POST /admin/backfill-usd?afterId=N` (cursor pagination so unpriceable rows don't block progress) and the "Backfill USD" button in the admin header.
- **Smart contract**: MoatV3 (MultiLockMoat) — stake, lock (with duration multipliers), burn, claimAllRewards, pending rewards
- **Theme**: Deep navy (HSL 216 32% 7%) + cyan primary (HSL 195 100% 50%) matching moats.app

#### Pages
- `/` — Explore: hero, global stats (28 moats, 318 MAPS scorers), moat card grid with protocol names, activity feed
- `/portfolio` — Real wallet positions (from /events?userAddress=...), tx history, MAPS score + rank
- `/leaderboard` — Top-3 podium + full MAPS score rankings table with epoch info
- `/moat/:address` — Moat detail: protocol name/logo, reward tokens, yield metrics panel (Daily Emission, Reward Duration, Total Pool), on-chain stats, 4-tab action panel (Stake/Withdraw/Lock/Claim), top stakers
- `/swap` — Moat Swap: token-to-token swaps between any moat-backed tokens. Compares routes from **Li.Fi, KyberSwap, and Odos** (0x is implemented but disabled by default — its native ~0.15% volume fee would silently undercut other routers) in parallel and picks the highest output by default. The "Routed via" dropdown lets the user manually override. 0.33% integrator fee → `0xe789b6fFdd63835F0Ee64D9d3e085244515230C6`, **single-signature on all routers** when configured: KyberSwap (always — `feeAmount`+`feeReceiver` in /route/build), Li.Fi (when `VITE_LIFI_API_KEY` is set + integrator approved on portal — `fee=0.0033` skimmed in-tx), Odos (when `VITE_ODOS_API_KEY` is set — `partnerFeePercent`+`feeRecipient` on V3 enterprise endpoint, 80/20 split with Odos). Without those keys, fee transfer falls back to a separate pre-swap tx (Li.Fi/0x) or zero fee (Odos V2). Optional `VITE_KYBERSWAP_CLIENT_ID` rebrands Kyber attribution (defaults to `moats-pro`).

#### Swap Architecture (`/swap`)
- `src/lib/swap-routers.ts` — Four router clients (`getLifiQuote`, `getOdosQuote`, `getKyberQuote`, `get0xQuote`); `RouterId = "lifi" | "0x" | "odos" | "kyber"`; `getAllQuotes()` runs all four in parallel; `pickBestQuote()` picks the highest output. 0x uses Swap API v2 *allowance-holder* flow (NOT Permit2) so it returns a single executable tx like the others. KyberSwap uses the two-step `/routes` → `/route/build` flow. Native token sentinel translated `0x0…0` ↔ `0xeeee…eeee` at the boundary for 0x/Kyber. Fee = 33 bps (0.33%) skimmed by `useExecuteSwap` as a separate transfer before the swap tx, so the aggregator quote input amount is always post-fee.
- `src/lib/moat-tokens.ts` — Derives the swappable token list from `useAllMoatConfigs()` + `MOAT_METADATA` (filters out LP tokens since aggregators can't swap them).
- `src/hooks/use-swap.ts` — `useSwapQuote()` (TanStack Query, 20s refetch) + `useExecuteSwap()` (uses `useSendTransaction` since Li.Fi returns raw calldata).
- `src/components/swap/token-select-modal.tsx` — Searchable token picker.
- Approve flow uses existing `useApproveToken` against `quote.approveTo` (Li.Fi's diamond proxy).

#### Key Source Files
- `src/lib/wagmi-config.ts` — AppKit + wagmi config (Avalanche first)
- `src/lib/moats-api.ts` — Moats API client (moat-config, events, MAPS leaderboard)
- `src/lib/moat-abi.ts` — MoatV3 + ERC20 ABIs
- `src/lib/moat-metadata.ts` — Protocol metadata registry (12 real Avalanche protocols) + utilities
- `src/hooks/use-moat-contract.ts` — Contract hooks: stake, lock, unstake/withdraw, exitLock, claim, NFT boost balance
- `src/hooks/use-moats-api.ts` — TanStack Query hooks for Moats API

#### API Notes
- APY/TVL/fees endpoints do not exist in the real Moats API (/api/tvl → 404)
- Yield metrics are derived from rewardTokens data: tokenAmount (daily rate), totalRewardsDeposited, totalRewardsClaimed
- MAPS score uses `mapScore` field (not `points`) — normalized in useMapsLeaderboard hook

#### Production Deployment (Hetzner)
- **Server IP**: `128.140.98.252` (resolves from `pro.moats.app`)
- **GitHub repo**: `rabtoolsdev/MoatsPro` (private)
- **Auto-deploy**: GitHub Actions on push to `main` → SSHes to Hetzner → runs `deploy/deploy.sh`
- **Manual deploy** (proper command per user — login as root, run script as `moats` user):
  ```bash
  ssh root@128.140.98.252
  sudo -u moats bash /var/www/moats-pro/deploy/deploy.sh
  ```
  Do NOT `ssh moats@...` directly — the user logs in as root and `sudo -u moats` to run the deploy script.
- **Production secrets** (CRITICAL — without this file the admin dashboard stays empty and Odos/Li.Fi fees silently fail): `/var/www/moats-pro/.env.production` (chmod 600, owned by `moats:moats`, **never committed**). Both `deploy.sh` (for the Vite build — `VITE_*` vars are baked into the bundle at build time) and `ecosystem.config.cjs` (for the api-server runtime — `DATABASE_URL`) read from it. Template: `deploy/.env.production.example`. Required keys: `DATABASE_URL`, `VITE_LIFI_API_KEY`, `VITE_ODOS_API_KEY`, `VITE_KYBERSWAP_CLIENT_ID`. After editing the file, re-run `deploy.sh` — `pm2 reload --update-env` re-evaluates the ecosystem config so new values take effect without a manual restart.
- **DB migrations**: `deploy.sh` runs `pnpm --filter @workspace/db run push` automatically when `DATABASE_URL` is set (drizzle-kit push is idempotent — safe to re-run).
- **GitHub push from Replit**: `git push` is sandbox-blocked; push via Replit Git pane (uses GitHub OAuth) OR use `GITHUB_TOKEN` secret + smart-HTTP protocol via curl (see commit log for Task #15)

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
- **Smart contract**: MoatV3 (MultiLockMoat) — stake, lock (with duration multipliers), burn, claimAllRewards, pending rewards
- **Theme**: Deep navy (HSL 216 32% 7%) + cyan primary (HSL 195 100% 50%) matching moats.app

#### Pages
- `/` — Explore: hero, global stats (28 moats, 318 MAPS scorers), moat card grid with protocol names, activity feed
- `/portfolio` — Real wallet positions (from /events?userAddress=...), tx history, MAPS score + rank
- `/leaderboard` — Top-3 podium + full MAPS score rankings table with epoch info
- `/moat/:address` — Moat detail: protocol name/logo, reward tokens, yield metrics panel (Daily Emission, Reward Duration, Total Pool), on-chain stats, 4-tab action panel (Stake/Withdraw/Lock/Claim), top stakers

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
- **GitHub push from Replit**: `git push` is sandbox-blocked; push via Replit Git pane (uses GitHub OAuth) OR use `GITHUB_TOKEN` secret + smart-HTTP protocol via curl (see commit log for Task #15)

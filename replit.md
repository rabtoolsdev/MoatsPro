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
- **Supported chains**: Ethereum, Arbitrum, Base, Optimism, Polygon
- **API**: Live data from `https://moat-api.fortifi.network/api`
- **Smart contract**: MoatV3 (MultiLockMoat) — stake, lock (with duration multipliers), burn, claimAllRewards, pending rewards
- **Theme**: Deep navy (HSL 216 32% 7%) + cyan primary (HSL 195 100% 50%) matching moats.app

#### Pages
- `/` — Explore: hero, global stats, moat card grid, activity feed
- `/portfolio` — User positions, points, MAPS score (wallet-gated)
- `/leaderboard` — MAPS Score and Moat Points rankings
- `/moat/:address` — Moat detail: on-chain stats, stake/lock/claim action panel, top stakers

#### Key Source Files
- `src/lib/wagmi-config.ts` — AppKit + wagmi config
- `src/lib/moats-api.ts` — Moats API client
- `src/lib/moat-abi.ts` — MoatV3 + ERC20 ABIs
- `src/lib/moat-metadata.ts` — Metadata helpers and formatting utilities
- `src/hooks/use-moat-contract.ts` — Contract read/write hooks
- `src/hooks/use-moats-api.ts` — TanStack Query hooks for Moats API

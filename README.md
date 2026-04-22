# Moats Pro

Premium DeFi frontend for the Moats Protocol — React + Vite + WalletConnect AppKit, consuming the live Moats API and interacting with MoatV3 (MultiLockMoat) smart contracts on Avalanche.

Live data: `https://moat-api.fortifi.network/api`
WalletConnect Project ID: `13318bff388bcd13cf50b4a10e9d7671`

---

## Stack

- pnpm workspace monorepo, TypeScript 5.9, Node.js 20+
- React 18 + Vite (frontend)
- Express 5 (API server)
- wagmi v2 / viem / WalletConnect AppKit
- TanStack Query, Tailwind CSS v4, Framer Motion, Wouter

## Repo layout

```
artifacts/
  moats-pro/         React + Vite frontend (the public site)
  api-server/        Express API server (proxies/augments moat-api)
  mockup-sandbox/    Internal component preview (not deployed)
```

## Prerequisites

- Node.js **20+** (24 recommended)
- pnpm **9+** (`npm install -g pnpm`)

## Local development

```bash
pnpm install
pnpm --filter @workspace/moats-pro run dev      # frontend on :3000
pnpm --filter @workspace/api-server run dev     # api on :3001
```

## Build

```bash
pnpm run typecheck          # full typecheck
pnpm run build              # build everything
```

Frontend build output: `artifacts/moats-pro/dist/`
API server build output: `artifacts/api-server/dist/`

## Environment variables

Copy `.env.example` to `.env` and adjust as needed. Per-artifact examples are in each artifact directory.

| Variable | Used by | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | both | `development` | Set to `production` in prod |
| `PORT` (api) | api-server | `3001` | Port the API listens on |
| `LOG_LEVEL` | api-server | `info` | pino log level |
| `PORT` (web) | moats-pro vite | `3000` | Dev server port |
| `BASE_PATH` | moats-pro vite | `/` | URL base path for the frontend |

WalletConnect project ID and the upstream Moats API URL are currently in source code (see `replit.md`).

## Production deployment (Hetzner / any VPS)

1. Provision an Ubuntu 24.04 server (2 vCPU / 4 GB RAM is plenty)
2. Install Node 20+, pnpm, and Caddy
3. Clone this repo to `/var/www/moats-pro`
4. `pnpm install --frozen-lockfile && pnpm run build`
5. Run the API server with PM2: `pm2 start "pnpm --filter @workspace/api-server start" --name moats-api`
6. Point Caddy at `artifacts/moats-pro/dist` (static) and reverse-proxy `/api/*` to the API server
7. Caddy auto-provisions HTTPS via Let's Encrypt

A full step-by-step Hetzner deployment guide will be added under `docs/` in a follow-up commit.

## License

MIT

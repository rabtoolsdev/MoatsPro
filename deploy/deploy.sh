#!/usr/bin/env bash
# =============================================================================
# Moats Pro — Deployment script (run on the Hetzner server)
# =============================================================================
# Usage (as the `moats` user):
#   bash /var/www/moats-pro/deploy/deploy.sh
#
# Called by GitHub Actions on every push to `main`, but safe to run manually.
#
# What it does:
#   1. git pull latest main
#   2. pnpm install --frozen-lockfile
#   3. Builds the API server and the Vite frontend
#   4. Reloads PM2 (zero-downtime restart of the API)
#   5. Caddy continues serving the freshly-built static dist/
# =============================================================================

set -euo pipefail

APP_DIR="/var/www/moats-pro"
GREEN="\033[0;32m"; YELLOW="\033[0;33m"; RED="\033[0;31m"; NC="\033[0m"
log() { echo -e "${GREEN}[deploy]${NC} $*"; }
warn() { echo -e "${YELLOW}[deploy]${NC} $*"; }
die() { echo -e "${RED}[deploy] $*${NC}" >&2; exit 1; }

cd "$APP_DIR" || die "App directory $APP_DIR not found — run bootstrap-server.sh first"

# -----------------------------------------------------------------------------
# 1. Pull latest code
# -----------------------------------------------------------------------------
log "Pulling latest from origin/main..."
git fetch --quiet origin main
git reset --hard origin/main

# -----------------------------------------------------------------------------
# 2. Install deps (frozen for reproducibility)
# -----------------------------------------------------------------------------
log "Installing dependencies (pnpm install --frozen-lockfile)..."
pnpm install --frozen-lockfile --prefer-offline

# -----------------------------------------------------------------------------
# 3. Build everything
# -----------------------------------------------------------------------------
log "Building API server..."
pnpm --filter @workspace/api-server run build

log "Building moats-pro frontend..."
pnpm --filter @workspace/moats-pro run build

# Sanity checks — fail loudly if a build silently produced nothing
[[ -f "$APP_DIR/artifacts/api-server/dist/index.mjs" ]] \
  || die "API server build output missing — aborting deploy"
[[ -f "$APP_DIR/artifacts/moats-pro/dist/public/index.html" ]] \
  || die "Frontend build output missing — aborting deploy"

# -----------------------------------------------------------------------------
# 4. Reload (or start) the API server via PM2
# -----------------------------------------------------------------------------
if pm2 describe moats-api >/dev/null 2>&1; then
  log "Reloading API server (zero downtime)..."
  pm2 reload moats-api --update-env
else
  log "Starting API server with PM2..."
  pm2 start "$APP_DIR/deploy/ecosystem.config.cjs"
fi
pm2 save >/dev/null

# -----------------------------------------------------------------------------
# Done
# -----------------------------------------------------------------------------
log "Deploy complete — $(date -u +%FT%TZ)"
log "Frontend: served from $APP_DIR/artifacts/moats-pro/dist by Caddy"
log "API:      pm2 status moats-api"

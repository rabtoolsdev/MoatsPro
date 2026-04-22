#!/usr/bin/env bash
# =============================================================================
# Moats Pro — Hetzner server bootstrap (run ONCE on a fresh Ubuntu 24.04 box)
# =============================================================================
# Usage (as root or with sudo):
#   curl -fsSL https://raw.githubusercontent.com/rabtoolsdev/MoatsPro/main/deploy/bootstrap-server.sh | sudo bash
# Or copy this script to the server and run:
#   sudo bash bootstrap-server.sh
#
# What it does:
#   1. Updates the OS and installs base tooling
#   2. Installs Node.js 20 LTS, pnpm, PM2, Caddy
#   3. Creates a deploy user `moats`
#   4. Sets up the app directory at /var/www/moats-pro
#   5. Configures the firewall (UFW) for SSH, HTTP, HTTPS
#   6. Enables fail2ban + unattended-upgrades
# =============================================================================

set -euo pipefail

GREEN="\033[0;32m"; YELLOW="\033[0;33m"; RED="\033[0;31m"; NC="\033[0m"
log() { echo -e "${GREEN}[bootstrap]${NC} $*"; }
warn() { echo -e "${YELLOW}[bootstrap]${NC} $*"; }
die() { echo -e "${RED}[bootstrap] $*${NC}" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root (sudo bash $0)"

# -----------------------------------------------------------------------------
# 1. Base system update
# -----------------------------------------------------------------------------
log "Updating apt and installing base packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl ca-certificates gnupg git ufw fail2ban \
  unattended-upgrades apt-transport-https debian-keyring debian-archive-keyring \
  build-essential

# -----------------------------------------------------------------------------
# 2. Node.js 20 LTS (NodeSource)
# -----------------------------------------------------------------------------
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  log "Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
else
  log "Node.js $(node -v) already installed"
fi

# -----------------------------------------------------------------------------
# 3. pnpm + PM2
# -----------------------------------------------------------------------------
log "Installing pnpm and PM2..."
npm install -g pnpm pm2

# -----------------------------------------------------------------------------
# 4. Caddy (reverse proxy + auto HTTPS)
# -----------------------------------------------------------------------------
if ! command -v caddy >/dev/null; then
  log "Installing Caddy..."
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
else
  log "Caddy already installed"
fi

# -----------------------------------------------------------------------------
# 5. Create deploy user `moats`
# -----------------------------------------------------------------------------
if ! id moats >/dev/null 2>&1; then
  log "Creating deploy user 'moats'..."
  useradd -m -s /bin/bash moats
  usermod -aG www-data moats
fi

# -----------------------------------------------------------------------------
# 6. App directories
# -----------------------------------------------------------------------------
log "Creating app directories..."
mkdir -p /var/www/moats-pro
chown -R moats:moats /var/www/moats-pro
mkdir -p /var/log/moats /var/log/caddy
chown moats:moats /var/log/moats
chown caddy:caddy /var/log/caddy 2>/dev/null || true

# -----------------------------------------------------------------------------
# 7. Firewall (UFW): SSH + HTTP + HTTPS only
# -----------------------------------------------------------------------------
log "Configuring firewall..."
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'HTTP' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw --force enable >/dev/null

# -----------------------------------------------------------------------------
# 8. fail2ban + automatic security updates
# -----------------------------------------------------------------------------
log "Enabling fail2ban + unattended-upgrades..."
systemctl enable --now fail2ban
dpkg-reconfigure -fnoninteractive unattended-upgrades

# -----------------------------------------------------------------------------
# 9. PM2 startup on boot (run as moats user)
# -----------------------------------------------------------------------------
log "Configuring PM2 to start on boot for user 'moats'..."
sudo -u moats pm2 startup systemd -u moats --hp /home/moats >/tmp/pm2-startup.sh 2>&1 || true
# Extract and execute the sudo command PM2 prints (the simplest reliable approach)
grep -oE 'sudo env .*pm2 startup .*' /tmp/pm2-startup.sh | bash || true

# -----------------------------------------------------------------------------
# Done
# -----------------------------------------------------------------------------
echo
log "Bootstrap complete!"
echo
warn "Next steps:"
cat <<EOF

  1. Add your SSH public key to /home/moats/.ssh/authorized_keys
     (so GitHub Actions / your laptop can ssh moats@<server>)

  2. Clone the repo as the moats user:
     sudo -u moats git clone https://github.com/rabtoolsdev/MoatsPro.git /var/www/moats-pro

  3. Edit /var/www/moats-pro/deploy/Caddyfile and replace
     'pro.moats.app' with your real domain. Then:
       sudo cp /var/www/moats-pro/deploy/Caddyfile /etc/caddy/Caddyfile
       sudo systemctl reload caddy

  4. Run the first deploy:
       sudo -u moats bash /var/www/moats-pro/deploy/deploy.sh

  5. Point your domain's A record at this server's public IP, and
     Caddy will provision HTTPS automatically on first request.

EOF

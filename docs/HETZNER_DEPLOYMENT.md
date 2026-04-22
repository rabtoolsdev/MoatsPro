# Hetzner Deployment — Moats Pro

Step-by-step guide for deploying Moats Pro to a Hetzner Cloud VPS with Caddy (HTTPS), PM2 (process manager), and GitHub Actions (auto-deploy on push to `main`).

---

## 0. What you'll end up with

```
                       Internet
                          │
                  ┌───────▼────────┐
                  │   Hetzner VPS  │  Ubuntu 24.04 (CX22: 2 vCPU / 4 GB)
                  │                │
                  │  ┌──────────┐  │
                  │  │  Caddy   │  │  Auto-HTTPS via Let's Encrypt
                  │  │ :80/:443 │  │
                  │  └────┬─────┘  │
                  │       │        │
                  │  ┌────┴────────┴──────────────────────┐
                  │  │                                    │
                  │  ▼ static                             ▼ /api/*
                  │  artifacts/moats-pro/dist/   reverse proxy → :3001
                  │                                       │
                  │                              ┌────────▼──────┐
                  │                              │ Node API      │
                  │                              │ (PM2-managed) │
                  │                              └───────────────┘
                  └──────────────────────────────────────┘
```

Push to `main` → GitHub Actions SSHes in → `deploy.sh` runs → PM2 reloads API, Caddy serves freshly built frontend.

---

## 1. Provision the Hetzner server

1. Create an account at https://cloud.hetzner.com
2. **New project** → **Add server**
   - **Location**: Falkenstein/Nuremberg (EU) or Ashburn (US East) — pick closest to your users
   - **Image**: Ubuntu 24.04
   - **Type**: **CX22** (2 vCPU shared, 4 GB RAM, 40 GB SSD, ~€4.50/mo) — perfect for this workload
   - **SSH key**: upload your laptop's `~/.ssh/id_ed25519.pub` (or generate a new one)
   - **Backups**: optional, +20% (~€0.90/mo) — recommended
   - **Name**: `moats-pro-prod`
3. Note the **public IPv4** address — you'll need it everywhere below

---

## 2. First SSH in + run the bootstrap script

```bash
ssh root@<server-ip>
```

On the server:

```bash
# Download and run the bootstrap script straight from your repo
curl -fsSL https://raw.githubusercontent.com/rabtoolsdev/MoatsPro/main/deploy/bootstrap-server.sh \
  | sudo bash
```

This will:
- Update Ubuntu and install base tooling
- Install Node.js 20 LTS, pnpm, PM2, Caddy
- Create the `moats` deploy user
- Configure UFW firewall (only SSH/80/443)
- Enable fail2ban + automatic security updates

Takes ~3–5 minutes.

> If your `MoatsPro` repo is private (it is), the `curl` above will fail.
> Either make it temporarily public, or copy `deploy/bootstrap-server.sh`
> to the server manually:
> ```bash
> scp deploy/bootstrap-server.sh root@<server-ip>:/tmp/
> ssh root@<server-ip> "sudo bash /tmp/bootstrap-server.sh"
> ```

---

## 3. Set up SSH access for the deploy user

GitHub Actions will SSH in as the `moats` user. Generate a dedicated SSH key on your laptop:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/moats_deploy -C "github-actions-moats-deploy" -N ""
```

Copy the **public** key to the server:

```bash
ssh-copy-id -i ~/.ssh/moats_deploy.pub moats@<server-ip>
```

Test it:

```bash
ssh -i ~/.ssh/moats_deploy moats@<server-ip> "whoami && uptime"
```

---

## 4. Clone the repo onto the server

The repo is private, so you need a deploy key or HTTPS token. Easiest is a **GitHub deploy key**:

```bash
# On the server, as the moats user:
sudo -u moats ssh-keygen -t ed25519 -f /home/moats/.ssh/github_deploy -N ""
sudo cat /home/moats/.ssh/github_deploy.pub
```

Copy the printed public key. On GitHub:
- Go to your `MoatsPro` repo → **Settings → Deploy keys → Add deploy key**
- Title: `Hetzner production`
- Paste the key, **Allow write access: NO** (read-only is enough)
- Save

Tell SSH on the server to use that key for github.com:

```bash
sudo -u moats tee /home/moats/.ssh/config <<EOF
Host github.com
  HostName github.com
  User git
  IdentityFile /home/moats/.ssh/github_deploy
  IdentitiesOnly yes
EOF
sudo -u moats chmod 600 /home/moats/.ssh/config
```

Now clone:

```bash
sudo -u moats git clone git@github.com:rabtoolsdev/MoatsPro.git /var/www/moats-pro
```

---

## 5. Configure Caddy

```bash
# Edit the Caddyfile and replace pro.moats.app with your real domain
sudo nano /var/www/moats-pro/deploy/Caddyfile

# Install it
sudo cp /var/www/moats-pro/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Check Caddy is happy:

```bash
sudo systemctl status caddy
sudo journalctl -u caddy -n 30
```

---

## 6. Point DNS at the server

In your domain DNS provider (Cloudflare recommended):

| Type | Name | Value | Proxy |
|---|---|---|---|
| A | `pro` (or `@`) | `<server-ip>` | DNS only (grey cloud) for first cert issuance |

Wait 30–60 seconds for propagation, then visit `https://pro.moats.app`.
On first request, Caddy automatically provisions a Let's Encrypt certificate (takes ~10 sec).

> If you use Cloudflare, leave it in "DNS only" (grey cloud) until Caddy issues
> the cert; you can switch to proxied (orange cloud) afterwards if desired.

---

## 7. First manual deploy

```bash
sudo -u moats bash /var/www/moats-pro/deploy/deploy.sh
```

This installs deps, builds both apps, and starts the API under PM2.
Browse to your domain — you should see Moats Pro live.

---

## 8. Wire up GitHub Actions for auto-deploy

In your `MoatsPro` repo on GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Add three:

| Secret name | Value |
|---|---|
| `HETZNER_HOST` | Your server's public IP (e.g. `203.0.113.42`) |
| `HETZNER_USER` | `moats` |
| `HETZNER_SSH_KEY` | Contents of `~/.ssh/moats_deploy` (the **private** key, including `-----BEGIN OPENSSH PRIVATE KEY-----` and the trailing newline) |

Optionally `HETZNER_PORT` if you change SSH from 22.

Now every push to `main` will trigger `.github/workflows/deploy.yml`, which SSHes in and runs `deploy.sh`.

Test it: push a trivial change → watch the **Actions** tab on GitHub → confirm site updates.

---

## 9. Verify everything

```bash
# On the server:
pm2 status                      # moats-api should be "online"
pm2 logs moats-api --lines 50   # tail recent API logs
sudo systemctl status caddy     # active (running)
curl -sI https://pro.moats.app  # 200 OK
curl -s  https://pro.moats.app/api/health  # if you have a health endpoint
```

---

## 10. Day-2 ops

| Task | Command |
|---|---|
| Tail API logs | `pm2 logs moats-api` |
| Restart API only | `pm2 restart moats-api` |
| Check Caddy status | `sudo systemctl status caddy` |
| Reload Caddy after config change | `sudo systemctl reload caddy` |
| Manual deploy | `sudo -u moats bash /var/www/moats-pro/deploy/deploy.sh` |
| OS updates | Already automatic via `unattended-upgrades` |
| Resource usage | `htop` (install with `apt install htop`) |
| Firewall status | `sudo ufw status verbose` |

### Rolling back a bad deploy

```bash
sudo -u moats bash -c '
  cd /var/www/moats-pro
  git log --oneline -10           # find the commit hash to roll back to
  git reset --hard <commit-hash>
  bash deploy/deploy.sh
'
```

Or revert the bad commit on GitHub and let auto-deploy do it for you.

---

## Troubleshooting

**Caddy can't get a certificate (port 80 blocked / DNS wrong)**
- Verify `dig pro.moats.app +short` returns your server's IP
- Verify port 80 is open: `sudo ufw status` should show `80/tcp ALLOW`
- Check Caddy logs: `sudo journalctl -u caddy -n 100`

**API returns 502 Bad Gateway**
- API isn't running: `pm2 status` → restart with `pm2 restart moats-api`
- Check API logs for crashes: `pm2 logs moats-api --lines 100`

**Build out-of-memory during deploy**
- 4 GB is normally enough, but if Vite chokes, add a 2 GB swap file:
  ```bash
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
  sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```

**GitHub Actions SSH step fails**
- Verify `HETZNER_SSH_KEY` includes the full private key with header/footer lines
- Verify the public key is in `/home/moats/.ssh/authorized_keys`
- Test manually: `ssh -i ~/.ssh/moats_deploy moats@<ip>`

---

## Costs

| Item | Monthly |
|---|---|
| Hetzner CX22 (2 vCPU / 4 GB / 40 GB) | €4.50 |
| Automatic backups (optional) | €0.90 |
| Bandwidth (20 TB included) | €0 |
| Let's Encrypt TLS | €0 |
| **Total** | **~€5.40 / month** |

Compare with current Replit Autoscale at ~$30/month for the same workload.

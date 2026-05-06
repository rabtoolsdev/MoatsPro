// PM2 ecosystem config for Moats Pro API server
// Run on the Hetzner server with:
//   cd /var/www/moats-pro && pm2 start deploy/ecosystem.config.cjs && pm2 save
//
// Reads runtime env (DATABASE_URL, etc.) from /var/www/moats-pro/.env.production.
// `pm2 reload --update-env` (called by deploy.sh) re-evaluates this file on every
// deploy so secrets edited in the env file take effect without a manual restart.

const fs = require("node:fs");
const path = require("node:path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const raw of fs.readFileSync(filePath, "utf8").split("\n")) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trimStart();
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    } else {
      // Strip a trailing inline `# comment` (only when value is unquoted).
      const hash = val.indexOf(" #");
      if (hash >= 0) val = val.slice(0, hash).trimEnd();
    }
    out[key] = val;
  }
  return out;
}

const envFile = loadEnvFile(path.resolve(__dirname, "../.env.production"));

module.exports = {
  apps: [
    {
      name: "moats-api",
      cwd: "/var/www/moats-pro/artifacts/api-server",
      script: "node",
      args: "--enable-source-maps ./dist/index.mjs",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        LOG_LEVEL: "info",
        ...envFile,
      },
      out_file: "/var/log/moats/api-out.log",
      error_file: "/var/log/moats/api-err.log",
      merge_logs: true,
      time: true,
    },
  ],
};

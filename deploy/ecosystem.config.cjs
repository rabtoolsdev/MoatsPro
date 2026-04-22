// PM2 ecosystem config for Moats Pro API server
// Run on the Hetzner server with:
//   cd /var/www/moats-pro && pm2 start deploy/ecosystem.config.cjs && pm2 save

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
      },
      out_file: "/var/log/moats/api-out.log",
      error_file: "/var/log/moats/api-err.log",
      merge_logs: true,
      time: true,
    },
  ],
};

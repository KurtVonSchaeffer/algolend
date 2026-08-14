// PM2 cluster config — run with: pm2 start ecosystem.config.js
// Clusters across all available CPU cores; each worker handles requests independently
// Install: npm install -g pm2
// Start:   pm2 start ecosystem.config.js --env production
// Monitor: pm2 monit
// Reload (zero-downtime): pm2 reload algolend

module.exports = {
  apps: [
    {
      name: 'algolend',
      script: 'server.js',
      instances: 'max',        // one worker per CPU core
      exec_mode: 'cluster',    // share port across workers
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
        PORT: 3002,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};

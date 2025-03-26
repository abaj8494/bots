module.exports = {
  apps: [{
    name: "bookbot-api",
    cwd: "/var/www/bots/server",
    script: "dist/index.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: 5001
    }
  }]
};

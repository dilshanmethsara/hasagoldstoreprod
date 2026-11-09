module.exports = {
  apps: [
    {
      name: "hasa-gold-api",
      script: "src/index.js",
      node_args: "--env-file=.env",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "250M",
      time: true,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

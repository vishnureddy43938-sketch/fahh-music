const { startBot } = require('./bot');
const { startDashboard } = require('./dashboard/server');
const config = require('./config');
const logger = require('./utils/logger');

async function main() {
  console.log(`
  ==============================================================
   ⚡ HYDRA MUSIC BOT • HIGH FIDELITY AUDIO SYSTEM
  ==============================================================
   Node.js:   ${process.version}
   Version:   ${config.bot.version}
   Prefix:    ${config.prefix}
   Owner ID:  ${config.ownerId}
   Node:      ${config.lavalink.name} (${config.lavalink.host}:${config.lavalink.port})
   Dashboard: ${config.dashboard.enabled ? `Enabled (Port: ${config.dashboard.port})` : 'Disabled'}
  ==============================================================
  `);

  try {
    // 1. Start Discord Bot Client
    const client = await startBot();

    // 2. Start Web Dashboard if enabled
    if (config.dashboard.enabled) {
      startDashboard(client);
    }
  } catch (err) {
    logger.error('Fatal initialization error:', err);
    process.exit(1);
  }
}

main();

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const config = require('./config');
const database = require('./database/Database');
const musicManager = require('./music/MusicManager');
const logger = require('./utils/logger');

/**
 * Create and configure HYDRA Discord Client
 * @returns {Client}
 */
function createBot() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
    allowedMentions: { parse: ['users', 'roles'], repliedUser: false },
  });

  client.commands = new Collection();

  /**
   * Load commands from src/commands recursively
   */
  function loadCommands(dir = path.join(__dirname, 'commands')) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        loadCommands(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        try {
          const command = require(fullPath);
          if (command.data && command.execute) {
            client.commands.set(command.data.name, command);
            logger.debug(`Loaded command: /${command.data.name}`);
          }
        } catch (err) {
          logger.error(`Error loading command from ${fullPath}:`, err);
        }
      }
    }
  }

  /**
   * Load event listeners from src/events
   */
  function loadEvents(dir = path.join(__dirname, 'events')) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      try {
        const event = require(path.join(dir, file));
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args));
        } else {
          client.on(event.name, (...args) => event.execute(...args));
        }
        logger.debug(`Loaded event: ${event.name}`);
      } catch (err) {
        logger.error(`Error loading event from ${file}:`, err);
      }
    }
  }

  // Load modules
  loadCommands();
  loadEvents();

  return client;
}

/**
 * Start the bot and initialize services
 */
async function startBot() {
  config.validate();
  await database.init();

  const client = createBot();

  // Attach graceful termination handlers
  const shutdown = async (signal) => {
    logger.info(`Received ${signal}. Gracefully stopping HYDRA...`);
    musicManager.destroyAll();
    await database.close();
    client.destroy();
    logger.info('HYDRA shutdown complete.');
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  // Global uncaught handlers to prevent unexpected process crashes
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
  });

  await client.login(config.discord.token);
  return client;
}

module.exports = {
  createBot,
  startBot,
};

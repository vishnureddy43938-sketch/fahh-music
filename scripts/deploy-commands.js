const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const config = require('../src/config');
const logger = require('../src/utils/logger');

async function deployCommands() {
  if (!config.discord.token) {
    logger.error('Cannot deploy commands: DISCORD_TOKEN is missing in .env');
    process.exit(1);
  }

  if (!config.discord.clientId) {
    logger.error('Cannot deploy commands: CLIENT_ID is missing in .env');
    process.exit(1);
  }

  const commands = [];
  const commandsDir = path.join(__dirname, '..', 'src', 'commands');

  function scanDir(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        scanDir(fullPath);
      } else if (file.name.endsWith('.js')) {
        try {
          const command = require(fullPath);
          if (command.data && command.execute) {
            commands.push(command.data.toJSON());
            logger.info(`Found command: /${command.data.name}`);
          }
        } catch (err) {
          logger.error(`Error loading command file ${file.name}:`, err);
        }
      }
    }
  }

  scanDir(commandsDir);

  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  try {
    logger.info(`Starting refresh of ${commands.length} application (/) commands...`);

    let data;
    if (config.discord.guildId) {
      logger.info(`Deploying commands instantly to development guild: ${config.discord.guildId}`);
      data = await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body: commands }
      );
    } else {
      logger.info('Deploying commands globally across all servers...');
      data = await rest.put(
        Routes.applicationCommands(config.discord.clientId),
        { body: commands }
      );
    }

    logger.info(`Successfully registered ${data.length} application (/) commands!`);
  } catch (error) {
    logger.error('Failed to register application commands:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  deployCommands();
}

module.exports = { deployCommands };

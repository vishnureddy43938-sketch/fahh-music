const { Events, ActivityType } = require('discord.js');
const logger = require('../utils/logger');
const musicManager = require('../music/MusicManager');

module.exports = {
  name: Events.ClientReady,
  once: true,

  /**
   * @param {import('discord.js').Client} client 
   */
  async execute(client) {
    logger.info(`HYDRA is online as ${client.user.tag} (${client.user.id})`);
    logger.info(`Serving ${client.guilds.cache.size} servers and ${client.users.cache.size} cached users`);

    // Initialize music manager backends and Lavalink node
    await musicManager.init(client).catch((err) => {
      logger.error('MusicManager initialization failed:', err);
    });

    // Set dynamic rotating presence
    let statusIndex = 0;
    const updatePresence = () => {
      const statuses = [
        { name: '/play | High Fidelity Audio', type: ActivityType.Listening },
        { name: `${client.guilds.cache.size} servers | /help`, type: ActivityType.Watching },
        { name: 'Crystal-clear sound 🎵', type: ActivityType.Playing },
      ];

      const current = statuses[statusIndex % statuses.length];
      client.user.setActivity(current.name, { type: current.type });
      statusIndex++;
    };

    updatePresence();
    setInterval(updatePresence, 30_000);
  },
};

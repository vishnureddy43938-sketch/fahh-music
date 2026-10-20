const { Events } = require('discord.js');
const musicManager = require('../music/MusicManager');
const database = require('../database/Database');
const logger = require('../utils/logger');

module.exports = {
  name: Events.VoiceStateUpdate,

  /**
   * @param {import('discord.js').VoiceState} oldState 
   * @param {import('discord.js').VoiceState} newState 
   */
  async execute(oldState, newState) {
    const client = oldState.client || newState.client;
    const guildId = oldState.guild.id;
    const player = musicManager.getPlayer(guildId);

    if (!player) return;

    const botMember = oldState.guild.members.me;
    const botVoiceChannelId = botMember?.voice?.channelId;

    // 1. If HYDRA was disconnected from voice channel
    if (oldState.id === client.user.id && !newState.channelId) {
      logger.info(`[Guild ${guildId}] HYDRA was disconnected from voice channel by user or network.`);
      player.destroy();
      return;
    }

    // 2. Check if bot voice channel still exists
    if (!botVoiceChannelId) return;

    const voiceChannel = oldState.guild.channels.cache.get(botVoiceChannelId);
    if (!voiceChannel) return;

    // Count non-bot members in voice channel
    const nonBotMembers = voiceChannel.members.filter((m) => !m.user.bot);

    const guildSettings = await database.getSettings(guildId);

    // If channel has no humans left
    if (nonBotMembers.size === 0) {
      if (!guildSettings.mode_247) {
        logger.info(`[Guild ${guildId}] Voice channel is empty of listeners. Starting idle timer.`);
        player.startIdleTimer(guildSettings.idle_timeout || 180);
      }
    } else {
      // Humans are present, cancel idle countdown
      player.clearIdleTimer();
    }
  },
};

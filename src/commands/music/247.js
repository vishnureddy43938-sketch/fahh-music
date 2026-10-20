const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('247')
    .setDescription('Toggle 24/7 continuous voice channel presence'),

  async execute(interaction) {
    const guildSettings = await database.getSettings(interaction.guildId);
    const check = checkVoicePermissions(interaction, {
      requireVoice: true,
      requireSameChannel: false,
      requireDJ: true, // Changing 24/7 requires DJ/Admin
      guildSettings,
    });

    if (!check.valid) {
      return interaction.reply({ embeds: [check.errorEmbed], ephemeral: true });
    }

    const currentMode = guildSettings.mode_247;
    const newMode = !currentMode;

    await database.setSettings(interaction.guildId, { mode_247: newMode });

    const player = musicManager.getPlayer(interaction.guildId);
    if (player) {
      if (newMode) {
        player.clearIdleTimer();
      } else if (!player.queue.current) {
        player.startIdleTimer(guildSettings.idle_timeout);
      }
    }

    return interaction.reply({
      embeds: [
        theme.createSuccessEmbed(
          `24/7 mode has been **${newMode ? 'ENABLED' : 'DISABLED'}** for this server.\n${
            newMode
              ? 'HYDRA will remain in the voice channel indefinitely even when idle.'
              : 'HYDRA will disconnect after being idle for the configured timeout.'
          }`,
          '24/7 Mode Updated'
        ),
      ],
    });
  },
};

const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playback, clear the queue, and leave the voice channel'),

  async execute(interaction) {
    const guildSettings = await database.getSettings(interaction.guildId);
    const check = checkVoicePermissions(interaction, {
      requireVoice: true,
      requireSameChannel: true,
      requireDJ: true, // Stop requires DJ role if configured
      guildSettings,
    });

    if (!check.valid) {
      return interaction.reply({ embeds: [check.errorEmbed], ephemeral: true });
    }

    const player = musicManager.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({
        embeds: [theme.createErrorEmbed('HYDRA is not currently playing music in this server.', 'Not Active')],
        ephemeral: true,
      });
    }

    player.stop();

    return interaction.reply({
      embeds: [
        theme.createSuccessEmbed(
          'Playback stopped, queue cleared, and HYDRA disconnected.',
          'Playback Stopped'
        ),
      ],
    });
  },
};

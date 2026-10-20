const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Disconnect HYDRA from the voice channel'),

  async execute(interaction) {
    const guildSettings = await database.getSettings(interaction.guildId);
    const check = checkVoicePermissions(interaction, {
      requireVoice: true,
      requireSameChannel: true,
      requireDJ: true, // Disconnecting requires DJ permission
      guildSettings,
    });

    if (!check.valid) {
      return interaction.reply({ embeds: [check.errorEmbed], ephemeral: true });
    }

    const player = musicManager.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({
        embeds: [theme.createErrorEmbed('HYDRA is not currently in a voice channel.', 'Not Connected')],
        ephemeral: true,
      });
    }

    player.destroy();

    return interaction.reply({
      embeds: [theme.createSuccessEmbed('Disconnected from the voice channel.', 'Disconnected')],
    });
  },
};

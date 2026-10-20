const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current playback'),

  async execute(interaction) {
    const guildSettings = await database.getSettings(interaction.guildId);
    const check = checkVoicePermissions(interaction, {
      requireVoice: true,
      requireSameChannel: true,
      guildSettings,
    });

    if (!check.valid) {
      return interaction.reply({ embeds: [check.errorEmbed], ephemeral: true });
    }

    const player = musicManager.getPlayer(interaction.guildId);
    if (!player || !player.queue.current) {
      return interaction.reply({
        embeds: [theme.createErrorEmbed('No music is currently playing.', 'Nothing Playing')],
        ephemeral: true,
      });
    }

    const success = player.pause();
    if (success) {
      return interaction.reply({
        embeds: [theme.createSuccessEmbed('Playback has been paused. Use `/resume` to continue.')],
      });
    } else {
      return interaction.reply({
        embeds: [theme.createWarningEmbed('Playback is already paused.')],
        ephemeral: true,
      });
    }
  },
};

const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');
const { truncate } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('previous')
    .setDescription('Replay the previous track from history'),

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
    if (!player) {
      return interaction.reply({
        embeds: [theme.createErrorEmbed('HYDRA is not currently active in this server.', 'Not Playing')],
        ephemeral: true,
      });
    }

    if (player.queue.history.length === 0) {
      return interaction.reply({
        embeds: [theme.createWarningEmbed('No previous tracks available in playback history.', 'History Empty')],
        ephemeral: true,
      });
    }

    await interaction.deferReply();
    const success = await player.previous();

    if (success && player.queue.current) {
      return interaction.editReply({
        embeds: [
          theme.createSuccessEmbed(
            `Now playing previous track: [**${truncate(player.queue.current.title, 55)}**](${player.queue.current.url})`,
            'Previous Track'
          ),
        ],
      });
    } else {
      return interaction.editReply({
        embeds: [theme.createErrorEmbed('Failed to replay the previous track.')],
      });
    }
  },
};

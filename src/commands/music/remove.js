const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');
const { truncate } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from the queue by position')
    .addIntegerOption((option) =>
      option
        .setName('position')
        .setDescription('Queue position (1-based index)')
        .setMinValue(1)
        .setRequired(true)
    ),

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
    if (!player || player.queue.tracks.length === 0) {
      return interaction.reply({
        embeds: [theme.createErrorEmbed('The queue has no upcoming tracks to remove.', 'Queue Empty')],
        ephemeral: true,
      });
    }

    const position = interaction.options.getInteger('position');
    const removedTrack = player.queue.remove(position);

    if (!removedTrack) {
      return interaction.reply({
        embeds: [
          theme.createErrorEmbed(
            `Invalid position #${position}. Queue currently has ${player.queue.tracks.length} track(s).`,
            'Out of Range'
          ),
        ],
        ephemeral: true,
      });
    }

    return interaction.reply({
      embeds: [
        theme.createSuccessEmbed(
          `Removed **${truncate(removedTrack.title, 50)}** from position **#${position}**.`,
          'Track Removed'
        ),
      ],
    });
  },
};

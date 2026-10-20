const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');
const { truncate } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a track to a different position in the queue')
    .addIntegerOption((option) =>
      option.setName('from').setDescription('Current position').setMinValue(1).setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName('to').setDescription('New target position').setMinValue(1).setRequired(true)
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
    if (!player || player.queue.tracks.length < 2) {
      return interaction.reply({
        embeds: [
          theme.createErrorEmbed(
            'At least 2 upcoming tracks are required in the queue to move songs.',
            'Cannot Move'
          ),
        ],
        ephemeral: true,
      });
    }

    const fromPos = interaction.options.getInteger('from');
    const toPos = interaction.options.getInteger('to');
    const movedTrack = player.queue.tracks[fromPos - 1];

    const success = player.queue.move(fromPos, toPos);
    if (!success) {
      return interaction.reply({
        embeds: [
          theme.createErrorEmbed(
            `Invalid positions. Ensure both numbers are between 1 and ${player.queue.tracks.length}.`,
            'Invalid Range'
          ),
        ],
        ephemeral: true,
      });
    }

    return interaction.reply({
      embeds: [
        theme.createSuccessEmbed(
          `Moved [**${truncate(movedTrack.title, 50)}**](${movedTrack.url}) from position **#${fromPos}** to **#${toPos}**.`,
          'Track Moved'
        ),
      ],
    });
  },
};

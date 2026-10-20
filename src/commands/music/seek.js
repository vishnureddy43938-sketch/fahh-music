const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const { parseTime, formatDuration } = require('../../utils/formatters');
const theme = require('../../utils/theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Seek to a timestamp in the currently playing track')
    .addStringOption((option) =>
      option
        .setName('timestamp')
        .setDescription('Target time (e.g., "1:30", "90", "02:15")')
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
    if (!player || !player.queue.current) {
      return interaction.reply({
        embeds: [theme.createErrorEmbed('No music is currently playing.', 'Nothing Playing')],
        ephemeral: true,
      });
    }

    const track = player.queue.current;
    if (track.isLive) {
      return interaction.reply({
        embeds: [theme.createWarningEmbed('Seeking is not supported on livestreams.', 'Live Stream')],
        ephemeral: true,
      });
    }

    const timeInput = interaction.options.getString('timestamp');
    const seconds = parseTime(timeInput);

    if (seconds === null) {
      return interaction.reply({
        embeds: [
          theme.createErrorEmbed(
            'Invalid timestamp format. Use formats like `1:30`, `02:45`, or `90` (seconds).',
            'Invalid Input'
          ),
        ],
        ephemeral: true,
      });
    }

    if (seconds > track.duration) {
      return interaction.reply({
        embeds: [
          theme.createWarningEmbed(
            `Target timestamp exceeds track duration (\`${track.durationFormatted}\`).`,
            'Timestamp Out of Bounds'
          ),
        ],
        ephemeral: true,
      });
    }

    await interaction.deferReply();
    await player.seek(seconds);

    return interaction.editReply({
      embeds: [
        theme.createSuccessEmbed(
          `Seeked to **${formatDuration(seconds)}** in [**${track.title}**](${track.url}).`,
          'Playback Seeked'
        ),
      ],
    });
  },
};

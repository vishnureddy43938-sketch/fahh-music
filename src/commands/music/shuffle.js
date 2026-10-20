const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Shuffle all upcoming tracks in the queue'),

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
          theme.createWarningEmbed(
            'At least 2 upcoming tracks are required in the queue to shuffle.',
            'Insufficient Tracks'
          ),
        ],
        ephemeral: true,
      });
    }

    player.queue.shuffle();

    return interaction.reply({
      embeds: [
        theme.createSuccessEmbed(
          `Successfully shuffled **${player.queue.tracks.length}** upcoming tracks in the queue.`,
          'Queue Shuffled'
        ),
      ],
    });
  },
};

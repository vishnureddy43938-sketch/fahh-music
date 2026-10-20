const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Clear all upcoming tracks from the queue'),

  async execute(interaction) {
    const guildSettings = await database.getSettings(interaction.guildId);
    const check = checkVoicePermissions(interaction, {
      requireVoice: true,
      requireSameChannel: true,
      requireDJ: true, // Clearing queue requires DJ permission
      guildSettings,
    });

    if (!check.valid) {
      return interaction.reply({ embeds: [check.errorEmbed], ephemeral: true });
    }

    const player = musicManager.getPlayer(interaction.guildId);
    if (!player || player.queue.tracks.length === 0) {
      return interaction.reply({
        embeds: [theme.createWarningEmbed('The queue is already empty.', 'Nothing to Clear')],
        ephemeral: true,
      });
    }

    const count = player.queue.clear();
    player.sendOrUpdateNowPlaying().catch(() => {});

    return interaction.reply({
      embeds: [
        theme.createSuccessEmbed(
          `Cleared **${count}** upcoming track(s) from the queue. Current track will continue playing.`,
          'Queue Cleared'
        ),
      ],
    });
  },
};

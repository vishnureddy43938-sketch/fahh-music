const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle automatic music recommendations when the queue finishes'),

  async execute(interaction) {
    const guildSettings = await database.getSettings(interaction.guildId);
    const check = checkVoicePermissions(interaction, {
      requireVoice: true,
      requireSameChannel: false,
      guildSettings,
    });

    if (!check.valid) {
      return interaction.reply({ embeds: [check.errorEmbed], ephemeral: true });
    }

    const currentMode = guildSettings.autoplay_enabled;
    const newMode = !currentMode;

    await database.setSettings(interaction.guildId, { autoplay_enabled: newMode });

    const player = musicManager.getPlayer(interaction.guildId);
    if (player) {
      player.queue.autoplay = newMode;
    }

    return interaction.reply({
      embeds: [
        theme.createSuccessEmbed(
          `Autoplay has been **${newMode ? 'ENABLED' : 'DISABLED'}** for this server.\n${
            newMode
              ? 'Similar songs will be queued automatically when current tracks end.'
              : 'Playback will stop when the queue finishes.'
          }`,
          'Autoplay Updated'
        ),
      ],
    });
  },
};

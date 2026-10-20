const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');
const { truncate } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the currently playing track'),

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
        embeds: [theme.createErrorEmbed('There is no track playing to skip.', 'Nothing Playing')],
        ephemeral: true,
      });
    }

    const skippedTitle = player.queue.current.title;
    await player.skip();

    return interaction.reply({
      embeds: [
        theme.createSuccessEmbed(
          `Skipped **${truncate(skippedTitle, 50)}**.`,
          'Track Skipped'
        ),
      ],
    });
  },
};

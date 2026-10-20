const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('View or adjust playback volume (1% to 150%)')
    .addIntegerOption((option) =>
      option
        .setName('level')
        .setDescription('Volume level between 1 and 150')
        .setMinValue(1)
        .setMaxValue(150)
    ),

  async execute(interaction) {
    const player = musicManager.getPlayer(interaction.guildId);
    if (!player) {
      return interaction.reply({
        embeds: [theme.createErrorEmbed('HYDRA is not currently playing in this server.', 'Not Playing')],
        ephemeral: true,
      });
    }

    const level = interaction.options.getInteger('level');

    // If level is not specified, display current volume
    if (level === null || level === undefined) {
      const volumeBar = '█'.repeat(Math.round(player.volume / 10)) + '░'.repeat(15 - Math.round(player.volume / 10));
      return interaction.reply({
        embeds: [
          theme.createEmbed(theme.colors.secondary)
            .setTitle(`${theme.emojis.volume} Current Volume: ${player.volume}%`)
            .setDescription(`\`[${volumeBar}]\`\nUse \`/volume <1-150>\` to change.`),
        ],
      });
    }

    // Permission check for modifying volume
    const guildSettings = await database.getSettings(interaction.guildId);
    const check = checkVoicePermissions(interaction, {
      requireVoice: true,
      requireSameChannel: true,
      requireDJ: true, // DJ role check
      guildSettings,
    });

    if (!check.valid) {
      return interaction.reply({ embeds: [check.errorEmbed], ephemeral: true });
    }

    const newVol = player.setVolume(level);
    const volumeBar = '█'.repeat(Math.round(newVol / 10)) + '░'.repeat(15 - Math.round(newVol / 10));

    return interaction.reply({
      embeds: [
        theme.createSuccessEmbed(
          `Volume adjusted to **${newVol}%**\n\`[${volumeBar}]\``,
          'Volume Updated'
        ),
      ],
    });
  },
};

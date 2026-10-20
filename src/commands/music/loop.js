const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const { RepeatMode } = require('../../music/Queue');
const theme = require('../../utils/theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set repeat mode: off, track, or queue')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('Loop mode')
        .addChoices(
          { name: 'Disable Loop (Off)', value: 'off' },
          { name: 'Repeat Current Track', value: 'track' },
          { name: 'Repeat Entire Queue', value: 'queue' }
        )
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
        embeds: [theme.createErrorEmbed('No music is currently playing to loop.', 'Nothing Playing')],
        ephemeral: true,
      });
    }

    const modeInput = interaction.options.getString('mode');

    let newMode;
    if (modeInput) {
      newMode = player.queue.setRepeatMode(modeInput);
    } else {
      // Cycle: OFF -> TRACK -> QUEUE -> OFF
      if (player.queue.repeatMode === RepeatMode.OFF) {
        newMode = player.queue.setRepeatMode(RepeatMode.TRACK);
      } else if (player.queue.repeatMode === RepeatMode.TRACK) {
        newMode = player.queue.setRepeatMode(RepeatMode.QUEUE);
      } else {
        newMode = player.queue.setRepeatMode(RepeatMode.OFF);
      }
    }

    player.sendOrUpdateNowPlaying().catch(() => {});

    return interaction.reply({
      embeds: [
        theme.createSuccessEmbed(
          `Repeat mode is now set to **${player.queue.getRepeatModeString()}**.`,
          'Loop Mode Updated'
        ),
      ],
    });
  },
};

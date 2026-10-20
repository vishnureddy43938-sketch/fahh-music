const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('join')
    .setDescription("Join the user's current voice channel"),

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

    const voiceChannel = interaction.member.voice.channel;
    await interaction.deferReply();

    try {
      await musicManager.getOrCreatePlayer({
        client: interaction.client,
        guild: interaction.guild,
        voiceChannel,
        textChannel: interaction.channel,
      });

      return interaction.editReply({
        embeds: [
          theme.createSuccessEmbed(
            `Connected to voice channel <#${voiceChannel.id}>. Use \`/play\` to start streaming audio!`,
            'Channel Joined'
          ),
        ],
      });
    } catch (err) {
      return interaction.editReply({
        embeds: [theme.createErrorEmbed(`Failed to join voice channel: ${err.message}`)],
      });
    }
  },
};

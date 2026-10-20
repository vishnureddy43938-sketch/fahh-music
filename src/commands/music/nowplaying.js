const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const theme = require('../../utils/theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Display the currently playing track with interactive controls'),

  async execute(interaction) {
    const player = musicManager.getPlayer(interaction.guildId);
    if (!player || !player.queue.current) {
      return interaction.reply({
        embeds: [theme.createErrorEmbed('No music is currently playing.', 'Nothing Playing')],
        ephemeral: true,
      });
    }

    const { embed, components } = player.buildNowPlayingMessage();
    const replyMsg = await interaction.reply({
      embeds: [embed],
      components,
      fetchReply: true,
    });

    // Update player's active message reference so buttons stay synchronized
    player.nowPlayingMessage = {
      channelId: interaction.channelId,
      messageId: replyMsg.id,
    };
    player._attachMessageCollector(replyMsg);
  },
};

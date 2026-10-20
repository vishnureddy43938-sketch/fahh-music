const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const musicManager = require('../../music/MusicManager');
const theme = require('../../utils/theme');
const { formatDuration, truncate } = require('../../utils/formatters');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Display the current music queue with interactive pagination')
    .addIntegerOption((option) =>
      option.setName('page').setDescription('Page number to jump to').setMinValue(1)
    ),

  async execute(interaction) {
    const player = musicManager.getPlayer(interaction.guildId);
    if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
      return interaction.reply({
        embeds: [theme.createErrorEmbed('The queue is currently empty.', 'Queue Empty')],
        ephemeral: true,
      });
    }

    const pageSize = 10;
    const pages = player.queue.getPages(pageSize);
    const totalPages = pages.length || 1;
    let currentPage = Math.min(
      Math.max(interaction.options.getInteger('page') || 1, 1),
      totalPages
    );

    const generateQueueEmbed = (pageIndex) => {
      const pageData = pages[pageIndex - 1];
      const embed = theme.createEmbed(theme.colors.primary)
        .setTitle(`${theme.emojis.queue} Server Music Queue`)
        .setFooter({
          text: `Page ${pageIndex} of ${totalPages} • ${player.queue.tracks.length} track(s) queued • ${formatDuration(player.queue.totalDuration())}`,
        });

      // Show current playing track
      if (player.queue.current) {
        embed.addFields({
          name: '💿 Now Playing',
          value: `[**${truncate(player.queue.current.title, 50)}**](${player.queue.current.url}) • \`${player.queue.current.durationFormatted}\` • ${player.queue.current.requester.id ? `<@${player.queue.current.requester.id}>` : player.queue.current.requester.username}`,
        });
      }

      // Show upcoming tracks on this page
      if (pageData && pageData.tracks.length > 0) {
        const lines = pageData.tracks.map((t, idx) =>
          t.toQueueString(pageData.startIndex + idx)
        );
        embed.setDescription(`**Upcoming Tracks:**\n${lines.join('\n')}`);
      } else {
        embed.setDescription('*No upcoming tracks in the queue. Add more using `/play`!*');
      }

      return embed;
    };

    const generateButtons = (pageIndex) => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('queue_first')
          .setEmoji('⏮️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === 1),
        new ButtonBuilder()
          .setCustomId('queue_prev')
          .setEmoji('◀️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === 1),
        new ButtonBuilder()
          .setCustomId('queue_page_indicator')
          .setLabel(`${pageIndex} / ${totalPages}`)
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('queue_next')
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === totalPages),
        new ButtonBuilder()
          .setCustomId('queue_last')
          .setEmoji('⏭️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex === totalPages)
      );
      return [row];
    };

    const replyMsg = await interaction.reply({
      embeds: [generateQueueEmbed(currentPage)],
      components: totalPages > 1 ? generateButtons(currentPage) : [],
      fetchReply: true,
    });

    if (totalPages <= 1) return;

    // Component collector for pagination
    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });

    collector.on('collect', async (btnInteraction) => {
      if (btnInteraction.user.id !== interaction.user.id) {
        return btnInteraction.reply({
          content: `${theme.emojis.error} Only the command author can control pagination.`,
          ephemeral: true,
        });
      }

      switch (btnInteraction.customId) {
        case 'queue_first':
          currentPage = 1;
          break;
        case 'queue_prev':
          currentPage = Math.max(currentPage - 1, 1);
          break;
        case 'queue_next':
          currentPage = Math.min(currentPage + 1, totalPages);
          break;
        case 'queue_last':
          currentPage = totalPages;
          break;
        default:
          break;
      }

      await btnInteraction.update({
        embeds: [generateQueueEmbed(currentPage)],
        components: generateButtons(currentPage),
      });
    });

    collector.on('end', async () => {
      await interaction.editReply({ components: [] }).catch(() => {});
    });
  },
};

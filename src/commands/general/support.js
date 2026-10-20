const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const theme = require('../../utils/theme');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('support')
    .setDescription('Get links to the HYDRA support community and documentation'),

  async execute(interaction) {
    const embed = theme.createEmbed(theme.colors.secondary)
      .setTitle('🤝 HYDRA Support & Community')
      .setDescription(
        'Need assistance setting up HYDRA, troubleshooting audio streams, or requesting features? Join our official community server or view our documentation!'
      )
      .addFields(
        { name: '💬 Discord Community', value: 'Live assistance from developers and moderators', inline: true },
        { name: '🛠️ Bug Reports', value: 'Report playback anomalies or submit feature suggestions', inline: true }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Support Server')
        .setURL(config.bot.supportServer)
        .setStyle(ButtonStyle.Link)
        .setEmoji('💬')
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  },
};

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  OAuth2Scopes,
  PermissionFlagsBits,
} = require('discord.js');
const theme = require('../../utils/theme');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Generate an invitation link to add HYDRA to your Discord server'),

  async execute(interaction) {
    const clientId = config.discord.clientId || interaction.client.user.id;

    const permissions = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.UseExternalEmojis,
      PermissionFlagsBits.AddReactions,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.UseVAD,
    ];

    const inviteUrl =
      config.bot.inviteUrl ||
      interaction.client.generateInvite({
        scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
        permissions,
      });

    const embed = theme.createEmbed(theme.colors.primary)
      .setTitle('✨ Invite HYDRA to Your Server')
      .setDescription(
        'Bring crystal-clear, high-fidelity music playback with interactive Now Playing embeds, 24/7 presence, and comprehensive server controls to your community!'
      )
      .addFields(
        { name: '🔒 Recommended Permissions', value: 'Connect, Speak, Send Messages, Embed Links', inline: true },
        { name: '⚡ Slash Commands', value: 'Pre-configured with application commands', inline: true }
      );

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Invite HYDRA')
        .setURL(inviteUrl)
        .setStyle(ButtonStyle.Link)
        .setEmoji('🔗')
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  },
};

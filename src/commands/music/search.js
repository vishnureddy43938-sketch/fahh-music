const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} = require('discord.js');
const musicManager = require('../../music/MusicManager');
const sourceManager = require('../../music/SourceManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');
const { truncate } = require('../../utils/formatters');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search for tracks and select from interactive results')
    .addStringOption((option) =>
      option.setName('query').setDescription('Search terms').setRequired(true)
    ),

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

    await interaction.deferReply();

    const query = interaction.options.getString('query');
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    const requester = {
      id: interaction.user.id,
      username: interaction.user.username,
      tag: interaction.user.tag || interaction.user.username,
      avatarURL: interaction.user.displayAvatarURL(),
    };

    try {
      const results = await sourceManager.search(query, requester, 10);

      if (!results || results.length === 0) {
        return interaction.editReply({
          embeds: [theme.createErrorEmbed(`No results found for "${query}".`, 'No Results')],
        });
      }

      // Build Select Menu Options
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('hydra_search_select')
        .setPlaceholder('Choose a track to play...');

      const descriptionLines = [];

      results.forEach((track, index) => {
        const option = new StringSelectMenuOptionBuilder()
          .setLabel(truncate(`${index + 1}. ${track.title}`, 95))
          .setDescription(truncate(`${track.author} • ${track.durationFormatted}`, 95))
          .setValue(String(index));

        selectMenu.addOptions(option);
        descriptionLines.push(`**${index + 1}.** [${truncate(track.title, 55)}](${track.url}) • \`${track.durationFormatted}\` • ${track.author}`);
      });

      const row = new ActionRowBuilder().addComponents(selectMenu);

      const embed = theme.createEmbed(theme.colors.secondary)
        .setTitle(`${theme.emojis.music} Search Results for: "${truncate(query, 40)}"`)
        .setDescription(descriptionLines.join('\n') + '\n\n*Select a song from the dropdown below within 60 seconds.*')
        .setFooter({ text: 'HYDRA Audio Engine • Interactive Selection' });

      const responseMsg = await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      // Await selection
      const collector = responseMsg.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === interaction.user.id,
        time: 60_000,
      });

      collector.on('collect', async (selectInteraction) => {
        const chosenIndex = parseInt(selectInteraction.values[0], 10);
        const chosenTrack = results[chosenIndex];

        if (!chosenTrack) {
          return selectInteraction.reply({
            content: `${theme.emojis.error} Selection invalid or expired.`,
            ephemeral: true,
          });
        }

        await selectInteraction.deferUpdate();

        // Get or create player
        const player = await musicManager.getOrCreatePlayer({
          client: interaction.client,
          guild: interaction.guild,
          voiceChannel,
          textChannel: interaction.channel,
        });

        const isPlaying = Boolean(player.queue.current);
        player.queue.add(chosenTrack);

        const confirmEmbed = chosenTrack.toAddedEmbed(
          isPlaying ? 'Track Added to Queue' : 'Now Playing',
          isPlaying ? player.queue.tracks.length : null
        );

        // Edit original search message to show confirmed choice and remove dropdown
        await interaction.editReply({ embeds: [confirmEmbed], components: [] });

        if (!isPlaying) {
          await player.play();
        }

        collector.stop('selected');
      });

      collector.on('end', async (_, reason) => {
        if (reason !== 'selected') {
          await interaction.editReply({ components: [] }).catch(() => {});
        }
      });
    } catch (err) {
      logger.error('Error in /search command:', err);
      return interaction.editReply({
        embeds: [theme.createErrorEmbed(`Search error: ${err.message}`)],
      });
    }
  },
};

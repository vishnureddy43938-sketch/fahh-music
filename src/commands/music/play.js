const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const sourceManager = require('../../music/SourceManager');
const database = require('../../database/Database');
const { checkVoicePermissions } = require('../../utils/permissions');
const theme = require('../../utils/theme');
const { formatDuration, truncate } = require('../../utils/formatters');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a track, search query, or playlist from supported sources')
    .addStringOption((option) =>
      option
        .setName('query')
        .setDescription('Song title, artist name, or URL (YouTube, SoundCloud, Spotify)')
        .setRequired(true)
    ),

  /**
   * Execute /play command
   * @param {import('discord.js').ChatInputCommandInteraction} interaction 
   */
  async execute(interaction) {
    const guildSettings = await database.getSettings(interaction.guildId);

    // Permission validation: User must be in a voice channel
    const check = checkVoicePermissions(interaction, {
      requireVoice: true,
      requireSameChannel: false, // will join user's channel if bot isn't in voice
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
      // 1. Get or create GuildPlayer
      const player = await musicManager.getOrCreatePlayer({
        client: interaction.client,
        guild: interaction.guild,
        voiceChannel,
        textChannel: interaction.channel,
      });

      // 2. Resolve query
      const result = await sourceManager.resolve(query, requester);

      if (!result || !result.tracks || result.tracks.length === 0) {
        return interaction.editReply({
          embeds: [theme.createErrorEmbed(`No playable tracks found for: "${query}". Try another query.`, 'Not Found')],
        });
      }

      // 3. Queue size limit check
      const currentQueueLen = player.queue.tracks.length;
      const maxLimit = guildSettings.max_queue_size || 500;
      if (currentQueueLen + result.tracks.length > maxLimit) {
        return interaction.editReply({
          embeds: [
            theme.createErrorEmbed(
              `Adding these tracks would exceed the maximum queue limit of ${maxLimit} songs.`,
              'Queue Limit Exceeded'
            ),
          ],
        });
      }

      const isAlreadyPlaying = Boolean(player.queue.current);

      // Handle Playlist vs Single Track
      if (result.type === 'playlist') {
        player.queue.add(result.tracks);

        const totalSec = result.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
        const embed = theme.createEmbed(theme.colors.primary)
          .setTitle(`${theme.emojis.music} Playlist Added to Queue`)
          .setDescription(`Added [**${truncate(result.playlistTitle || 'Playlist', 60)}**](${query})`)
          .setThumbnail(result.tracks[0]?.thumbnail)
          .addFields(
            { name: '🎵 Tracks Added', value: `${result.tracks.length}`, inline: true },
            { name: `${theme.emojis.time} Total Duration`, value: formatDuration(totalSec), inline: true },
            { name: '🔢 Queue Position', value: isAlreadyPlaying ? `#${currentQueueLen + 1}` : 'Now Playing', inline: true }
          )
          .setFooter({
            text: `Requested by ${requester.tag}`,
            iconURL: requester.avatarURL,
          });

        await interaction.editReply({ embeds: [embed] });
      } else {
        const track = result.tracks[0];
        player.queue.add(track);

        if (isAlreadyPlaying) {
          const embed = track.toAddedEmbed('Track Added to Queue', player.queue.tracks.length);
          await interaction.editReply({ embeds: [embed] });
        } else {
          const embed = theme.createEmbed(theme.colors.success)
            .setTitle(`${theme.emojis.play} Loading Track...`)
            .setDescription(`[**${truncate(track.title, 65)}**](${track.url})`)
            .setThumbnail(track.thumbnail);

          await interaction.editReply({ embeds: [embed] });
        }
      }

      // If nothing is playing, begin playback
      if (!isAlreadyPlaying) {
        await player.play();
      }
    } catch (err) {
      logger.error('Error in /play command:', err);
      return interaction.editReply({
        embeds: [theme.createErrorEmbed(`Failed to play track: ${err.message}`, 'Playback Error')],
      });
    }
  },
};

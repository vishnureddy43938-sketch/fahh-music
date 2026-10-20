const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../music/MusicManager');
const theme = require('../../utils/theme');
const { truncate } = require('../../utils/formatters');
const config = require('../../config');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Display lyrics for the current song or a search query')
    .addStringOption((option) =>
      option.setName('song').setDescription('Title and artist (optional, defaults to currently playing)')
    ),

  async execute(interaction) {
    await interaction.deferReply();

    let query = interaction.options.getString('song');
    const player = musicManager.getPlayer(interaction.guildId);

    if (!query) {
      if (player && player.queue.current) {
        // Clean title (remove (Official Video), [MV], etc.)
        query = player.queue.current.title
          .replace(/\[.*?\]|\(.*?\)|ft\..*|feat\..*/gi, '')
          .trim();
      } else {
        return interaction.editReply({
          embeds: [
            theme.createErrorEmbed(
              'No track is currently playing. Please provide a song name: `/lyrics <song>`.',
              'Song Required'
            ),
          ],
        });
      }
    }

    try {
      // Fetch lyrics from lyrics.ovh or Genius API
      const lyrics = await fetchLyrics(query);

      if (!lyrics || lyrics.trim().length === 0) {
        return interaction.editReply({
          embeds: [
            theme.createWarningEmbed(
              `Could not find lyrics for "${truncate(query, 45)}". Try searching with artist and title (e.g. \`/lyrics Adele - Hello\`).`,
              'Lyrics Not Found'
            ),
          ],
        });
      }

      // If lyrics exceed 4000 characters, truncate cleanly
      const maxLen = 4000;
      const displayLyrics = lyrics.length > maxLen ? `${lyrics.slice(0, maxLen - 50)}\n\n*...[Lyrics truncated]*` : lyrics;

      const embed = theme.createEmbed(theme.colors.secondary)
        .setTitle(`📜 Lyrics: ${truncate(query, 55)}`)
        .setDescription(displayLyrics)
        .setFooter({ text: 'HYDRA Lyrics Service' });

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('Error fetching lyrics:', err);
      return interaction.editReply({
        embeds: [theme.createErrorEmbed('An error occurred while fetching lyrics.')],
      });
    }
  },
};

/**
 * Fetch lyrics from public lyrics API or Genius API
 * @param {string} songQuery 
 * @returns {Promise<string|null>}
 */
async function fetchLyrics(songQuery) {
  try {
    // 1. Try public lyrics API (lyrics.ovh)
    // Attempt splitting into artist and title
    const parts = songQuery.split('-').map((s) => s.trim());
    if (parts.length >= 2) {
      const artist = encodeURIComponent(parts[0]);
      const title = encodeURIComponent(parts[1]);
      const res = await fetch(`https://api.lyrics.ovh/v1/${artist}/${title}`, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        if (data.lyrics) return data.lyrics;
      }
    }

    // 2. Fallback search
    const encoded = encodeURIComponent(songQuery);
    const searchRes = await fetch(`https://lrclib.net/api/search?q=${encoded}`, { signal: AbortSignal.timeout(6000) });
    if (searchRes.ok) {
      const items = await searchRes.json();
      if (Array.isArray(items) && items.length > 0) {
        const match = items.find((i) => i.plainLyrics) || items[0];
        if (match && match.plainLyrics) {
          return match.plainLyrics;
        }
      }
    }
  } catch (err) {
    logger.debug('Lyrics lookup notice:', err.message);
  }

  return null;
}

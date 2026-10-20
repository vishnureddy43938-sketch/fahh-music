const { formatDuration, truncate } = require('../utils/formatters');
const theme = require('../utils/theme');

/**
 * Standardized Track representation across all audio providers
 */
class Track {
  /**
   * @param {object} data
   * @param {string} data.title Track title
   * @param {string} data.author Artist or channel name
   * @param {string} data.url Canonical URL
   * @param {number} data.duration Duration in seconds
   * @param {string} [data.thumbnail] Cover art URL
   * @param {object} data.requester User who requested the track { id, username, tag, avatarURL }
   * @param {string} [data.source] 'youtube' | 'soundcloud' | 'spotify' | 'stream' | 'lavalink'
   * @param {boolean} [data.isLive] Whether the audio is a livestream
   * @param {string|function} [data.streamUrl] Stream URL or function returning a stream
   * @param {string|number} [data.views] View or play count
   */
  constructor(data) {
    this.title = data.title || 'Unknown Title';
    this.author = data.author || 'Unknown Artist';
    this.url = data.url || '';
    this.duration = Math.max(Number(data.duration) || 0, 0);
    this.durationFormatted = data.isLive ? 'LIVE' : formatDuration(this.duration);
    this.thumbnail = data.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60';
    this.requester = data.requester || { id: '', tag: 'Unknown', username: 'Unknown', avatarURL: '' };
    this.source = data.source || 'youtube';
    this.isLive = Boolean(data.isLive);
    this.streamUrl = data.streamUrl || null;
    this.views = data.views || null;
    this.addedAt = Date.now();
  }

  /**
   * Format track info for queues or lists
   * @param {number} [index] Optional 1-based index
   * @returns {string}
   */
  toQueueString(index) {
    const prefix = index !== undefined ? `**${index}.** ` : '';
    const cleanTitle = truncate(this.title.replace(/[\[\]]/g, ''), 45);
    const duration = this.isLive ? '🔴 LIVE' : `\`${this.durationFormatted}\``;
    const req = this.requester.id ? `<@${this.requester.id}>` : this.requester.username;
    return `${prefix}[${cleanTitle}](${this.url}) • ${duration} • ${req}`;
  }

  /**
   * Create an embed representation for track addition
   * @param {string} [title='Track Added to Queue']
   * @param {number} [position] Queue position
   * @returns {import('discord.js').EmbedBuilder}
   */
  toAddedEmbed(title = 'Track Added to Queue', position = null) {
    const embed = theme.createEmbed(theme.colors.primary)
      .setTitle(`${theme.emojis.music} ${title}`)
      .setDescription(`[**${truncate(this.title, 65)}**](${this.url})`)
      .setThumbnail(this.thumbnail)
      .addFields(
        { name: `${theme.emojis.user} Artist`, value: truncate(this.author, 25), inline: true },
        { name: `${theme.emojis.time} Duration`, value: this.durationFormatted, inline: true }
      );

    if (position !== null && position !== undefined) {
      embed.addFields({ name: '🔢 Position in Queue', value: `#${position}`, inline: true });
    }

    if (this.requester.id) {
      embed.setFooter({
        text: `Requested by ${this.requester.tag || this.requester.username}`,
        iconURL: this.requester.avatarURL,
      });
    }

    return embed;
  }
}

module.exports = Track;

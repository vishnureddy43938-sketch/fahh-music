const { EmbedBuilder } = require('discord.js');

/**
 * HYDRA Brand Theme & Design System
 */
const theme = {
  colors: {
    primary: 0x8A2BE2,    // Electric Purple / Neon Violet
    secondary: 0x00F0FF,  // Vibrant Cyan
    accent: 0x4361EE,     // Midnight Blue
    success: 0x00E676,    // Neon Emerald
    warning: 0xFFAB00,    // Amber Gold
    error: 0xFF1744,      // Electric Crimson
    dark: 0x12131C,       // Midnight Dark
  },

  emojis: {
    play: '▶️',
    pause: '⏸️',
    stop: '⏹️',
    skip: '⏭️',
    previous: '⏮️',
    repeatOff: '➡️',
    repeatTrack: '🔂',
    repeatQueue: '🔁',
    shuffle: '🔀',
    volume: '🔊',
    volumeLow: '🔉',
    volumeMute: '🔇',
    queue: '📜',
    music: '🎵',
    live: '🔴',
    time: '⏱️',
    user: '👤',
    sparkles: '✨',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    settings: '⚙️',
    channel: '🔊',
    disk: '💿',
  },

  footer: {
    text: 'HYDRA • High Fidelity Audio System',
  },

  /**
   * Create standard branded embed
   */
  createEmbed(color = theme.colors.primary) {
    return new EmbedBuilder()
      .setColor(color)
      .setFooter({ text: theme.footer.text });
  },

  /**
   * Create error embed
   */
  createErrorEmbed(message, title = 'Action Failed') {
    return new EmbedBuilder()
      .setColor(theme.colors.error)
      .setTitle(`${theme.emojis.error} ${title}`)
      .setDescription(message)
      .setFooter({ text: theme.footer.text })
      .setTimestamp();
  },

  /**
   * Create success embed
   */
  createSuccessEmbed(message, title = 'Success') {
    return new EmbedBuilder()
      .setColor(theme.colors.success)
      .setTitle(`${theme.emojis.success} ${title}`)
      .setDescription(message)
      .setFooter({ text: theme.footer.text })
      .setTimestamp();
  },

  /**
   * Create warning embed
   */
  createWarningEmbed(message, title = 'Notice') {
    return new EmbedBuilder()
      .setColor(theme.colors.warning)
      .setTitle(`${theme.emojis.warning} ${title}`)
      .setDescription(message)
      .setFooter({ text: theme.footer.text })
      .setTimestamp();
  },
};

module.exports = theme;

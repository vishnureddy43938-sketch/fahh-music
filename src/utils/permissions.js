const { PermissionFlagsBits } = require('discord.js');
const theme = require('./theme');

/**
 * Check if a guild member has administrative or DJ permissions
 * @param {import('discord.js').GuildMember} member 
 * @param {object} guildSettings 
 * @returns {boolean}
 */
function isDJOrAdmin(member, guildSettings = {}) {
  if (!member) return false;

  // Administrators and members with Manage Guild always bypass DJ checks
  if (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  ) {
    return true;
  }

  // If a DJ role is configured, check if member has it
  if (guildSettings.dj_role_id && member.roles.cache.has(guildSettings.dj_role_id)) {
    return true;
  }

  // If no DJ role is configured, default allows members
  return !guildSettings.dj_role_id;
}

/**
 * Validate that a member is in voice and optionally in the same voice channel as the bot
 * @param {import('discord.js').ChatInputCommandInteraction|import('discord.js').ButtonInteraction} interaction 
 * @param {object} options
 * @param {boolean} options.requireVoice Must the user be in any voice channel? (default true)
 * @param {boolean} options.requireSameChannel Must the user share the bot's voice channel? (default true)
 * @param {boolean} options.requireDJ Must the user have DJ / Admin permissions? (default false)
 * @param {object} options.guildSettings Server settings from database
 * @returns {{ valid: boolean, errorEmbed?: import('discord.js').EmbedBuilder }}
 */
function checkVoicePermissions(interaction, options = {}) {
  const {
    requireVoice = true,
    requireSameChannel = true,
    requireDJ = false,
    guildSettings = {},
  } = options;

  const member = interaction.member;
  const guild = interaction.guild;
  if (!member || !guild) {
    return {
      valid: false,
      errorEmbed: theme.createErrorEmbed('This command can only be used within a server.'),
    };
  }

  // Check channel restriction if configured
  if (
    guildSettings.bot_channel_id &&
    interaction.channelId !== guildSettings.bot_channel_id &&
    !member.permissions.has(PermissionFlagsBits.ManageGuild)
  ) {
    return {
      valid: false,
      errorEmbed: theme.createErrorEmbed(
        `Music commands are restricted to <#${guildSettings.bot_channel_id}>.`,
        'Channel Restricted'
      ),
    };
  }

  const memberVoiceChannel = member.voice?.channel;

  // 1. Check if user is in a voice channel
  if (requireVoice && !memberVoiceChannel) {
    return {
      valid: false,
      errorEmbed: theme.createErrorEmbed(
        'You must be connected to a voice channel to use this command.',
        'Voice Channel Required'
      ),
    };
  }

  // 2. Check if bot is connected and whether user shares the same channel
  const botVoiceChannel = guild.members.me?.voice?.channel;
  if (requireSameChannel && botVoiceChannel && memberVoiceChannel?.id !== botVoiceChannel.id) {
    // If user is Admin, they can still control playback
    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      return {
        valid: false,
        errorEmbed: theme.createErrorEmbed(
          `You must be in the same voice channel as HYDRA (<#${botVoiceChannel.id}>) to control playback.`,
          'Different Voice Channel'
        ),
      };
    }
  }

  // 3. Check DJ requirement if specified
  if (requireDJ && !isDJOrAdmin(member, guildSettings)) {
    return {
      valid: false,
      errorEmbed: theme.createErrorEmbed(
        `You need the configured DJ role (<@&${guildSettings.dj_role_id}>) or Administrator permissions to perform this action.`,
        'DJ Permission Required'
      ),
    };
  }

  return { valid: true };
}

module.exports = {
  isDJOrAdmin,
  checkVoicePermissions,
};

const { Events } = require('discord.js');
const database = require('../database/Database');
const config = require('../config');
const theme = require('../utils/theme');
const logger = require('../utils/logger');

// Command aliases mapping for quick prefix commands
const ALIASES = {
  p: 'play',
  search: 'search',
  s: 'skip',
  next: 'skip',
  pause: 'pause',
  resume: 'resume',
  unpause: 'resume',
  stop: 'stop',
  q: 'queue',
  queue: 'queue',
  np: 'nowplaying',
  nowplaying: 'nowplaying',
  vol: 'volume',
  volume: 'volume',
  sh: 'shuffle',
  shuffle: 'shuffle',
  loop: 'loop',
  repeat: 'loop',
  prev: 'previous',
  previous: 'previous',
  seek: 'seek',
  rm: 'remove',
  remove: 'remove',
  mv: 'move',
  move: 'move',
  clear: 'clear',
  cls: 'clear',
  j: 'join',
  join: 'join',
  l: 'leave',
  leave: 'leave',
  dc: 'leave',
  disconnect: 'leave',
  ly: 'lyrics',
  lyrics: 'lyrics',
  247: '247',
  autoplay: 'autoplay',
  auto: 'autoplay',
  help: 'help',
  h: 'help',
  ping: 'ping',
  invite: 'invite',
  support: 'support',
  node: 'node',
  settings: 'settings',
  noprefix: 'noprefix',
};

/**
 * Adapter that provides a slash-command compatible interaction interface over a Discord Message
 */
class MessageCommandContext {
  constructor(message, args, commandName) {
    this.message = message;
    this.args = args;
    this.commandName = commandName;
    this.client = message.client;
    this.guild = message.guild;
    this.guildId = message.guild.id;
    this.channel = message.channel;
    this.channelId = message.channel.id;
    this.member = message.member;
    this.user = message.author;
    this.author = message.author;
    this.createdTimestamp = message.createdTimestamp;

    this.deferred = false;
    this.replied = false;
    this.replyMessage = null;

    // Simulate SlashCommand options getter
    this.options = {
      getString: (name) => {
        if (name === 'query' || name === 'song' || name === 'timestamp') {
          return this.args.join(' ') || null;
        }
        if (name === 'command') return this.args[0] || null;
        if (name === 'mode') return this.args[0] || null;
        if (name === 'action' || name === 'scope') return this.args[1] || null;
        return this.args[0] || null;
      },
      getInteger: (name) => {
        if (name === 'level' || name === 'page' || name === 'position' || name === 'seconds') {
          const parsed = parseInt(this.args[0], 10);
          return isNaN(parsed) ? null : parsed;
        }
        if (name === 'from') {
          const parsed = parseInt(this.args[0], 10);
          return isNaN(parsed) ? null : parsed;
        }
        if (name === 'to') {
          const parsed = parseInt(this.args[1], 10);
          return isNaN(parsed) ? null : parsed;
        }
        return null;
      },
      getSubcommand: () => {
        return this.args[0]?.toLowerCase() || 'status';
      },
      getUser: () => {
        const mention = this.args[1]?.match(/^<@!?(\d+)>$/);
        const id = mention ? mention[1] : this.args[1];
        return id ? this.client.users.cache.get(id) || null : null;
      },
      getRole: () => null,
      getChannel: () => null,
    };
  }

  isChatInputCommand() {
    return true; // allows re-using existing slash command handlers directly
  }

  async deferReply() {
    this.deferred = true;
    await this.channel.sendTyping().catch(() => {});
    return this;
  }

  async reply(options) {
    this.replied = true;
    const payload = typeof options === 'string' ? { content: options } : options;
    delete payload.ephemeral; // Messages don't support ephemeral flag
    this.replyMessage = await this.channel.send(payload);
    return this.replyMessage;
  }

  async editReply(options) {
    const payload = typeof options === 'string' ? { content: options } : options;
    delete payload.ephemeral;
    if (this.replyMessage) {
      return this.replyMessage.edit(payload);
    }
    this.replyMessage = await this.channel.send(payload);
    return this.replyMessage;
  }
}

module.exports = {
  name: Events.MessageCreate,

  /**
   * @param {import('discord.js').Message} message 
   */
  async execute(message) {
    if (!message || message.author.bot || !message.guild) return;

    const content = message.content.trim();
    if (!content) return;

    const prefix = config.prefix; // default '.'
    const mentionRegex = new RegExp(`^<@!?${message.client.user.id}>`);
    const isMention = mentionRegex.test(content);
    let commandText = '';

    if (isMention) {
      commandText = content.replace(mentionRegex, '').trim();
      // If user only mentioned the bot with no text, send help tip
      if (!commandText) {
        const infoEmbed = theme.createEmbed(theme.colors.primary)
          .setTitle(`${theme.emojis.music} HYDRA High Fidelity Audio`)
          .setDescription(`Hey <@${message.author.id}>! My prefix in this server is \`${prefix}\`.\nYou can stream music using \`${prefix}play <query>\` or slash commands like \`/play\`.`)
          .setFooter({ text: `Type ${prefix}help to see all available commands.` });
        return message.channel.send({ embeds: [infoEmbed] }).catch(() => {});
      }
    } else if (content.startsWith(prefix)) {
      commandText = content.slice(prefix.length).trim();
    } else {
      // Check if user has No-Prefix (NP) access
      const isNPUser = await database.isNP(message.author.id, message.guild.id);
      if (!isNPUser) return; // Not an NP user, ignore message without prefix
      commandText = content;
    }

    if (!commandText) return;

    const parts = commandText.split(/\s+/);
    const rawCmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Resolve command name from alias or raw name
    const resolvedName = ALIASES[rawCmd] || rawCmd;
    const command = message.client.commands.get(resolvedName);

    if (!command) return;

    try {
      logger.debug(
        `[Prefix Command] .${resolvedName} executed by ${message.author.tag} (${message.author.id}) in guild ${message.guild.id}`
      );
      const context = new MessageCommandContext(message, args, resolvedName);
      await command.execute(context, args);
    } catch (err) {
      logger.error(`Error executing prefix command .${resolvedName}:`, err);
      const errorEmbed = theme.createErrorEmbed(
        `An error occurred while executing \`${prefix}${resolvedName}\`.`,
        'Command Error'
      );
      message.channel.send({ embeds: [errorEmbed] }).catch(() => {});
    }
  },
};

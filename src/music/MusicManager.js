const { joinVoiceChannel, entersState, VoiceConnectionStatus, getVoiceConnection } = require('@discordjs/voice');
const GuildPlayer = require('./GuildPlayer');
const LavalinkNodeManager = require('./LavalinkNodeManager');
const database = require('../database/Database');
const { checkVoicePermissions } = require('../utils/permissions');
const theme = require('../utils/theme');
const { truncate, formatDuration } = require('../utils/formatters');
const logger = require('../utils/logger');
const { RepeatMode } = require('./Queue');

class MusicManager {
  constructor() {
    this.players = new Map(); // guildId -> GuildPlayer
    this.creationLocks = new Set(); // guildId mutex
    this.lavalink = LavalinkNodeManager;
  }

  /**
   * Initialize manager and backends
   * @param {import('discord.js').Client} [client]
   */
  async init(client) {
    if (client) {
      await LavalinkNodeManager.init(client);
    }
    logger.info('MusicManager initialized with dual audio engine support');
  }

  /**
   * Check if a guild has an active player
   * @param {string} guildId 
   * @returns {boolean}
   */
  hasPlayer(guildId) {
    return this.players.has(guildId);
  }

  /**
   * Get existing player for a guild
   * @param {string} guildId 
   * @returns {GuildPlayer|null}
   */
  getPlayer(guildId) {
    return this.players.get(guildId) || null;
  }

  /**
   * Create or retrieve active player for a guild
   * Uses lock to prevent multiple simultaneous players in the same server
   * @param {object} options
   * @param {import('discord.js').Client} options.client
   * @param {import('discord.js').Guild} options.guild
   * @param {import('discord.js').VoiceBasedChannel} options.voiceChannel
   * @param {import('discord.js').TextBasedChannel} options.textChannel
   * @returns {Promise<GuildPlayer>}
   */
  async getOrCreatePlayer({ client, guild, voiceChannel, textChannel }) {
    if (this.players.has(guild.id)) {
      const existing = this.players.get(guild.id);
      if (textChannel && textChannel.id) {
        existing.textChannelId = textChannel.id;
      }
      return existing;
    }

    // Concurrency lock check
    if (this.creationLocks.has(guild.id)) {
      // Wait for existing creation lock to clear
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (this.players.has(guild.id)) {
        return this.players.get(guild.id);
      }
    }

    this.creationLocks.add(guild.id);

    let voiceConnection = getVoiceConnection(guild.id);

    try {
      if (!voiceConnection || voiceConnection.state.status === VoiceConnectionStatus.Destroyed) {
        logger.info(`[Guild ${guild.id}] Joining voice channel: "${voiceChannel.name}" (${voiceChannel.id})`);

        voiceConnection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: true,
        });
      } else if (voiceConnection.joinConfig.channelId !== voiceChannel.id) {
        voiceConnection.rejoin({
          channelId: voiceChannel.id,
          selfDeaf: true,
          selfMute: false,
        });
      }

      // Wait until connection is ready
      if (voiceConnection.state.status !== VoiceConnectionStatus.Ready) {
        await entersState(voiceConnection, VoiceConnectionStatus.Ready, 20_000);
      }

      const player = new GuildPlayer({
        client,
        guildId: guild.id,
        voiceChannelId: voiceChannel.id,
        textChannelId: textChannel.id,
        voiceConnection,
        manager: this,
      });

      // Load server volume setting
      const settings = await database.getSettings(guild.id);
      if (settings.default_volume) {
        player.setVolume(settings.default_volume);
      }

      this.players.set(guild.id, player);
      return player;
    } catch (err) {
      if (voiceConnection && voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) {
        try {
          voiceConnection.destroy();
        } catch (e) {}
      }
      throw err;
    } finally {
      this.creationLocks.delete(guild.id);
    }
  }

  /**
   * Remove player reference from active map
   * @param {string} guildId 
   */
  removePlayer(guildId) {
    this.players.delete(guildId);
  }

  /**
   * Route interactive button clicks from Now Playing action rows
   * @param {import('discord.js').ButtonInteraction} interaction 
   * @param {GuildPlayer} player 
   */
  async handleButtonInteraction(interaction, player) {
    if (!interaction.isButton()) return;

    const guildSettings = await database.getSettings(interaction.guildId);

    // Permission validation: User must be in same voice channel
    const check = checkVoicePermissions(interaction, {
      requireVoice: true,
      requireSameChannel: true,
      requireDJ: ['hydra_btn_stop', 'hydra_btn_loop'].includes(interaction.customId),
      guildSettings,
    });

    if (!check.valid) {
      return interaction.reply({ embeds: [check.errorEmbed], ephemeral: true }).catch(() => {});
    }

    try {
      switch (interaction.customId) {
        case 'hydra_btn_pause_resume': {
          if (player.audioPlayer.state.status === 'playing') {
            player.pause();
            await interaction.reply({
              content: `${theme.emojis.pause} Playback paused by <@${interaction.user.id}>.`,
              ephemeral: true,
            });
          } else {
            player.resume();
            await interaction.reply({
              content: `${theme.emojis.play} Playback resumed by <@${interaction.user.id}>.`,
              ephemeral: true,
            });
          }
          break;
        }

        case 'hydra_btn_skip': {
          await player.skip();
          await interaction.reply({
            content: `${theme.emojis.skip} Track skipped by <@${interaction.user.id}>.`,
            ephemeral: true,
          });
          break;
        }

        case 'hydra_btn_prev': {
          const success = await player.previous();
          if (success) {
            await interaction.reply({
              content: `${theme.emojis.previous} Playing previous track requested by <@${interaction.user.id}>.`,
              ephemeral: true,
            });
          } else {
            await interaction.reply({
              content: `${theme.emojis.warning} No previous tracks in history.`,
              ephemeral: true,
            });
          }
          break;
        }

        case 'hydra_btn_stop': {
          player.stop();
          await interaction.reply({
            content: `${theme.emojis.stop} Playback stopped and queue cleared by <@${interaction.user.id}>.`,
            ephemeral: true,
          });
          break;
        }

        case 'hydra_btn_loop': {
          let nextMode = RepeatMode.OFF;
          if (player.queue.repeatMode === RepeatMode.OFF) {
            nextMode = RepeatMode.TRACK;
          } else if (player.queue.repeatMode === RepeatMode.TRACK) {
            nextMode = RepeatMode.QUEUE;
          } else {
            nextMode = RepeatMode.OFF;
          }

          player.queue.setRepeatMode(nextMode);
          player.sendOrUpdateNowPlaying().catch(() => {});

          await interaction.reply({
            content: `${theme.emojis.repeatQueue} Loop mode set to **${player.queue.getRepeatModeString()}** by <@${interaction.user.id}>.`,
            ephemeral: true,
          });
          break;
        }

        case 'hydra_btn_volup': {
          const newVol = player.setVolume(player.volume + 10);
          await interaction.reply({
            content: `${theme.emojis.volume} Volume set to **${newVol}%** by <@${interaction.user.id}>.`,
            ephemeral: true,
          });
          break;
        }

        case 'hydra_btn_voldown': {
          const newVol = player.setVolume(player.volume - 10);
          await interaction.reply({
            content: `${theme.emojis.volumeLow} Volume set to **${newVol}%** by <@${interaction.user.id}>.`,
            ephemeral: true,
          });
          break;
        }

        case 'hydra_btn_shuffle': {
          if (player.queue.tracks.length < 2) {
            return interaction.reply({
              content: `${theme.emojis.warning} Not enough tracks in queue to shuffle.`,
              ephemeral: true,
            });
          }
          player.queue.shuffle();
          await interaction.reply({
            content: `${theme.emojis.shuffle} Shuffled **${player.queue.tracks.length}** upcoming tracks.`,
            ephemeral: true,
          });
          break;
        }

        case 'hydra_btn_queue': {
          const upcoming = player.queue.tracks.slice(0, 5);
          if (upcoming.length === 0) {
            return interaction.reply({
              content: `${theme.emojis.queue} The queue is currently empty after the current track.`,
              ephemeral: true,
            });
          }

          const description = upcoming.map((t, idx) => t.toQueueString(idx + 1)).join('\n');
          const previewEmbed = theme.createEmbed(theme.colors.secondary)
            .setTitle(`${theme.emojis.queue} Queue Preview (Top 5)`)
            .setDescription(description)
            .setFooter({ text: `Total: ${player.queue.tracks.length} tracks • ${formatDuration(player.queue.totalDuration())}` });

          await interaction.reply({ embeds: [previewEmbed], ephemeral: true });
          break;
        }

        default:
          break;
      }
    } catch (err) {
      logger.error('Error in handleButtonInteraction:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: `${theme.emojis.error} An error occurred while processing button interaction.`,
          ephemeral: true,
        }).catch(() => {});
      }
    }
  }

  /**
   * Destroy all players on application shutdown
   */
  destroyAll() {
    logger.info(`Shutting down all active guild players (${this.players.size})...`);
    for (const player of this.players.values()) {
      try {
        player.destroy();
      } catch (err) {
        logger.error(`Error destroying player for guild ${player.guildId}:`, err);
      }
    }
    this.players.clear();
  }
}

module.exports = new MusicManager();

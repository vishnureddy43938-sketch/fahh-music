const {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  createAudioPlayer,
  NoSubscriberBehavior,
} = require('@discordjs/voice');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { Queue, RepeatMode } = require('./Queue');
const SourceManager = require('./SourceManager');
const database = require('../database/Database');
const theme = require('../utils/theme');
const { formatDuration, createProgressBar, truncate } = require('../utils/formatters');
const logger = require('../utils/logger');
const config = require('../config');

class GuildPlayer {
  /**
   * @param {object} options
   * @param {import('discord.js').Client} options.client
   * @param {string} options.guildId
   * @param {string} options.voiceChannelId
   * @param {string} options.textChannelId
   * @param {import('@discordjs/voice').VoiceConnection} options.voiceConnection
   * @param {import('./MusicManager')} options.manager
   */
  constructor({ client, guildId, voiceChannelId, textChannelId, voiceConnection, manager }) {
    this.client = client;
    this.guildId = guildId;
    this.voiceChannelId = voiceChannelId;
    this.textChannelId = textChannelId;
    this.voiceConnection = voiceConnection;
    this.manager = manager;

    this.queue = new Queue();
    this.volume = config.bot.defaultVolume;
    this.currentResource = null;
    this.activeProcess = null;
    this.playbackStartTime = null;
    this.seekOffset = 0;
    this.idleTimer = null;
    this.isDestroyed = false;

    // Active Now Playing message
    this.nowPlayingMessage = null; // { channelId, messageId }
    this.nowPlayingCollector = null;

    // Create AudioPlayer
    this.audioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
        maxMissedFrames: 50,
      },
    });

    this.voiceConnection.subscribe(this.audioPlayer);
    this._setupEventListeners();
  }

  /**
   * Attach audio and voice connection listeners
   * @private
   */
  _setupEventListeners() {
    // When track finishes playing
    this.audioPlayer.on(AudioPlayerStatus.Idle, async () => {
      logger.debug(`[Guild ${this.guildId}] AudioPlayer status became Idle`);
      this._cleanupCurrentStream();
      await this.handleTrackEnd();
    });

    // When audio error occurs
    this.audioPlayer.on('error', (err) => {
      logger.error(`[Guild ${this.guildId}] Player error:`, err);
      this._sendChannelAlert(theme.createErrorEmbed(`Audio playback error: ${err.message}`, 'Player Error'));
      this.handleTrackEnd();
    });

    // Voice Connection monitoring
    this.voiceConnection.on(VoiceConnectionStatus.Disconnected, async () => {
      logger.warn(`[Guild ${this.guildId}] Voice connection disconnected. Attempting to reconnect...`);
      try {
        await Promise.race([
          entersState(this.voiceConnection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch (e) {
        logger.warn(`[Guild ${this.guildId}] Voice reconnect failed. Destroying player.`);
        this.destroy();
      }
    });

    this.voiceConnection.on(VoiceConnectionStatus.Destroyed, () => {
      if (!this.isDestroyed) {
        this.destroy();
      }
    });
  }

  /**
   * Start playback of current queue
   * @param {boolean} [isSeek=false]
   * @returns {Promise<void>}
   */
  async play(isSeek = false) {
    if (this.isDestroyed) return;

    this.clearIdleTimer();

    // If seeking, we replay the current track at seekOffset
    let track = this.queue.current;

    if (!isSeek) {
      this.seekOffset = 0;
      track = this.queue.next();
    }

    // If queue is exhausted
    if (!track) {
      return this._handleQueueExhausted();
    }

    try {
      logger.info(`[Guild ${this.guildId}] Starting playback: "${track.title}" (Seek: ${this.seekOffset}s)`);
      const { resource, process } = await SourceManager.getAudioResource(track, this.seekOffset);

      this.currentResource = resource;
      this.activeProcess = process || null;
      this.playbackStartTime = Date.now() - (this.seekOffset * 1000);

      // Apply volume (clamped between 1% and 150%)
      if (resource.volume) {
        resource.volume.setVolume(this.volume / 100);
      }

      this.audioPlayer.play(resource);

      // Send or update Now Playing embed
      await this.sendOrUpdateNowPlaying();
    } catch (err) {
      logger.error(`[Guild ${this.guildId}] Playback initiation failed for "${track.title}":`, err);
      this._sendChannelAlert(
        theme.createErrorEmbed(
          `Could not stream **${truncate(track.title, 50)}**: ${err.message}\nSkipping to next track...`,
          'Playback Error'
        )
      );

      // Advance to next track on failure
      await this.handleTrackEnd();
    }
  }

  /**
   * Called when a track ends naturally or via skip
   */
  async handleTrackEnd() {
    if (this.isDestroyed) return;
    this.seekOffset = 0;
    await this.play();
  }

  /**
   * Handles when queue has no more tracks to play
   * @private
   */
  async _handleQueueExhausted() {
    const settings = await database.getSettings(this.guildId);

    // If Autoplay is enabled, find recommendation
    if (settings.autoplay_enabled || this.queue.autoplay) {
      const lastTrack = this.queue.history[0];
      if (lastTrack) {
        const botRequester = {
          id: this.client.user.id,
          username: 'HYDRA Autoplay',
          tag: 'HYDRA#0000',
          avatarURL: this.client.user.displayAvatarURL(),
        };

        const autoTrack = await SourceManager.getAutoplayTrack(lastTrack, botRequester);
        if (autoTrack) {
          logger.info(`[Guild ${this.guildId}] Autoplay queued: "${autoTrack.title}"`);
          this.queue.add(autoTrack);
          return this.play();
        }
      }
    }

    // Disable controls on old Now Playing message
    await this.disableNowPlayingControls();

    // Send Queue Finished notification
    this._sendChannelAlert(
      theme.createEmbed(theme.colors.accent)
        .setTitle('Queue Finished')
        .setDescription('All tracks in the queue have finished playing. Add more songs using `/play`!')
    );

    // If 24/7 mode is active, do not disconnect
    if (settings.mode_247) {
      logger.info(`[Guild ${this.guildId}] 24/7 mode enabled; remaining in voice channel.`);
      return;
    }

    // Start idle disconnect countdown
    const timeoutSec = settings.idle_timeout || config.bot.defaultIdleTimeout;
    this.startIdleTimer(timeoutSec);
  }

  /**
   * Pause current playback
   */
  pause() {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Playing) {
      this.audioPlayer.pause();
      this.sendOrUpdateNowPlaying().catch(() => {});
      return true;
    }
    return false;
  }

  /**
   * Resume paused playback
   */
  resume() {
    if (this.audioPlayer.state.status === AudioPlayerStatus.Paused) {
      this.audioPlayer.unpause();
      this.sendOrUpdateNowPlaying().catch(() => {});
      return true;
    }
    return false;
  }

  /**
   * Skip current track
   */
  async skip() {
    this._cleanupCurrentStream();
    this.audioPlayer.stop(); // triggers AudioPlayerStatus.Idle -> handleTrackEnd
    return true;
  }

  /**
   * Replay previous track from history
   */
  async previous() {
    const prev = this.queue.previous();
    if (!prev) return false;

    this._cleanupCurrentStream();
    await this.play();
    return true;
  }

  /**
   * Stop playback, clear queue, and leave or idle
   */
  stop() {
    this.queue.clear();
    this.queue.current = null;
    this._cleanupCurrentStream();
    this.audioPlayer.stop();
    this.disableNowPlayingControls().catch(() => {});

    // Check 24/7 mode
    database.getSettings(this.guildId).then((settings) => {
      if (!settings.mode_247) {
        this.destroy();
      }
    });

    return true;
  }

  /**
   * Seek to specific second in current track
   * @param {number} seconds 
   */
  async seek(seconds) {
    if (!this.queue.current) return false;
    const clamped = Math.min(Math.max(seconds, 0), this.queue.current.duration || 3600);
    this.seekOffset = clamped;
    this._cleanupCurrentStream();
    await this.play(true);
    return true;
  }

  /**
   * Set playback volume
   * @param {number} level 1 to 150
   */
  setVolume(level) {
    const clamped = Math.min(Math.max(parseInt(level, 10) || 100, 1), 150);
    this.volume = clamped;
    if (this.currentResource && this.currentResource.volume) {
      this.currentResource.volume.setVolume(clamped / 100);
    }
    this.sendOrUpdateNowPlaying().catch(() => {});
    return clamped;
  }

  /**
   * Calculate current playback elapsed time in ms
   * @returns {number}
   */
  getPlaybackPosition() {
    if (!this.playbackStartTime) return 0;
    if (this.audioPlayer.state.status === AudioPlayerStatus.Paused) {
      return (this.currentResource?.playbackDuration || 0) + (this.seekOffset * 1000);
    }
    return Math.max(Date.now() - this.playbackStartTime, 0);
  }

  /**
   * Generate Now Playing embed and action rows
   * @returns {{ embed: import('discord.js').EmbedBuilder, components: import('discord.js').ActionRowBuilder[] }}
   */
  buildNowPlayingMessage() {
    const track = this.queue.current;
    if (!track) {
      return {
        embed: theme.createEmbed(theme.colors.dark).setTitle('Nothing Playing'),
        components: [],
      };
    }

    const currentMs = this.getPlaybackPosition();
    const totalMs = (track.duration || 0) * 1000;
    const isPaused = this.audioPlayer.state.status === AudioPlayerStatus.Paused;

    // Progress bar
    const progressBar = track.isLive
      ? '🔴 LIVE STREAM'
      : `${createProgressBar(currentMs, totalMs, 14)} \`[${formatDuration(currentMs, true)} / ${track.durationFormatted}]\``;

    const embed = theme.createEmbed(theme.colors.primary)
      .setAuthor({ name: 'HYDRA • Now Playing', iconURL: this.client.user.displayAvatarURL() })
      .setTitle(truncate(track.title, 65))
      .setURL(track.url)
      .setThumbnail(track.thumbnail)
      .setDescription(progressBar)
      .addFields(
        { name: `${theme.emojis.user} Artist`, value: truncate(track.author, 25), inline: true },
        { name: `${theme.emojis.volume} Volume`, value: `${this.volume}%`, inline: true },
        { name: `${theme.emojis.repeatQueue} Loop`, value: this.queue.getRepeatModeString(), inline: true },
        { name: '🗂️ Upcoming Tracks', value: `${this.queue.tracks.length} track(s)`, inline: true },
        { name: '👤 Requester', value: track.requester.id ? `<@${track.requester.id}>` : track.requester.username, inline: true },
        { name: '📡 Source', value: track.source.toUpperCase(), inline: true }
      );

    // Primary Playback Controls Row
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('hydra_btn_prev')
        .setEmoji(theme.emojis.previous)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(this.queue.history.length === 0),
      new ButtonBuilder()
        .setCustomId('hydra_btn_pause_resume')
        .setEmoji(isPaused ? theme.emojis.play : theme.emojis.pause)
        .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('hydra_btn_skip')
        .setEmoji(theme.emojis.skip)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('hydra_btn_stop')
        .setEmoji(theme.emojis.stop)
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('hydra_btn_loop')
        .setEmoji(this.queue.repeatMode === RepeatMode.TRACK ? theme.emojis.repeatTrack : theme.emojis.repeatQueue)
        .setStyle(this.queue.repeatMode !== RepeatMode.OFF ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    // Secondary Audio Controls Row
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('hydra_btn_voldown')
        .setEmoji(theme.emojis.volumeLow)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('hydra_btn_volup')
        .setEmoji(theme.emojis.volume)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('hydra_btn_shuffle')
        .setEmoji(theme.emojis.shuffle)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(this.queue.tracks.length < 2),
      new ButtonBuilder()
        .setCustomId('hydra_btn_queue')
        .setEmoji(theme.emojis.queue)
        .setStyle(ButtonStyle.Secondary)
    );

    return { embed, components: [row1, row2] };
  }

  /**
   * Send new Now Playing message or update existing one to avoid chat spam
   */
  async sendOrUpdateNowPlaying() {
    if (this.isDestroyed || !this.queue.current) return;

    const { embed, components } = this.buildNowPlayingMessage();
    const settings = await database.getSettings(this.guildId);
    const targetChannelId = settings.announce_channel_id || this.textChannelId;
    const channel = this.client.channels.cache.get(targetChannelId);

    if (!channel) return;

    try {
      // If we have an active now playing message in the same channel, try to update it
      if (this.nowPlayingMessage && this.nowPlayingMessage.channelId === targetChannelId) {
        const msg = await channel.messages.fetch(this.nowPlayingMessage.messageId).catch(() => null);
        if (msg) {
          await msg.edit({ embeds: [embed], components });
          return;
        }
      }

      // Otherwise send new message and attach interaction collector
      const newMsg = await channel.send({ embeds: [embed], components });
      this.nowPlayingMessage = { channelId: targetChannelId, messageId: newMsg.id };
      this._attachMessageCollector(newMsg);
    } catch (err) {
      logger.debug(`Could not update Now Playing message in channel ${targetChannelId}:`, err.message);
    }
  }

  /**
   * Attach button collector to the Now Playing message
   * @private
   */
  _attachMessageCollector(message) {
    if (this.nowPlayingCollector) {
      this.nowPlayingCollector.stop('replaced');
    }

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 600_000, // 10 minutes
    });

    collector.on('collect', async (interaction) => {
      await this.manager.handleButtonInteraction(interaction, this);
    });

    collector.on('end', () => {
      this.disableNowPlayingControls().catch(() => {});
    });

    this.nowPlayingCollector = collector;
  }

  /**
   * Disable buttons when track or player stops
   */
  async disableNowPlayingControls() {
    if (!this.nowPlayingMessage) return;

    try {
      const channel = this.client.channels.cache.get(this.nowPlayingMessage.channelId);
      if (!channel) return;

      const msg = await channel.messages.fetch(this.nowPlayingMessage.messageId).catch(() => null);
      if (msg && msg.components && msg.components.length > 0) {
        const disabledRows = msg.components.map((row) => {
          const newRow = ActionRowBuilder.from(row);
          newRow.components.forEach((btn) => btn.setDisabled(true));
          return newRow;
        });

        await msg.edit({ components: disabledRows }).catch(() => {});
      }
    } catch (err) {
      logger.debug('Error disabling now playing controls:', err.message);
    }
  }

  /**
   * Start idle disconnect countdown
   * @param {number} seconds 
   */
  startIdleTimer(seconds = 180) {
    this.clearIdleTimer();
    logger.info(`[Guild ${this.guildId}] Started idle disconnect timer for ${seconds}s`);

    this.idleTimer = setTimeout(() => {
      logger.info(`[Guild ${this.guildId}] Idle disconnect timer expired. Leaving voice channel.`);
      this._sendChannelAlert(
        theme.createWarningEmbed(
          `HYDRA disconnected from the voice channel after being inactive for ${seconds} seconds.`,
          'Inactivity Timeout'
        )
      );
      this.destroy();
    }, seconds * 1000);
  }

  /**
   * Cancel any pending idle disconnect timer
   */
  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Helper to send notification embed to text channel
   * @private
   */
  _sendChannelAlert(embed) {
    const channel = this.client.channels.cache.get(this.textChannelId);
    if (channel) {
      channel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  /**
   * Kill any running FFmpeg child process
   * @private
   */
  _cleanupCurrentStream() {
    if (this.activeProcess) {
      try {
        this.activeProcess.kill('SIGKILL');
      } catch (e) {}
      this.activeProcess = null;
    }
  }

  /**
   * Clean up and destroy player
   */
  destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    logger.info(`[Guild ${this.guildId}] Destroying GuildPlayer`);
    this.clearIdleTimer();
    this._cleanupCurrentStream();

    if (this.nowPlayingCollector) {
      this.nowPlayingCollector.stop('destroyed');
      this.nowPlayingCollector = null;
    }

    this.disableNowPlayingControls().catch(() => {});

    try {
      this.audioPlayer.stop(true);
    } catch (e) {}

    try {
      if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) {
        this.voiceConnection.destroy();
      }
    } catch (e) {}

    this.queue.destroy();
    this.manager.removePlayer(this.guildId);
  }
}

module.exports = GuildPlayer;

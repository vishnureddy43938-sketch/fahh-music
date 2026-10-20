const { LavalinkManager } = require('lavalink-client');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Centralized Lavalink Node Manager for HYDRA
 */
class LavalinkNodeManager {
  constructor() {
    this.client = null;
    this.manager = null;
    this.isReady = false;
    this.connectionState = 'DISCONNECTED'; // 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR'
    this.serverVersion = null;
    this.lastError = null;
    this.lastDisconnectReason = null;
    this.nodeStats = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Initialize LavalinkManager and configure the Lava Lenin node
   * @param {import('discord.js').Client} client 
   */
  async init(client) {
    if (this.manager) {
      logger.debug('LavalinkManager already instantiated.');
      return;
    }

    this.client = client;

    // Verify NODE_AUTH before attempting connection
    if (!config.lavalink.auth || config.lavalink.auth.trim() === '') {
      this.connectionState = 'ERROR';
      this.lastError = 'NODE_AUTH is missing in .env. Connection prevented until configured.';
      logger.warn(
        `[Lavalink] Node "${config.lavalink.name}" cannot connect: Missing NODE_AUTH credential in environment variables. HYDRA direct audio engine will serve playback.`
      );
      return;
    }

    try {
      this.connectionState = 'CONNECTING';

      // Instantiate lavalink-client LavalinkManager
      this.manager = new LavalinkManager({
        nodes: [
          {
            id: config.lavalink.name,
            host: config.lavalink.host,
            port: config.lavalink.port,
            authorization: config.lavalink.auth,
            secure: config.lavalink.secure,
            retryAmount: 5,
            retryDelay: 10_000,
          },
        ],
        sendToShard: (guildId, payload) => {
          const guild = client.guilds.cache.get(guildId);
          if (guild && guild.shard) {
            guild.shard.send(payload);
          } else if (client.ws.shards.has(0)) {
            client.ws.shards.get(0).send(payload);
          }
        },
        client: {
          id: client.user?.id || config.discord.clientId,
          username: client.user?.username || 'HYDRA',
        },
        autoSkip: true,
        playerOptions: {
          clientBasedPositionUpdateInterval: 150,
          defaultSearchPlatform: 'scsearch',
          volumeDecrementer: 1,
        },
      });

      this._setupEventListeners();

      // Hook raw websocket packets for voice state syncing
      client.on('raw', (data) => {
        this.manager.sendRawData(data);
      });

      // Initiate node connection
      await this.manager.init(client.user || { id: config.discord.clientId });
      logger.info(`[Lavalink] Node manager initiated for "${config.lavalink.name}" at ${config.lavalink.host}:${config.lavalink.port}`);
    } catch (err) {
      this.connectionState = 'ERROR';
      this.lastError = err.message || 'Initialization error';
      logger.error(`[Lavalink] Failed to initialize LavalinkManager:`, err.message);
    }
  }

  /**
   * Setup listeners on NodeManager and LavalinkManager
   * @private
   */
  _setupEventListeners() {
    if (!this.manager) return;

    // Node Lifecycle Events
    this.manager.nodeManager.on('connect', (node) => {
      this.isReady = true;
      this.connectionState = 'CONNECTED';
      this.lastError = null;
      this.reconnectAttempts = 0;
      logger.info(`[Lavalink] Node "${node.id}" connected and ready (${node.options.host}:${node.options.port})`);

      // Try fetching version via info if supported
      node.fetchInfo().then((info) => {
        if (info && info.version) {
          this.serverVersion = `${info.version.semver || info.version.major + '.' + info.version.minor} (Build: ${info.buildTime || 'N/A'})`;
        }
      }).catch(() => {});
    });

    this.manager.nodeManager.on('disconnect', (node, reason) => {
      this.isReady = false;
      this.connectionState = 'DISCONNECTED';
      this.lastDisconnectReason = reason?.reason || reason?.code || 'Remote host closed connection';
      logger.warn(`[Lavalink] Node "${node.id}" disconnected: ${this.lastDisconnectReason}`);
    });

    this.manager.nodeManager.on('error', (node, error) => {
      this.lastError = error.message;
      if (this.connectionState !== 'CONNECTED') {
        this.connectionState = 'ERROR';
      }
      logger.error(`[Lavalink] Node "${node.id}" error:`, error.message);
    });

    this.manager.nodeManager.on('reconnecting', (node) => {
      this.connectionState = 'CONNECTING';
      this.reconnectAttempts++;
      logger.info(`[Lavalink] Node "${node.id}" reconnecting (Attempt ${this.reconnectAttempts})...`);
    });

    // Player events
    this.manager.on('trackError', (player, track, payload) => {
      logger.error(`[Lavalink Player] Track error in guild ${player.guildId}:`, payload);
    });

    this.manager.on('trackStuck', (player, track, payload) => {
      logger.warn(`[Lavalink Player] Track stuck in guild ${player.guildId}:`, payload);
      player.skip();
    });
  }

  /**
   * Whether the Lavalink node is currently online and ready for playback
   * @returns {boolean}
   */
  isNodeAvailable() {
    return this.isReady && this.connectionState === 'CONNECTED';
  }

  /**
   * Search and load tracks using Lavalink API
   * @param {string} query Search terms or URL
   * @param {object} requester 
   * @returns {Promise<any>}
   */
  async search(query, requester) {
    if (!this.isNodeAvailable() || !this.manager) {
      throw new Error('Lavalink node is not connected.');
    }

    return this.manager.search(query, requester);
  }

  /**
   * Get or create a Lavalink player for a guild
   * @param {object} options
   * @param {string} options.guildId
   * @param {string} options.voiceChannelId
   * @param {string} options.textChannelId
   */
  createPlayer(options) {
    if (!this.isNodeAvailable() || !this.manager) {
      throw new Error('Lavalink node is not available to create a player.');
    }

    return this.manager.createPlayer({
      guildId: options.guildId,
      voiceChannelId: options.voiceChannelId,
      textChannelId: options.textChannelId,
      selfDeaf: true,
      selfMute: false,
    });
  }

  /**
   * Retrieve active player for a guild
   * @param {string} guildId 
   */
  getPlayer(guildId) {
    return this.manager?.getPlayer(guildId) || null;
  }

  /**
   * Destroy player for a guild
   * @param {string} guildId 
   */
  destroyPlayer(guildId) {
    const player = this.getPlayer(guildId);
    if (player) {
      player.destroy();
    }
  }

  /**
   * Retrieve safe diagnostics information (NEVER exposes password or secrets)
   * @returns {object}
   */
  getDiagnostics() {
    const node = this.manager?.nodeManager?.nodes?.get(config.lavalink.name);
    const activePlayers = this.manager?.players?.size || 0;

    return {
      name: config.lavalink.name,
      endpoint: `${config.lavalink.host}:${config.lavalink.port}`,
      secure: config.lavalink.secure,
      state: this.connectionState,
      isAvailable: this.isNodeAvailable(),
      version: this.serverVersion || (this.isNodeAvailable() ? 'Lavalink v4' : 'Unknown'),
      activePlayers,
      stats: node?.stats || null,
      lastError: this.lastError,
      lastDisconnectReason: this.lastDisconnectReason,
      reconnectAttempts: this.reconnectAttempts,
      hasAuthSet: Boolean(config.lavalink.auth && config.lavalink.auth.trim() !== ''),
    };
  }
}

// Export singleton
module.exports = new LavalinkNodeManager();

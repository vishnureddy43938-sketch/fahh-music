const logger = require('../utils/logger');
const config = require('../config');

/**
 * Optional Lavalink Adapter for high-scale enterprise deployments
 */
class LavalinkAdapter {
  constructor() {
    this.enabled = config.lavalink.enabled;
    this.host = config.lavalink.host;
    this.port = config.lavalink.port;
    this.password = config.lavalink.password;
    this.secure = config.lavalink.secure;
    this.isConnected = false;
    this.nodes = [];
  }

  /**
   * Initialize Lavalink connection if enabled
   */
  async init() {
    if (!this.enabled) {
      logger.info('Lavalink is disabled. Using HYDRA direct audio engine.');
      return;
    }

    try {
      logger.info(`Connecting to Lavalink server at ${this.host}:${this.port}...`);
      // When Lavalink is enabled, we check connectivity to Lavalink REST API v4
      const protocol = this.secure ? 'https' : 'http';
      const response = await fetch(`${protocol}://${this.host}:${this.port}/version`, {
        headers: { Authorization: this.password },
      }).catch((e) => null);

      if (response && response.ok) {
        const version = await response.text();
        this.isConnected = true;
        logger.info(`Lavalink connected successfully (Server Version: ${version.trim()})`);
      } else {
        logger.warn('Lavalink server did not respond. HYDRA direct audio engine will handle playback.');
        this.isConnected = false;
      }
    } catch (err) {
      logger.warn('Lavalink connection error:', err.message);
      this.isConnected = false;
    }
  }

  /**
   * Search or load tracks via Lavalink REST API
   * @param {string} identifier 
   * @returns {Promise<any>}
   */
  async loadTracks(identifier) {
    if (!this.isConnected) return null;

    try {
      const protocol = this.secure ? 'https' : 'http';
      const url = `${protocol}://${this.host}:${this.port}/v4/loadtracks?identifier=${encodeURIComponent(identifier)}`;
      const res = await fetch(url, {
        headers: { Authorization: this.password },
      });

      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      logger.error('Lavalink loadTracks error:', err);
      return null;
    }
  }
}

module.exports = new LavalinkAdapter();

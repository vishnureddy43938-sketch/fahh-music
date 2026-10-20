const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const logger = require('../utils/logger');
const config = require('../config');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.cache = new Map(); // guildId -> settings
    this.isReady = false;
  }

  /**
   * Initialize SQLite database and tables
   * @param {string} [dbPath] Custom path (useful for testing)
   * @returns {Promise<void>}
   */
  async init(dbPath = config.database.path) {
    if (this.isReady && this.db) return;

    // Ensure parent directory exists if using a file path
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          logger.error('Failed to connect to SQLite database:', err);
          return reject(err);
        }

        logger.info(`Connected to SQLite database at ${dbPath}`);
        this._createTables()
          .then(() => {
            this.isReady = true;
            resolve();
          })
          .catch(reject);
      });
    });
  }

  /**
   * Run SQL with promises
   * @private
   */
  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  /**
   * Get single row with promises
   * @private
   */
  _get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Get all rows with promises
   * @private
   */
  _all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Setup database schema
   * @private
   */
  async _createTables() {
    // Guild Settings table
    await this._run(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        dj_role_id TEXT DEFAULT NULL,
        announce_channel_id TEXT DEFAULT NULL,
        bot_channel_id TEXT DEFAULT NULL,
        default_volume INTEGER DEFAULT 100,
        idle_timeout INTEGER DEFAULT 180,
        mode_247 INTEGER DEFAULT 0,
        autoplay_enabled INTEGER DEFAULT 0,
        max_queue_size INTEGER DEFAULT 500,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // User saved playlists
    await this._run(`
      CREATE TABLE IF NOT EXISTS user_playlists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        tracks_json TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // No-Prefix (NP) Authorized Users
    await this._run(`
      CREATE TABLE IF NOT EXISTS np_users (
        user_id TEXT NOT NULL,
        guild_id TEXT DEFAULT NULL,
        granted_by TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(user_id, guild_id)
      )
    `);

    logger.info('Database schema verified successfully');
  }

  /**
   * Get settings for a guild, with memory cache and default fallback
   * @param {string} guildId 
   * @returns {Promise<object>}
   */
  async getSettings(guildId) {
    if (!guildId) return this._getDefaultSettings('');

    if (this.cache.has(guildId)) {
      return this.cache.get(guildId);
    }

    try {
      const row = await this._get('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId]);
      if (row) {
        const formatted = {
          guild_id: row.guild_id,
          dj_role_id: row.dj_role_id,
          announce_channel_id: row.announce_channel_id,
          bot_channel_id: row.bot_channel_id,
          default_volume: row.default_volume ?? config.bot.defaultVolume,
          idle_timeout: row.idle_timeout ?? config.bot.defaultIdleTimeout,
          mode_247: Boolean(row.mode_247),
          autoplay_enabled: Boolean(row.autoplay_enabled),
          max_queue_size: row.max_queue_size ?? config.bot.maxQueueSize,
        };
        this.cache.set(guildId, formatted);
        return formatted;
      }

      // If no row, create and insert defaults
      const defaults = this._getDefaultSettings(guildId);
      await this.setSettings(guildId, defaults);
      return defaults;
    } catch (err) {
      logger.error(`Error retrieving settings for guild ${guildId}:`, err);
      return this._getDefaultSettings(guildId);
    }
  }

  /**
   * Insert or update guild settings
   * @param {string} guildId 
   * @param {object} updates 
   * @returns {Promise<object>}
   */
  async setSettings(guildId, updates) {
    if (!guildId) throw new Error('Guild ID is required');

    const current = this.cache.get(guildId) || this._getDefaultSettings(guildId);
    const merged = { ...current, ...updates, guild_id: guildId };

    const sql = `
      INSERT INTO guild_settings (
        guild_id, dj_role_id, announce_channel_id, bot_channel_id,
        default_volume, idle_timeout, mode_247, autoplay_enabled, max_queue_size, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
      ON CONFLICT(guild_id) DO UPDATE SET
        dj_role_id = excluded.dj_role_id,
        announce_channel_id = excluded.announce_channel_id,
        bot_channel_id = excluded.bot_channel_id,
        default_volume = excluded.default_volume,
        idle_timeout = excluded.idle_timeout,
        mode_247 = excluded.mode_247,
        autoplay_enabled = excluded.autoplay_enabled,
        max_queue_size = excluded.max_queue_size,
        updated_at = excluded.updated_at
    `;

    await this._run(sql, [
      guildId,
      merged.dj_role_id || null,
      merged.announce_channel_id || null,
      merged.bot_channel_id || null,
      merged.default_volume,
      merged.idle_timeout,
      merged.mode_247 ? 1 : 0,
      merged.autoplay_enabled ? 1 : 0,
      merged.max_queue_size,
    ]);

    this.cache.set(guildId, merged);
    return merged;
  }

  /**
   * Reset guild settings to defaults
   * @param {string} guildId 
   * @returns {Promise<object>}
   */
  async resetSettings(guildId) {
    await this._run('DELETE FROM guild_settings WHERE guild_id = ?', [guildId]);
    this.cache.delete(guildId);
    return this.getSettings(guildId);
  }

  /**
   * Internal default settings object
   * @private
   */
  _getDefaultSettings(guildId) {
    return {
      guild_id: guildId,
      dj_role_id: null,
      announce_channel_id: null,
      bot_channel_id: null,
      default_volume: config.bot.defaultVolume,
      idle_timeout: config.bot.defaultIdleTimeout,
      mode_247: false,
      autoplay_enabled: false,
      max_queue_size: config.bot.maxQueueSize,
    };
  }

  /**
   * Check if a user has No-Prefix (NP) access (global or guild-specific)
   * The bot owner always has global NP access
   * @param {string} userId 
   * @param {string} [guildId] 
   * @returns {Promise<boolean>}
   */
  async isNP(userId, guildId = null) {
    if (!userId) return false;

    // Configured bot owner always has global NP authorization
    if (String(userId) === String(config.ownerId)) {
      return true;
    }

    try {
      // Check for global NP or guild-specific NP
      const sql = guildId
        ? 'SELECT 1 FROM np_users WHERE user_id = ? AND (guild_id IS NULL OR guild_id = ?) LIMIT 1'
        : 'SELECT 1 FROM np_users WHERE user_id = ? AND guild_id IS NULL LIMIT 1';
      const params = guildId ? [userId, guildId] : [userId];
      const row = await this._get(sql, params);
      return Boolean(row);
    } catch (err) {
      logger.error('Error checking NP status:', err);
      return false;
    }
  }

  /**
   * Grant No-Prefix access to a user
   * @param {string} userId 
   * @param {string|null} guildId null for global, or guild ID
   * @param {string} grantedBy Admin / Owner ID
   * @returns {Promise<boolean>}
   */
  async addNP(userId, guildId = null, grantedBy = '') {
    const sql = `
      INSERT INTO np_users (user_id, guild_id, granted_by, created_at)
      VALUES (?, ?, ?, strftime('%s', 'now'))
      ON CONFLICT(user_id, guild_id) DO UPDATE SET
        granted_by = excluded.granted_by,
        created_at = strftime('%s', 'now')
    `;
    await this._run(sql, [userId, guildId || null, grantedBy]);
    return true;
  }

  /**
   * Revoke No-Prefix access from a user
   * @param {string} userId 
   * @param {string|null} guildId null for global, or guild ID
   * @returns {Promise<boolean>}
   */
  async removeNP(userId, guildId = null) {
    const sql = guildId
      ? 'DELETE FROM np_users WHERE user_id = ? AND guild_id = ?'
      : 'DELETE FROM np_users WHERE user_id = ? AND guild_id IS NULL';
    const params = guildId ? [userId, guildId] : [userId];
    const res = await this._run(sql, params);
    return res.changes > 0;
  }

  /**
   * Get list of authorized NP users for a server or globally
   * @param {string|null} [guildId] 
   * @returns {Promise<Array<{ user_id: string, guild_id: string|null, granted_by: string, created_at: number }>>}
   */
  async getNPList(guildId = null) {
    const sql = guildId
      ? 'SELECT * FROM np_users WHERE guild_id = ? OR guild_id IS NULL ORDER BY created_at DESC'
      : 'SELECT * FROM np_users WHERE guild_id IS NULL ORDER BY created_at DESC';
    const params = guildId ? [guildId] : [];
    return this._all(sql, params);
  }

  /**
   * Close database connection
   */
  close() {
    return new Promise((resolve) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) logger.error('Error closing SQLite database:', err);
          this.isReady = false;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Singleton database instance
module.exports = new DatabaseManager();

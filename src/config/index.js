const path = require('node:path');
require('dotenv').config();
const { parseBoolean, parseLavalinkUrl } = require('../utils/configUtils');

// Parse node secure setting with strict validation
let isNodeSecure = false;
try {
  isNodeSecure = parseBoolean(process.env.NODE_SECURE || 'false', false);
} catch (e) {
  console.warn(`[WARN] Invalid NODE_SECURE value "${process.env.NODE_SECURE}". Defaulting to false.`);
  isNodeSecure = false;
}

// Parse node url
const rawNodeUrl = process.env.NODE_URL || 'noi6.visihost.in:25591';
let normalizedNode;
try {
  normalizedNode = parseLavalinkUrl(rawNodeUrl, isNodeSecure);
} catch (e) {
  normalizedNode = {
    host: 'noi6.visihost.in',
    port: 25591,
    secure: false,
    url: 'http://noi6.visihost.in:25591',
    rawEndpoint: 'noi6.visihost.in:25591',
  };
}

const config = {
  // Discord Application Credentials
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.CLIENT_ID || '',
    guildId: process.env.GUILD_ID || null,
  },

  // Owner & Prefix Settings
  ownerId: process.env.OWNER_ID || '1545399010444185681',
  prefix: process.env.BOT_PREFIX || '.',

  // Bot Information & Links
  bot: {
    name: 'HYDRA',
    version: '1.0.0',
    prefix: process.env.BOT_PREFIX || '.',
    supportServer: process.env.SUPPORT_SERVER_URL || 'https://discord.gg/U465TGfT9Z',
    inviteUrl: process.env.INVITE_URL || '',
    defaultVolume: Math.min(Math.max(parseInt(process.env.DEFAULT_VOLUME, 10) || 100, 1), 150),
    defaultIdleTimeout: Math.max(parseInt(process.env.DEFAULT_IDLE_TIMEOUT, 10) || 180, 10), // seconds
    maxQueueSize: Math.max(parseInt(process.env.MAX_QUEUE_SIZE, 10) || 500, 10),
  },

  // SQLite Database Path
  database: {
    path: process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'hydra.sqlite'),
  },

  // Lavalink Node Configuration
  lavalink: {
    name: process.env.NODE_NAME || 'Lava Lenin',
    url: rawNodeUrl,
    auth: process.env.NODE_AUTH || '',
    secure: isNodeSecure,
    host: normalizedNode.host,
    port: normalizedNode.port,
    normalizedUrl: normalizedNode.url,
  },

  // Optional Web Dashboard
  dashboard: {
    enabled: process.env.DASHBOARD_ENABLED === 'true',
    port: parseInt(process.env.DASHBOARD_PORT, 10) || 3000,
    url: process.env.DASHBOARD_URL || `http://localhost:${process.env.DASHBOARD_PORT || 3000}`,
    sessionSecret: process.env.SESSION_SECRET || 'hydra_default_session_secret_replace_in_prod',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    callbackUrl:
      process.env.DISCORD_CALLBACK_URL ||
      `http://localhost:${process.env.DASHBOARD_PORT || 3000}/api/auth/callback`,
  },

  // Third-party API keys
  apis: {
    genius: process.env.GENIUS_API_KEY || null,
  },

  /**
   * Validate that essential bot environment variables exist
   * @throws {Error} if critical variables are missing
   */
  validate() {
    const missing = [];
    if (!this.discord.token) missing.push('DISCORD_TOKEN');
    if (!this.discord.clientId) missing.push('CLIENT_ID');

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variable(s): ${missing.join(', ')}. Please check your .env file.`
      );
    }

    if (!this.lavalink.auth) {
      console.warn(
        `[WARN] NODE_AUTH is not set in .env. Lavalink node "${this.lavalink.name}" will not connect until configured. Internal audio engine remains active.`
      );
    }

    if (this.dashboard.enabled) {
      const missingDashboard = [];
      if (!this.dashboard.clientSecret) missingDashboard.push('DISCORD_CLIENT_SECRET');
      if (missingDashboard.length > 0) {
        console.warn(
          `[WARN] Dashboard is enabled but missing: ${missingDashboard.join(
            ', '
          )}. OAuth2 login may not work.`
        );
      }
    }
  },
};

module.exports = config;

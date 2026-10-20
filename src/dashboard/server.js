const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../config');
const database = require('../database/Database');
const musicManager = require('../music/MusicManager');
const logger = require('../utils/logger');
const { PermissionFlagsBits } = require('discord.js');

/**
 * Create and configure Express Dashboard server
 * @param {import('discord.js').Client} botClient 
 * @returns {express.Application}
 */
function createDashboardServer(botClient) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use(
    session({
      secret: config.dashboard.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.dashboard.url.startsWith('https'),
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // Serve static UI assets
  app.use(express.static(path.join(__dirname, 'public')));

  // ==========================================
  // DISCORD OAUTH2 AUTHENTICATION ROUTES
  // ==========================================

  // Step 1: Redirect user to Discord OAuth2
  app.get('/api/auth/login', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;

    const redirectUri = encodeURIComponent(config.dashboard.callbackUrl);
    const scope = encodeURIComponent('identify guilds');
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;

    res.redirect(authUrl);
  });

  // Step 2: Handle OAuth2 callback and token exchange
  app.get('/api/auth/callback', async (req, res) => {
    const { code, state } = req.query;

    if (!code || !state || state !== req.session.oauthState) {
      return res.status(400).send('OAuth2 state mismatch or missing authorization code.');
    }

    delete req.session.oauthState;

    try {
      // Exchange authorization code for access token
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.discord.clientId,
          client_secret: config.dashboard.clientSecret,
          grant_type: 'authorization_code',
          code: String(code),
          redirect_uri: config.dashboard.callbackUrl,
        }),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        logger.error('Failed to exchange OAuth token:', errorText);
        return res.status(400).send('Authentication failed with Discord.');
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Fetch user profile
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userData = await userRes.json();

      // Fetch user guilds
      const guildsRes = await fetch('https://discord.com/api/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userGuilds = await guildsRes.json();

      // Store in session
      req.session.user = {
        id: userData.id,
        username: userData.username,
        avatar: userData.avatar,
        discriminator: userData.discriminator,
      };
      req.session.guilds = Array.isArray(userGuilds) ? userGuilds : [];

      res.redirect('/');
    } catch (err) {
      logger.error('Error during OAuth callback:', err);
      res.status(500).send('Internal server error during authentication.');
    }
  });

  // Step 3: Get current authenticated user
  app.get('/api/auth/user', (req, res) => {
    if (!req.session.user) {
      return res.json({ authenticated: false });
    }
    res.json({ authenticated: true, user: req.session.user });
  });

  // Step 4: Logout
  app.get('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
      res.redirect('/');
    });
  });

  // ==========================================
  // GUILD & PLAYER MANAGEMENT API
  // ==========================================

  // Middleware to verify user session
  const requireAuth = (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    next();
  };

  // Get servers where user has Manage Guild or Administrator permission
  app.get('/api/guilds', requireAuth, (req, res) => {
    const userGuilds = req.session.guilds || [];
    const botGuilds = botClient.guilds.cache;

    const managedGuilds = userGuilds
      .filter((g) => {
        const permissions = BigInt(g.permissions);
        const hasManage = (permissions & PermissionFlagsBits.ManageGuild) === PermissionFlagsBits.ManageGuild;
        const hasAdmin = (permissions & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator;
        return hasManage || hasAdmin;
      })
      .map((g) => {
        const botGuild = botGuilds.get(g.id);
        const player = botGuild ? musicManager.getPlayer(g.id) : null;
        return {
          id: g.id,
          name: g.name,
          icon: g.icon,
          botInGuild: Boolean(botGuild),
          isPlaying: Boolean(player && player.queue.current),
        };
      });

    res.json(managedGuilds);
  });

  // Middleware to verify user manages the target guild
  const verifyGuildAccess = (req, res, next) => {
    const { id: guildId } = req.params;
    const userGuilds = req.session.guilds || [];

    const matched = userGuilds.find((g) => g.id === guildId);
    if (!matched) {
      return res.status(403).json({ error: 'You do not belong to this server.' });
    }

    const permissions = BigInt(matched.permissions);
    const hasManage = (permissions & PermissionFlagsBits.ManageGuild) === PermissionFlagsBits.ManageGuild;
    const hasAdmin = (permissions & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator;

    if (!hasManage && !hasAdmin) {
      return res.status(403).json({ error: 'You lack Manage Server permissions for this guild.' });
    }

    next();
  };

  // Get full status and settings for a specific guild
  app.get('/api/guilds/:id', requireAuth, verifyGuildAccess, async (req, res) => {
    const { id: guildId } = req.params;
    const botGuild = botClient.guilds.cache.get(guildId);

    if (!botGuild) {
      return res.json({
        botInGuild: false,
        inviteUrl: config.bot.inviteUrl || `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&scope=bot%20applications.commands`,
      });
    }

    const settings = await database.getSettings(guildId);
    const player = musicManager.getPlayer(guildId);

    // Fetch text and voice channels for settings dropdowns
    const textChannels = botGuild.channels.cache
      .filter((c) => c.isTextBased())
      .map((c) => ({ id: c.id, name: c.name }));

    const roles = botGuild.roles.cache
      .filter((r) => r.name !== '@everyone')
      .map((r) => ({ id: r.id, name: r.name, color: r.hexColor }));

    const playerStatus = player
      ? {
          isPlaying: Boolean(player.queue.current),
          isPaused: player.audioPlayer.state.status === 'paused',
          currentTrack: player.queue.current,
          upcomingTracks: player.queue.tracks.slice(0, 15),
          totalUpcoming: player.queue.tracks.length,
          volume: player.volume,
          repeatMode: player.queue.getRepeatModeString(),
          positionMs: player.getPlaybackPosition(),
          durationMs: (player.queue.current?.duration || 0) * 1000,
        }
      : null;

    res.json({
      botInGuild: true,
      guild: {
        id: botGuild.id,
        name: botGuild.name,
        icon: botGuild.iconURL(),
      },
      settings,
      player: playerStatus,
      channels: textChannels,
      roles,
    });
  });

  // Web playback controls (Pause, Resume, Skip, Stop, Volume)
  app.post('/api/guilds/:id/control', requireAuth, verifyGuildAccess, async (req, res) => {
    const { id: guildId } = req.params;
    const { action, value } = req.body;
    const player = musicManager.getPlayer(guildId);

    if (!player) {
      return res.status(400).json({ error: 'HYDRA is not currently playing in this server.' });
    }

    switch (action) {
      case 'pause':
        player.pause();
        return res.json({ success: true, message: 'Paused' });
      case 'resume':
        player.resume();
        return res.json({ success: true, message: 'Resumed' });
      case 'skip':
        await player.skip();
        return res.json({ success: true, message: 'Skipped' });
      case 'stop':
        player.stop();
        return res.json({ success: true, message: 'Stopped' });
      case 'volume':
        const newVol = player.setVolume(value);
        return res.json({ success: true, volume: newVol });
      default:
        return res.status(400).json({ error: 'Unknown playback control action' });
    }
  });

  // Update server settings via web dashboard
  app.post('/api/guilds/:id/settings', requireAuth, verifyGuildAccess, async (req, res) => {
    const { id: guildId } = req.params;
    const {
      dj_role_id,
      announce_channel_id,
      bot_channel_id,
      default_volume,
      idle_timeout,
      mode_247,
      autoplay_enabled,
    } = req.body;

    const updates = {};
    if (dj_role_id !== undefined) updates.dj_role_id = dj_role_id || null;
    if (announce_channel_id !== undefined) updates.announce_channel_id = announce_channel_id || null;
    if (bot_channel_id !== undefined) updates.bot_channel_id = bot_channel_id || null;
    if (default_volume !== undefined) updates.default_volume = Math.min(Math.max(Number(default_volume), 1), 150);
    if (idle_timeout !== undefined) updates.idle_timeout = Math.min(Math.max(Number(idle_timeout), 10), 3600);
    if (mode_247 !== undefined) updates.mode_247 = Boolean(mode_247);
    if (autoplay_enabled !== undefined) updates.autoplay_enabled = Boolean(autoplay_enabled);

    const updated = await database.setSettings(guildId, updates);
    res.json({ success: true, settings: updated });
  });

  // Fallback to index.html for Single Page App
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
}

/**
 * Start Express dashboard listener
 * @param {import('discord.js').Client} botClient 
 */
function startDashboard(botClient) {
  if (!config.dashboard.enabled) {
    logger.info('Web dashboard is disabled (DASHBOARD_ENABLED=false).');
    return null;
  }

  const app = createDashboardServer(botClient);
  const server = app.listen(config.dashboard.port, () => {
    logger.info(`HYDRA Web Dashboard running at http://localhost:${config.dashboard.port}`);
  });

  return server;
}

module.exports = {
  createDashboardServer,
  startDashboard,
};

const { createAudioResource, StreamType } = require('@discordjs/voice');
const { spawn } = require('node:child_process');
const play = require('play-dl');
const scdl = require('soundcloud-downloader').default;
const ffmpegPath = require('ffmpeg-static');
const Track = require('./Track');
const logger = require('../utils/logger');

class SourceManager {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize API tokens for audio services
   */
  async init() {
    if (this.isInitialized) return;

    try {
      // Initialize free SoundCloud client ID if needed
      const scClientId = await play.getFreeClientID().catch(() => null);
      if (scClientId) {
        await play.setToken({ soundcloud: { client_id: scClientId } }).catch(() => {});
      }

      this.isInitialized = true;
      logger.info('SourceManager initialized successfully');
    } catch (err) {
      logger.warn('SourceManager init notice (non-fatal):', err.message);
      this.isInitialized = true;
    }
  }

  /**
   * Determine query type and resolve one or more Track objects
   * @param {string} query Search text or URL
   * @param {object} requester User details { id, username, tag, avatarURL }
   * @returns {Promise<{ type: 'track'|'playlist', tracks: Track[], playlistTitle?: string }>}
   */
  async resolve(query, requester) {
    if (!this.isInitialized) await this.init();

    const trimmed = query.trim();
    const isUrl = /^https?:\/\//i.test(trimmed);

    if (isUrl) {
      return this._resolveUrl(trimmed, requester);
    }

    // Default to search
    return this._resolveSearch(trimmed, requester);
  }

  /**
   * Resolve an exact URL (Spotify, SoundCloud, YouTube, or Direct Audio Stream)
   * @private
   */
  async _resolveUrl(url, requester) {
    // 1. Spotify URL
    const spType = play.sp_validate(url);
    if (spType) {
      return this._resolveSpotify(url, spType, requester);
    }

    // 2. SoundCloud URL
    if (url.includes('soundcloud.com')) {
      return this._resolveSoundCloud(url, requester);
    }

    // 3. YouTube URL
    const ytType = play.yt_validate(url);
    if (ytType) {
      return this._resolveYouTube(url, ytType, requester);
    }

    // 4. Direct audio stream (mp3, ogg, wav, flac, etc.)
    if (/\.(mp3|wav|ogg|flac|aac|m4a|opus)(\?.*)?$/i.test(url) || url.includes('/stream') || url.includes('radio')) {
      const filename = url.split('/').pop().split('?')[0] || 'Web Audio Stream';
      const track = new Track({
        title: decodeURIComponent(filename),
        author: 'Direct Audio Stream',
        url: url,
        duration: 0,
        thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60',
        requester,
        source: 'stream',
        isLive: true,
      });

      return { type: 'track', tracks: [track] };
    }

    // Fallback: search the URL as query
    return this._resolveSearch(url, requester);
  }

  /**
   * Resolve Spotify links
   * @private
   */
  async _resolveSpotify(url, type, requester) {
    // Refresh token if expired
    if (play.is_expired()) {
      await play.refreshToken().catch(() => {});
    }

    const spData = await play.spotify(url);

    if (type === 'track') {
      const track = new Track({
        title: spData.name,
        author: spData.artists.map((a) => a.name).join(', '),
        url: spData.url || url,
        duration: Math.floor(spData.durationInSec),
        thumbnail: spData.thumbnail?.url,
        requester,
        source: 'spotify',
      });

      return { type: 'track', tracks: [track] };
    }

    // Playlist or Album
    const allTracks = await spData.all_tracks();
    const tracks = allTracks.map((item) => {
      return new Track({
        title: item.name,
        author: item.artists ? item.artists.map((a) => a.name).join(', ') : 'Various Artists',
        url: item.url || `https://open.spotify.com/track/${item.id}`,
        duration: Math.floor(item.durationInSec || 0),
        thumbnail: item.thumbnail?.url || spData.thumbnail?.url,
        requester,
        source: 'spotify',
      });
    });

    return {
      type: 'playlist',
      playlistTitle: spData.name || 'Spotify Playlist',
      tracks,
    };
  }

  /**
   * Resolve SoundCloud links
   * @private
   */
  async _resolveSoundCloud(url, requester) {
    try {
      const info = await scdl.getInfo(url);

      // Single track
      if (info.kind === 'track') {
        const track = new Track({
          title: info.title,
          author: info.user?.username || 'SoundCloud Artist',
          url: info.permalink_url || url,
          duration: Math.floor((info.duration || 0) / 1000),
          thumbnail: info.artwork_url || info.user?.avatar_url,
          requester,
          source: 'soundcloud',
        });

        return { type: 'track', tracks: [track] };
      }

      // Playlist / Set
      if (info.tracks && Array.isArray(info.tracks)) {
        const tracks = info.tracks.map((t) => {
          return new Track({
            title: t.title,
            author: t.user?.username || 'SoundCloud Artist',
            url: t.permalink_url || url,
            duration: Math.floor((t.duration || 0) / 1000),
            thumbnail: t.artwork_url || t.user?.avatar_url,
            requester,
            source: 'soundcloud',
          });
        });

        return {
          type: 'playlist',
          playlistTitle: info.title || 'SoundCloud Set',
          tracks,
        };
      }
    } catch (err) {
      logger.debug('SCDL getInfo failed, falling back to search:', err.message);
    }

    return this._resolveSearch(url, requester);
  }

  /**
   * Resolve YouTube links
   * @private
   */
  async _resolveYouTube(url, type, requester) {
    if (type === 'video') {
      try {
        const info = await play.video_basic_info(url);
        const details = info.video_details;
        const track = new Track({
          title: details.title,
          author: details.channel?.name || 'YouTube Creator',
          url: details.url || url,
          duration: details.durationInSec,
          thumbnail: details.thumbnails?.[0]?.url,
          requester,
          source: 'youtube',
          isLive: details.live,
        });

        return { type: 'track', tracks: [track] };
      } catch (err) {
        logger.debug('play.video_basic_info error, falling back to search:', err.message);
      }
    }

    if (type === 'playlist') {
      try {
        const playlist = await play.playlist_info(url, { incomplete: true });
        const videos = await playlist.all_videos();
        const tracks = videos.map((v) => {
          return new Track({
            title: v.title,
            author: v.channel?.name || 'YouTube Creator',
            url: v.url,
            duration: v.durationInSec,
            thumbnail: v.thumbnails?.[0]?.url,
            requester,
            source: 'youtube',
            isLive: v.live,
          });
        });

        return {
          type: 'playlist',
          playlistTitle: playlist.title || 'YouTube Playlist',
          tracks,
        };
      } catch (err) {
        logger.debug('play.playlist_info error:', err.message);
      }
    }

    return this._resolveSearch(url, requester);
  }

  /**
   * Search for tracks across SoundCloud and YouTube
   * @private
   */
  async _resolveSearch(query, requester) {
    const results = await this.search(query, requester, 1);
    if (results.length === 0) {
      throw new Error(`No matching tracks found for query: "${query}". Try another title or artist.`);
    }

    return { type: 'track', tracks: [results[0]] };
  }

  /**
   * Perform a multi-result search (e.g., for /search command)
   * @param {string} query 
   * @param {object} requester 
   * @param {number} [limit=10] 
   * @returns {Promise<Track[]>}
   */
  async search(query, requester, limit = 10) {
    if (!this.isInitialized) await this.init();

    // 1. Try SoundCloud search first (fastest and most reliable audio streaming)
    try {
      const scSearch = await scdl.search({ query, limit, filter: 'tracks' });
      if (scSearch && scSearch.collection && scSearch.collection.length > 0) {
        return scSearch.collection.slice(0, limit).map((item) => {
          return new Track({
            title: item.title || 'Unknown Title',
            author: item.user?.username || 'Unknown Artist',
            url: item.permalink_url,
            duration: Math.floor((item.duration || 0) / 1000),
            thumbnail: item.artwork_url || item.user?.avatar_url,
            requester,
            source: 'soundcloud',
          });
        });
      }
    } catch (err) {
      logger.debug('SoundCloud search returned error:', err.message);
    }

    // 2. Fallback to YouTube search via play-dl
    try {
      const ytResults = await play.search(query, { limit });
      if (ytResults && ytResults.length > 0) {
        return ytResults.map((v) => {
          return new Track({
            title: v.title || 'Unknown Title',
            author: v.channel?.name || 'Unknown Artist',
            url: v.url,
            duration: v.durationInSec || 0,
            thumbnail: v.thumbnails?.[0]?.url,
            requester,
            source: 'youtube',
            isLive: v.live,
          });
        });
      }
    } catch (err) {
      logger.debug('YouTube search returned error:', err.message);
    }

    return [];
  }

  /**
   * Extract playable audio stream for a track, supporting seeking via FFmpeg
   * @param {Track} track 
   * @param {number} [seekSeconds=0] 
   * @returns {Promise<{ resource: import('@discordjs/voice').AudioResource, process?: import('child_process').ChildProcess }>}
   */
  async getAudioResource(track, seekSeconds = 0) {
    let rawStream = null;

    // 1. SoundCloud tracks
    if (track.source === 'soundcloud') {
      try {
        rawStream = await scdl.download(track.url);
      } catch (err) {
        logger.warn(`SCDL download failed for ${track.url}:`, err.message);
      }
    }

    // 2. Spotify tracks -> search on SoundCloud to get high-res stream
    if (track.source === 'spotify' || (!rawStream && track.source !== 'stream')) {
      try {
        const searchQuery = `${track.title} ${track.author}`;
        const scSearch = await scdl.search({ query: searchQuery, limit: 1 });
        if (scSearch?.collection?.[0]?.permalink_url) {
          rawStream = await scdl.download(scSearch.collection[0].permalink_url);
        }
      } catch (err) {
        logger.debug('Spotify bridge lookup failed:', err.message);
      }
    }

    // 3. YouTube stream fallback via play-dl
    if (!rawStream && track.source === 'youtube') {
      try {
        const streamData = await play.stream(track.url);
        rawStream = streamData.stream;
      } catch (err) {
        logger.debug('play.stream failed:', err.message);
      }
    }

    // 4. Direct stream or fallback
    if (!rawStream && track.url) {
      // If direct audio URL, use FFmpeg with direct URL input
      const ffmpegArgs = [];
      if (seekSeconds > 0) {
        ffmpegArgs.push('-ss', String(seekSeconds));
      }
      ffmpegArgs.push(
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-i', track.url,
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
      );

      const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, { stdio: ['ignore', 'pipe', 'ignore'] });
      const resource = createAudioResource(ffmpegProcess.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });

      return { resource, process: ffmpegProcess };
    }

    if (!rawStream) {
      throw new Error(`Unable to extract playable audio stream for "${track.title}".`);
    }

    // Handle seeking with FFmpeg
    if (seekSeconds > 0) {
      const ffmpegArgs = [
        '-ss', String(seekSeconds),
        '-i', 'pipe:0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1',
      ];

      const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs, { stdio: ['pipe', 'pipe', 'ignore'] });
      rawStream.pipe(ffmpegProcess.stdin);

      rawStream.on('error', (err) => logger.debug('Input stream error:', err.message));
      ffmpegProcess.stdin.on('error', (err) => logger.debug('FFmpeg stdin error:', err.message));

      const resource = createAudioResource(ffmpegProcess.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });

      return { resource, process: ffmpegProcess };
    }

    // Direct streaming without seeking
    const resource = createAudioResource(rawStream, {
      inputType: StreamType.Arbitrary,
      inlineVolume: true,
    });

    return { resource };
  }

  /**
   * Search for an autoplay recommendation track
   * @param {Track} lastTrack 
   * @param {object} requester 
   * @returns {Promise<Track|null>}
   */
  async getAutoplayTrack(lastTrack, requester) {
    if (!lastTrack) return null;

    try {
      const query = `${lastTrack.author} - ${lastTrack.title}`;
      const results = await this.search(query, requester, 5);
      // Pick a track that is not identical in title
      const candidate = results.find(
        (t) => t.title.toLowerCase() !== lastTrack.title.toLowerCase()
      ) || results[0];

      return candidate || null;
    } catch (err) {
      logger.debug('Autoplay recommendation search failed:', err.message);
      return null;
    }
  }
}

// Export singleton
module.exports = new SourceManager();

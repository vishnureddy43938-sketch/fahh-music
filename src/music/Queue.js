const { formatDuration } = require('../utils/formatters');

/**
 * Repeat modes enum
 */
const RepeatMode = {
  OFF: 0,
  TRACK: 1,
  QUEUE: 2,
};

/**
 * High-performance thread-safe music queue with history and loop controls
 */
class Queue {
  constructor() {
    this.tracks = [];      // Upcoming tracks
    this.current = null;   // Active playing track
    this.history = [];     // Past tracks for /previous (max 25)
    this.repeatMode = RepeatMode.OFF;
    this.autoplay = false;
  }

  /**
   * Add a single track or array of tracks to the queue
   * @param {import('./Track')|import('./Track')[]} item 
   * @returns {number} New queue length
   */
  add(item) {
    if (Array.isArray(item)) {
      this.tracks.push(...item);
    } else if (item) {
      this.tracks.push(item);
    }
    return this.tracks.length;
  }

  /**
   * Advance the queue to the next track based on current repeat mode
   * @returns {import('./Track')|null} Next track to play
   */
  next() {
    // If repeat mode is TRACK and current track exists, replay it
    if (this.repeatMode === RepeatMode.TRACK && this.current) {
      return this.current;
    }

    // Save finished track to history
    if (this.current) {
      this.history.unshift(this.current);
      if (this.history.length > 25) {
        this.history.pop();
      }

      // If repeat mode is QUEUE, push finished track to the back of the queue
      if (this.repeatMode === RepeatMode.QUEUE) {
        this.tracks.push(this.current);
      }
    }

    // Shift next track from queue
    this.current = this.tracks.shift() || null;
    return this.current;
  }

  /**
   * Return to the previous track in history
   * @returns {import('./Track')|null}
   */
  previous() {
    if (this.history.length === 0) return null;

    // Put current song back at the front of upcoming tracks
    if (this.current) {
      this.tracks.unshift(this.current);
    }

    // Pop the most recent track from history
    this.current = this.history.shift() || null;
    return this.current;
  }

  /**
   * Remove a track at a specific 1-based index
   * @param {number} position 1-based index
   * @returns {import('./Track')|null} The removed track
   */
  remove(position) {
    const index = position - 1;
    if (index < 0 || index >= this.tracks.length) {
      return null;
    }
    const [removed] = this.tracks.splice(index, 1);
    return removed;
  }

  /**
   * Move a track from one position to another (1-based indices)
   * @param {number} fromPos 
   * @param {number} toPos 
   * @returns {boolean} Success status
   */
  move(fromPos, toPos) {
    const fromIndex = fromPos - 1;
    const toIndex = toPos - 1;

    if (
      fromIndex < 0 ||
      fromIndex >= this.tracks.length ||
      toIndex < 0 ||
      toIndex >= this.tracks.length ||
      fromIndex === toIndex
    ) {
      return false;
    }

    const [item] = this.tracks.splice(fromIndex, 1);
    this.tracks.splice(toIndex, 0, item);
    return true;
  }

  /**
   * True Fisher-Yates shuffle of upcoming tracks
   * @returns {void}
   */
  shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  /**
   * Clear all upcoming tracks (keeps current track playing)
   * @returns {number} Number of cleared tracks
   */
  clear() {
    const count = this.tracks.length;
    this.tracks = [];
    return count;
  }

  /**
   * Set loop / repeat mode
   * @param {number|string} mode 0/'off', 1/'track', 2/'queue'
   */
  setRepeatMode(mode) {
    if (typeof mode === 'string') {
      const lower = mode.toLowerCase();
      if (lower === 'track' || lower === 'song' || lower === '1') {
        this.repeatMode = RepeatMode.TRACK;
      } else if (lower === 'queue' || lower === 'all' || lower === '2') {
        this.repeatMode = RepeatMode.QUEUE;
      } else {
        this.repeatMode = RepeatMode.OFF;
      }
    } else if (typeof mode === 'number') {
      this.repeatMode = [RepeatMode.OFF, RepeatMode.TRACK, RepeatMode.QUEUE].includes(mode)
        ? mode
        : RepeatMode.OFF;
    }
    return this.repeatMode;
  }

  /**
   * Get human-readable repeat mode string
   * @returns {string}
   */
  getRepeatModeString() {
    switch (this.repeatMode) {
      case RepeatMode.TRACK:
        return 'Track (Loop Single)';
      case RepeatMode.QUEUE:
        return 'Queue (Loop All)';
      case RepeatMode.OFF:
      default:
        return 'Off';
    }
  }

  /**
   * Total duration of upcoming tracks in seconds
   * @returns {number}
   */
  totalDuration() {
    return this.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  }

  /**
   * Format queue into paginated arrays for embeds
   * @param {number} pageSize 
   * @returns {Array<{ page: number, totalPages: number, tracks: import('./Track')[], duration: string }>}
   */
  getPages(pageSize = 10) {
    if (this.tracks.length === 0) {
      return [];
    }

    const totalPages = Math.ceil(this.tracks.length / pageSize);
    const pages = [];

    for (let i = 0; i < totalPages; i++) {
      const slice = this.tracks.slice(i * pageSize, (i + 1) * pageSize);
      const pageDuration = slice.reduce((acc, t) => acc + (t.duration || 0), 0);
      pages.push({
        page: i + 1,
        totalPages,
        tracks: slice,
        startIndex: i * pageSize + 1,
        durationFormatted: formatDuration(pageDuration),
      });
    }

    return pages;
  }

  /**
   * Reset all state
   */
  destroy() {
    this.tracks = [];
    this.current = null;
    this.history = [];
    this.repeatMode = RepeatMode.OFF;
    this.autoplay = false;
  }
}

module.exports = {
  Queue,
  RepeatMode,
};

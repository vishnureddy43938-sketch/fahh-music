/**
 * Audio and Time Formatters for HYDRA
 */

/**
 * Format seconds or milliseconds into standard mm:ss or hh:mm:ss string
 * @param {number} input Duration in seconds or milliseconds
 * @param {boolean} isMs Whether the input is in milliseconds (default false)
 * @returns {string} Formatted duration (e.g., "03:45", "01:20:15")
 */
function formatDuration(input, isMs = false) {
  if (input === undefined || input === null || isNaN(input) || input < 0) {
    return '00:00';
  }

  const totalSeconds = Math.floor(isMs ? input / 1000 : input);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedMinutes = String(minutes).padStart(2, '0');
  const paddedSeconds = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const paddedHours = String(hours).padStart(2, '0');
    return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}

/**
 * Generate a graphical progress bar for audio playback
 * @param {number} currentMs Current playback position in ms
 * @param {number} totalMs Total track duration in ms
 * @param {number} length Number of segments in progress bar (default 15)
 * @returns {string} Progress bar string (e.g. "🔘═══════════════")
 */
function createProgressBar(currentMs, totalMs, length = 15) {
  if (!totalMs || totalMs <= 0 || isNaN(totalMs)) {
    return '🔘' + '═'.repeat(length - 1);
  }

  const progress = Math.min(Math.max(currentMs / totalMs, 0), 1);
  const activeIndex = Math.min(Math.floor(progress * length), length - 1);

  let bar = '';
  for (let i = 0; i < length; i++) {
    if (i === activeIndex) {
      bar += '🔘';
    } else {
      bar += '═';
    }
  }

  return bar;
}

/**
 * Parse a user input timestamp into seconds
 * Supports "90", "1:30", "01:30", "01:10:00", "90s", "2m", "1m30s"
 * @param {string} input 
 * @returns {number|null} Seconds or null if invalid
 */
function parseTime(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim().toLowerCase();

  // Pure digits: "90"
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }

  // Colon notation: "01:30" or "01:20:45"
  if (/^(\d{1,2}:)?\d{1,2}:\d{2}$/.test(str)) {
    const parts = str.split(':').map((p) => parseInt(p, 10));
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }

  // Unit notation: "1h 30m", "45s", "2m30s"
  let total = 0;
  let matched = false;

  const hoursMatch = str.match(/(\d+)\s*h/);
  if (hoursMatch) {
    total += parseInt(hoursMatch[1], 10) * 3600;
    matched = true;
  }

  const minutesMatch = str.match(/(\d+)\s*m/);
  if (minutesMatch) {
    total += parseInt(minutesMatch[1], 10) * 60;
    matched = true;
  }

  const secondsMatch = str.match(/(\d+)\s*s/);
  if (secondsMatch) {
    total += parseInt(secondsMatch[1], 10);
    matched = true;
  }

  return matched ? total : null;
}

/**
 * Truncate long strings safely for Discord embeds
 * @param {string} text 
 * @param {number} maxLength 
 * @returns {string}
 */
function truncate(text, maxLength = 60) {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

module.exports = {
  formatDuration,
  createProgressBar,
  parseTime,
  truncate,
};

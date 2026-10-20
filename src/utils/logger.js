/**
 * Structured Logger for HYDRA
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const currentLevel = process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

/**
 * Remove sensitive strings like tokens from output
 */
function sanitize(message) {
  if (typeof message !== 'string') return message;
  return message
    .replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}/g, '[REDACTED_DISCORD_TOKEN]')
    .replace(/(client_secret|password|secret)=([^&\s]+)/gi, '$1=[REDACTED]');
}

function timestamp() {
  return new Date().toISOString();
}

const logger = {
  debug(...args) {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.debug(`[${timestamp()}] [DEBUG]`, ...args.map(sanitize));
    }
  },

  info(...args) {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.log(`[${timestamp()}] [INFO]`, ...args.map(sanitize));
    }
  },

  warn(...args) {
    if (currentLevel <= LOG_LEVELS.WARN) {
      console.warn(`[${timestamp()}] [WARN]`, ...args.map(sanitize));
    }
  },

  error(...args) {
    if (currentLevel <= LOG_LEVELS.ERROR) {
      console.error(`[${timestamp()}] [ERROR]`, ...args.map((arg) => (arg instanceof Error ? arg.stack : sanitize(arg))));
    }
  },
};

module.exports = logger;

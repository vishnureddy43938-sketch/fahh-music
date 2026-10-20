/**
 * Configuration and URL parsing utilities for HYDRA
 */

/**
 * Case-insensitively parse boolean configuration strings
 * Strictly validates input and throws explicit errors on invalid values
 * @param {any} value Value to parse
 * @param {boolean} [defaultValue] Default boolean if value is undefined/null
 * @returns {boolean}
 * @throws {TypeError} If value cannot be parsed to a valid boolean
 */
function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') {
    if (defaultValue !== undefined) {
      return Boolean(defaultValue);
    }
    throw new TypeError('Boolean configuration value is missing or empty.');
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'true' || trimmed === '1' || trimmed === 'yes' || trimmed === 'on') {
      return true;
    }
    if (trimmed === 'false' || trimmed === '0' || trimmed === 'no' || trimmed === 'off') {
      return false;
    }
  }

  throw new TypeError(
    `Invalid boolean configuration value: "${value}". Expected "true" or "false".`
  );
}

/**
 * Normalize a Lavalink endpoint URL
 * Derives host, port, and scheme without duplicating schemes or altering ports
 * @param {string} rawUrl e.g. "noi6.visihost.in:25591" or "http://noi6.visihost.in:25591"
 * @param {boolean} secure Whether SSL / TLS is enabled
 * @returns {{ host: string, port: number, secure: boolean, url: string, rawEndpoint: string }}
 * @throws {TypeError} If URL format is invalid
 */
function parseLavalinkUrl(rawUrl, secure = false) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new TypeError('Lavalink URL must be a non-empty string.');
  }

  let cleaned = rawUrl.trim();

  // Strip existing protocol scheme to avoid duplicate schemes
  cleaned = cleaned.replace(/^(https?|wss?):\/\//i, '');
  // Remove trailing slashes
  cleaned = cleaned.replace(/\/+$/, '');

  const colonIndex = cleaned.lastIndexOf(':');
  let host = cleaned;
  let port = secure ? 443 : 2333;

  if (colonIndex > 0) {
    host = cleaned.slice(0, colonIndex);
    const parsedPort = parseInt(cleaned.slice(colonIndex + 1), 10);
    if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      throw new TypeError(`Invalid port specified in Lavalink URL: "${rawUrl}".`);
    }
    port = parsedPort;
  }

  if (!host) {
    throw new TypeError(`Invalid host in Lavalink URL: "${rawUrl}".`);
  }

  const scheme = secure ? 'https://' : 'http://';
  const fullUrl = `${scheme}${host}:${port}`;

  return {
    host,
    port,
    secure: Boolean(secure),
    url: fullUrl,
    rawEndpoint: `${host}:${port}`,
  };
}

module.exports = {
  parseBoolean,
  parseLavalinkUrl,
};

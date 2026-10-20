const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { parseBoolean, parseLavalinkUrl } = require('../src/utils/configUtils');
const database = require('../src/database/Database');
const lavalinkNodeManager = require('../src/music/LavalinkNodeManager');
const config = require('../src/config');

describe('Lavalink Configuration & Parser Tests', () => {
  test('parseBoolean should parse valid true strings case-insensitively', () => {
    assert.strictEqual(parseBoolean('true'), true);
    assert.strictEqual(parseBoolean('True'), true);
    assert.strictEqual(parseBoolean('TRUE'), true);
    assert.strictEqual(parseBoolean('1'), true);
    assert.strictEqual(parseBoolean('yes'), true);
    assert.strictEqual(parseBoolean('on'), true);
    assert.strictEqual(parseBoolean(true), true);
  });

  test('parseBoolean should parse valid false strings case-insensitively', () => {
    assert.strictEqual(parseBoolean('false'), false);
    assert.strictEqual(parseBoolean('False'), false);
    assert.strictEqual(parseBoolean('FALSE'), false);
    assert.strictEqual(parseBoolean('0'), false);
    assert.strictEqual(parseBoolean('no'), false);
    assert.strictEqual(parseBoolean('off'), false);
    assert.strictEqual(parseBoolean(false), false);
  });

  test('parseBoolean should reject invalid boolean configuration strings explicitly', () => {
    assert.throws(() => parseBoolean('invalid'), TypeError);
    assert.throws(() => parseBoolean('2'), TypeError);
    assert.throws(() => parseBoolean('maybe'), TypeError);
    assert.throws(() => parseBoolean(''), TypeError);
    assert.throws(() => parseBoolean(null), TypeError);
  });

  test('parseBoolean should respect default value when provided for missing input', () => {
    assert.strictEqual(parseBoolean(undefined, false), false);
    assert.strictEqual(parseBoolean(null, true), true);
    assert.strictEqual(parseBoolean('', false), false);
  });

  test('parseLavalinkUrl should correctly normalize host and port', () => {
    const parsed = parseLavalinkUrl('noi6.visihost.in:25591', false);
    assert.strictEqual(parsed.host, 'noi6.visihost.in');
    assert.strictEqual(parsed.port, 25591);
    assert.strictEqual(parsed.secure, false);
    assert.strictEqual(parsed.url, 'http://noi6.visihost.in:25591');
    assert.strictEqual(parsed.rawEndpoint, 'noi6.visihost.in:25591');
  });

  test('parseLavalinkUrl should derive https scheme when secure is true', () => {
    const parsed = parseLavalinkUrl('noi6.visihost.in:25591', true);
    assert.strictEqual(parsed.secure, true);
    assert.strictEqual(parsed.url, 'https://noi6.visihost.in:25591');
  });

  test('parseLavalinkUrl should strip existing protocols without duplication', () => {
    const parsedHttp = parseLavalinkUrl('http://noi6.visihost.in:25591', false);
    assert.strictEqual(parsedHttp.url, 'http://noi6.visihost.in:25591');

    const parsedWs = parseLavalinkUrl('ws://noi6.visihost.in:25591', false);
    assert.strictEqual(parsedWs.url, 'http://noi6.visihost.in:25591');

    const parsedWss = parseLavalinkUrl('wss://noi6.visihost.in:25591', true);
    assert.strictEqual(parsedWss.url, 'https://noi6.visihost.in:25591');
  });

  test('parseLavalinkUrl should reject invalid URLs and out of range ports', () => {
    assert.throws(() => parseLavalinkUrl('', false), TypeError);
    assert.throws(() => parseLavalinkUrl(null, false), TypeError);
    assert.throws(() => parseLavalinkUrl('host:999999', false), TypeError);
    assert.throws(() => parseLavalinkUrl('host:abc', false), TypeError);
  });
});

describe('No-Prefix (NP) Access & Owner Permission Tests', () => {
  before(async () => {
    await database.init(':memory:');
  });

  after(async () => {
    await database.close();
  });

  test('configured owner ID must always have permanent global NP access', async () => {
    const isOwnerNP = await database.isNP(config.ownerId, 'any_guild');
    assert.strictEqual(isOwnerNP, true);
    assert.strictEqual(String(config.ownerId), '1545399010444185681');
  });

  test('unauthorized user should not have NP access by default', async () => {
    const isUserNP = await database.isNP('regular_user_999', 'guild_1');
    assert.strictEqual(isUserNP, false);
  });

  test('should allow owner to grant and revoke global NP access', async () => {
    await database.addNP('user_global_1', null, config.ownerId);

    const isNPInGuildA = await database.isNP('user_global_1', 'guild_A');
    const isNPInGuildB = await database.isNP('user_global_1', 'guild_B');
    assert.strictEqual(isNPInGuildA, true);
    assert.strictEqual(isNPInGuildB, true);

    await database.removeNP('user_global_1', null);
    const isAfterRemoval = await database.isNP('user_global_1', 'guild_A');
    assert.strictEqual(isAfterRemoval, false);
  });

  test('should allow granting server-specific NP access', async () => {
    await database.addNP('user_server_1', 'guild_A', 'admin_123');

    const isNPInGuildA = await database.isNP('user_server_1', 'guild_A');
    const isNPInGuildB = await database.isNP('user_server_1', 'guild_B');
    assert.strictEqual(isNPInGuildA, true);
    assert.strictEqual(isNPInGuildB, false); // Not active in guild B
  });
});

describe('Node Diagnostics & Credential Protection Tests', () => {
  test('diagnostics must never expose password or authentication secrets', () => {
    const diag = lavalinkNodeManager.getDiagnostics();
    assert.strictEqual(diag.name, 'Lava Lenin');
    assert.strictEqual(diag.endpoint.includes('noi6.visihost.in:25591'), true);
    assert.strictEqual(typeof diag.hasAuthSet, 'boolean');

    // Verify password is not in diagnostics payload
    assert.strictEqual(diag.auth, undefined);
    assert.strictEqual(diag.password, undefined);
    assert.strictEqual(diag.authorization, undefined);
  });
});

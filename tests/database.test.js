const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const database = require('../src/database/Database');

describe('Database Tests', () => {
  before(async () => {
    // Initialize in-memory SQLite database for test isolation
    await database.init(':memory:');
  });

  after(async () => {
    await database.close();
  });

  test('should return default settings for a new guild', async () => {
    const settings = await database.getSettings('guild_123');
    assert.strictEqual(settings.guild_id, 'guild_123');
    assert.strictEqual(settings.default_volume, 100);
    assert.strictEqual(settings.idle_timeout, 180);
    assert.strictEqual(settings.mode_247, false);
    assert.strictEqual(settings.autoplay_enabled, false);
  });

  test('should update and persist guild settings', async () => {
    await database.setSettings('guild_123', {
      default_volume: 80,
      mode_247: true,
      dj_role_id: 'role_abc',
    });

    const updated = await database.getSettings('guild_123');
    assert.strictEqual(updated.default_volume, 80);
    assert.strictEqual(updated.mode_247, true);
    assert.strictEqual(updated.dj_role_id, 'role_abc');
  });

  test('should reset settings back to defaults', async () => {
    await database.resetSettings('guild_123');
    const reset = await database.getSettings('guild_123');
    assert.strictEqual(reset.default_volume, 100);
    assert.strictEqual(reset.mode_247, false);
    assert.strictEqual(reset.dj_role_id, null);
  });
});

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { isDJOrAdmin, checkVoicePermissions } = require('../src/utils/permissions');
const { PermissionFlagsBits } = require('discord.js');

describe('Permission System Tests', () => {
  function makeMockMember({ isAdmin = false, isManageGuild = false, roleIds = [] } = {}) {
    const bitfield =
      (isAdmin ? PermissionFlagsBits.Administrator : 0n) |
      (isManageGuild ? PermissionFlagsBits.ManageGuild : 0n);

    return {
      permissions: {
        has: (flag) => (bitfield & flag) === flag,
      },
      roles: {
        cache: new Map(roleIds.map((id) => [id, { id }])),
      },
    };
  }

  test('isDJOrAdmin should return true for Administrator and ManageGuild', () => {
    const admin = makeMockMember({ isAdmin: true });
    const manager = makeMockMember({ isManageGuild: true });
    const normal = makeMockMember({ isAdmin: false, isManageGuild: false });

    assert.strictEqual(isDJOrAdmin(admin, { dj_role_id: '999' }), true);
    assert.strictEqual(isDJOrAdmin(manager, { dj_role_id: '999' }), true);
    assert.strictEqual(isDJOrAdmin(normal, { dj_role_id: '999' }), false);
  });

  test('isDJOrAdmin should allow member with designated DJ role', () => {
    const djMember = makeMockMember({ roleIds: ['dj_role_123'] });
    assert.strictEqual(isDJOrAdmin(djMember, { dj_role_id: 'dj_role_123' }), true);
    assert.strictEqual(isDJOrAdmin(djMember, { dj_role_id: 'other_role' }), false);
  });

  test('isDJOrAdmin should allow all members when no DJ role is configured', () => {
    const normal = makeMockMember();
    assert.strictEqual(isDJOrAdmin(normal, { dj_role_id: null }), true);
  });

  test('checkVoicePermissions should validate voice presence', () => {
    const interactionWithoutVoice = {
      guild: { id: 'g1', members: { me: { voice: { channel: null } } } },
      channelId: 'c1',
      member: {
        voice: { channel: null },
        permissions: { has: () => false },
      },
    };

    const res = checkVoicePermissions(interactionWithoutVoice, { requireVoice: true });
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errorEmbed.data.title.includes('Voice Channel Required'), true);
  });
});

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

describe('Command Suite Registration Tests', () => {
  const commandsDir = path.join(__dirname, '..', 'src', 'commands');

  function getCommandFiles(dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...getCommandFiles(fullPath));
      } else if (entry.name.endsWith('.js')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const files = getCommandFiles(commandsDir);

  test('should find and load all slash command files', () => {
    assert.strictEqual(files.length >= 22, true, `Expected >= 22 commands, found ${files.length}`);
  });

  files.forEach((file) => {
    const filename = path.basename(file);
    test(`command file ${filename} must export valid data and execute`, () => {
      const command = require(file);
      assert.ok(command.data, `${filename} missing data definition`);
      assert.ok(command.data.name, `${filename} data missing name`);
      assert.ok(command.data.description, `${filename} data missing description`);
      assert.strictEqual(typeof command.execute, 'function', `${filename} missing execute function`);

      // Verify that data compiles to valid JSON for Discord REST API
      const json = command.data.toJSON();
      assert.ok(json.name);
      assert.ok(json.description);
    });
  });
});

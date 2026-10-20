const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  formatDuration,
  createProgressBar,
  parseTime,
  truncate,
} = require('../src/utils/formatters');

describe('Formatter Utility Tests', () => {
  test('formatDuration should format seconds and milliseconds to mm:ss', () => {
    assert.strictEqual(formatDuration(0), '00:00');
    assert.strictEqual(formatDuration(59), '00:59');
    assert.strictEqual(formatDuration(60), '01:00');
    assert.strictEqual(formatDuration(225), '03:45');
    assert.strictEqual(formatDuration(3600), '01:00:00');
    assert.strictEqual(formatDuration(3665), '01:01:05');

    // Milliseconds
    assert.strictEqual(formatDuration(65000, true), '01:05');

    // Edge cases
    assert.strictEqual(formatDuration(null), '00:00');
    assert.strictEqual(formatDuration(-10), '00:00');
  });

  test('createProgressBar should generate balanced graphical bar', () => {
    const startBar = createProgressBar(0, 1000, 10);
    assert.strictEqual(startBar.startsWith('🔘'), true);
    assert.strictEqual([...startBar].length, 10);

    const midBar = createProgressBar(500, 1000, 10);
    assert.strictEqual(midBar.includes('🔘'), true);

    const endBar = createProgressBar(1000, 1000, 10);
    assert.strictEqual(endBar.endsWith('🔘'), true);

    // Live stream or 0 duration
    assert.strictEqual(createProgressBar(100, 0, 10), '🔘═════════');
  });

  test('parseTime should correctly parse various timestamp inputs into seconds', () => {
    assert.strictEqual(parseTime('90'), 90);
    assert.strictEqual(parseTime('1:30'), 90);
    assert.strictEqual(parseTime('01:30'), 90);
    assert.strictEqual(parseTime('01:00:00'), 3600);
    assert.strictEqual(parseTime('01:15:30'), 4530);
    assert.strictEqual(parseTime('45s'), 45);
    assert.strictEqual(parseTime('2m'), 120);
    assert.strictEqual(parseTime('1h 30m'), 5400);

    // Invalid inputs
    assert.strictEqual(parseTime('invalid'), null);
    assert.strictEqual(parseTime(''), null);
    assert.strictEqual(parseTime(null), null);
  });

  test('truncate should shorten strings with ellipsis when length exceeds limit', () => {
    assert.strictEqual(truncate('Short', 10), 'Short');
    assert.strictEqual(truncate('A very long song title exceeding limit', 15), 'A very long ...');
  });
});

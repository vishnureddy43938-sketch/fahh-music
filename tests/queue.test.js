const { test, describe } = require('node:test');
const assert = require('node:assert');
const { Queue, RepeatMode } = require('../src/music/Queue');
const Track = require('../src/music/Track');

describe('Queue System Tests', () => {
  const dummyRequester = { id: '123', username: 'TestUser', tag: 'TestUser#0001' };

  function makeTrack(title, duration = 180) {
    return new Track({
      title,
      author: 'Test Artist',
      url: `https://example.com/${title.toLowerCase().replace(/\s+/g, '-')}`,
      duration,
      requester: dummyRequester,
    });
  }

  test('should initialize with empty queue, history, and RepeatMode.OFF', () => {
    const queue = new Queue();
    assert.strictEqual(queue.tracks.length, 0);
    assert.strictEqual(queue.current, null);
    assert.strictEqual(queue.history.length, 0);
    assert.strictEqual(queue.repeatMode, RepeatMode.OFF);
  });

  test('should enqueue tracks and calculate total duration', () => {
    const queue = new Queue();
    queue.add(makeTrack('Song 1', 100));
    queue.add([makeTrack('Song 2', 200), makeTrack('Song 3', 300)]);

    assert.strictEqual(queue.tracks.length, 3);
    assert.strictEqual(queue.totalDuration(), 600);
  });

  test('should correctly advance tracks in sequential mode', () => {
    const queue = new Queue();
    const t1 = makeTrack('Track 1');
    const t2 = makeTrack('Track 2');
    queue.add([t1, t2]);

    const first = queue.next();
    assert.strictEqual(first.title, 'Track 1');
    assert.strictEqual(queue.current.title, 'Track 1');
    assert.strictEqual(queue.tracks.length, 1);

    const second = queue.next();
    assert.strictEqual(second.title, 'Track 2');
    assert.strictEqual(queue.history.length, 1);
    assert.strictEqual(queue.history[0].title, 'Track 1');

    const empty = queue.next();
    assert.strictEqual(empty, null);
    assert.strictEqual(queue.history.length, 2);
  });

  test('should repeat the same track when repeatMode is TRACK', () => {
    const queue = new Queue();
    queue.add([makeTrack('Song A'), makeTrack('Song B')]);
    queue.next(); // current is Song A

    queue.setRepeatMode(RepeatMode.TRACK);
    const repeated = queue.next();
    assert.strictEqual(repeated.title, 'Song A');
    assert.strictEqual(queue.tracks.length, 1); // Song B is still waiting
  });

  test('should cycle tracks to back of queue when repeatMode is QUEUE', () => {
    const queue = new Queue();
    queue.add([makeTrack('Song 1'), makeTrack('Song 2')]);
    queue.setRepeatMode(RepeatMode.QUEUE);

    const first = queue.next(); // Song 1
    assert.strictEqual(first.title, 'Song 1');

    const second = queue.next(); // Song 2, Song 1 pushed to end
    assert.strictEqual(second.title, 'Song 2');
    assert.strictEqual(queue.tracks.length, 1);
    assert.strictEqual(queue.tracks[0].title, 'Song 1');
  });

  test('should restore previous tracks from history', () => {
    const queue = new Queue();
    queue.add([makeTrack('Song 1'), makeTrack('Song 2')]);
    queue.next(); // Song 1
    queue.next(); // Song 2

    assert.strictEqual(queue.current.title, 'Song 2');
    assert.strictEqual(queue.history[0].title, 'Song 1');

    const prev = queue.previous();
    assert.strictEqual(prev.title, 'Song 1');
    assert.strictEqual(queue.current.title, 'Song 1');
    assert.strictEqual(queue.tracks[0].title, 'Song 2'); // Song 2 put back
  });

  test('should remove tracks by 1-based index safely', () => {
    const queue = new Queue();
    queue.add([makeTrack('Song 1'), makeTrack('Song 2'), makeTrack('Song 3')]);

    const removed = queue.remove(2); // Song 2
    assert.strictEqual(removed.title, 'Song 2');
    assert.strictEqual(queue.tracks.length, 2);
    assert.strictEqual(queue.tracks[1].title, 'Song 3');

    // Invalid index
    assert.strictEqual(queue.remove(99), null);
    assert.strictEqual(queue.remove(0), null);
  });

  test('should move tracks between positions safely', () => {
    const queue = new Queue();
    queue.add([makeTrack('A'), makeTrack('B'), makeTrack('C')]);

    const moved = queue.move(3, 1); // Move 'C' to position 1
    assert.strictEqual(moved, true);
    assert.strictEqual(queue.tracks[0].title, 'C');
    assert.strictEqual(queue.tracks[1].title, 'A');
    assert.strictEqual(queue.tracks[2].title, 'B');

    // Invalid moves
    assert.strictEqual(queue.move(1, 1), false);
    assert.strictEqual(queue.move(1, 10), false);
  });

  test('should generate pagination slices correctly', () => {
    const queue = new Queue();
    for (let i = 1; i <= 25; i++) {
      queue.add(makeTrack(`Song ${i}`, 60));
    }

    const pages = queue.getPages(10);
    assert.strictEqual(pages.length, 3);
    assert.strictEqual(pages[0].page, 1);
    assert.strictEqual(pages[0].tracks.length, 10);
    assert.strictEqual(pages[1].page, 2);
    assert.strictEqual(pages[1].tracks.length, 10);
    assert.strictEqual(pages[2].page, 3);
    assert.strictEqual(pages[2].tracks.length, 5);
  });
});

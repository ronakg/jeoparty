import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGameState } from '../src/utils/gameReducer';
import { GameState } from '../src/types/game';
import {
  toMediaUrlBrowser,
  sanitizeGameFileName,
  createActionId,
  createSeenActionIdTracker,
  mergeIncomingState,
} from '../src/hooks/gameStateHelpers';

// -------------------------------------------------------
// toMediaUrlBrowser
// -------------------------------------------------------

test('toMediaUrlBrowser: empty string returns empty', () => {
  assert.equal(toMediaUrlBrowser(''), '');
});

test('toMediaUrlBrowser: http URL returned as-is', () => {
  const url = 'http://example.com/img.png';
  assert.equal(toMediaUrlBrowser(url), url);
});

test('toMediaUrlBrowser: https URL returned as-is', () => {
  const url = 'https://cdn.example.com/a.jpg';
  assert.equal(toMediaUrlBrowser(url), url);
});

test('toMediaUrlBrowser: data URI returned as-is', () => {
  const uri = 'data:image/png;base64,abc123';
  assert.equal(toMediaUrlBrowser(uri), uri);
});

test('toMediaUrlBrowser: absolute path returned as-is', () => {
  assert.equal(toMediaUrlBrowser('/assets/sound.mp3'), '/assets/sound.mp3');
});

test('toMediaUrlBrowser: relative path gets leading slash', () => {
  assert.equal(toMediaUrlBrowser('images/photo.jpg'), '/images/photo.jpg');
});

// -------------------------------------------------------
// sanitizeGameFileName
// -------------------------------------------------------

test('sanitizeGameFileName: normal title', () => {
  assert.equal(
    sanitizeGameFileName('Science Bowl 2026'),
    'science_bowl_2026.jeopardy'
  );
});

test('sanitizeGameFileName: symbols stripped', () => {
  assert.equal(
    sanitizeGameFileName('  Spaces & Symbols!!! '),
    'spaces_symbols.jeopardy'
  );
});

test('sanitizeGameFileName: empty string falls back', () => {
  assert.equal(sanitizeGameFileName(''), 'jeopardy.jeopardy');
});

test('sanitizeGameFileName: undefined falls back', () => {
  assert.equal(sanitizeGameFileName(undefined), 'jeopardy.jeopardy');
});

test('sanitizeGameFileName: all-symbol title falls back', () => {
  assert.equal(sanitizeGameFileName('!!!'), 'jeopardy.jeopardy');
});

// -------------------------------------------------------
// createActionId
// -------------------------------------------------------

test('createActionId: returns non-empty string', () => {
  const id = createActionId();
  assert.ok(id.length > 0);
});

test('createActionId: contains hyphen separator', () => {
  const id = createActionId();
  assert.ok(id.includes('-'));
});

// -------------------------------------------------------
// createSeenActionIdTracker
// -------------------------------------------------------

test('createSeenActionIdTracker: first call returns true', () => {
  const record = createSeenActionIdTracker(10);
  assert.equal(record('abc'), true);
});

test('createSeenActionIdTracker: duplicate returns false', () => {
  const record = createSeenActionIdTracker(10);
  record('abc');
  assert.equal(record('abc'), false);
});

test('createSeenActionIdTracker: evicts oldest beyond maxSize', () => {
  const record = createSeenActionIdTracker(3);
  record('a');
  record('b');
  record('c');
  // Set is now full (size 3). Adding 'd' evicts 'a'.
  record('d');
  // 'a' should be forgotten, so it returns true again
  assert.equal(record('a'), true);
  // Re-inserting 'a' pushed set to 4, evicting 'b'.
  // 'c' should still be tracked (not evicted).
  assert.equal(record('c'), false);
});

test('createSeenActionIdTracker: distinct IDs all return true', () => {
  const record = createSeenActionIdTracker(100);
  assert.equal(record('x'), true);
  assert.equal(record('y'), true);
  assert.equal(record('z'), true);
});

// -------------------------------------------------------
// mergeIncomingState
// -------------------------------------------------------

test('mergeIncomingState: explicit displayWindowOpen adopted', () => {
  const prev: GameState = {
    ...initialGameState,
    displayWindowOpen: false,
  };
  const incoming: GameState = {
    ...initialGameState,
    team1Score: 500,
    displayWindowOpen: true,
  };
  const merged = mergeIncomingState(prev, incoming);
  assert.equal(merged.displayWindowOpen, true);
  assert.equal(merged.team1Score, 500);
});

test('mergeIncomingState: undefined displayWindowOpen preserves prev', () => {
  const prev: GameState = {
    ...initialGameState,
    displayWindowOpen: true,
  };
  // Simulate incoming state without displayWindowOpen set
  const incoming = {
    ...initialGameState,
    team1Score: 200,
  } as GameState;
  delete (incoming as any).displayWindowOpen;

  const merged = mergeIncomingState(prev, incoming);
  assert.equal(
    merged.displayWindowOpen,
    true,
    'Must preserve prev displayWindowOpen'
  );
  assert.equal(merged.team1Score, 200);
});

test('mergeIncomingState: explicit false is not treated as undefined', () => {
  const prev: GameState = {
    ...initialGameState,
    displayWindowOpen: true,
  };
  const incoming: GameState = {
    ...initialGameState,
    displayWindowOpen: false,
  };
  const merged = mergeIncomingState(prev, incoming);
  assert.equal(
    merged.displayWindowOpen,
    false,
    'Explicit false must override prev'
  );
});

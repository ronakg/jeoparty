import test from 'node:test';
import assert from 'node:assert/strict';
import { tracer, computeStateDelta } from '../src/utils/tracer';
import { initialGameState } from '../src/utils/gameReducer';
import { GameState } from '../src/types/game';

test('AppTracer: records events in FIFO order and limits capacity', () => {
  tracer.clear();
  assert.equal(tracer.getEvents().length, 1); // Cleared event

  for (let i = 1; i <= 510; i++) {
    tracer.recordUiEvent(`Action ${i}`, { index: i });
  }

  const events = tracer.getEvents();
  assert.equal(events.length, 500);

  // Latest event should be Action 510
  const lastEvent = events[events.length - 1];
  assert.equal(lastEvent.label, 'Action 510');
});

test('AppTracer: computeStateDelta captures changes concisely', () => {
  const prev: GameState = {
    ...initialGameState,
    team1Score: 200,
    team2Score: 400,
    controllingTeam: 1,
    currentRoundIndex: 0,
    coWinnersDeclared: false,
  };

  const next: GameState = {
    ...prev,
    team1Score: 500,
    controllingTeam: 2,
    coWinnersDeclared: true,
  };

  const delta = computeStateDelta(prev, next);
  assert.equal(delta.team1Score, '200 -> 500');
  assert.equal(delta.controllingTeam, '1 -> 2');
  assert.equal(delta.coWinnersDeclared, 'false -> true');
  assert.equal(delta.team2Score, undefined);
});

test('AppTracer: formatMarkdownSummary exports readable diagnostics', () => {
  tracer.clear();
  tracer.recordUiEvent('Clicked Declare Co-Winners', { team1: 500 });
  tracer.record('WINNER_STATE', 'Winner declared: tie', { winner: 'tie' });

  const markdown = tracer.formatMarkdownSummary();
  assert.ok(markdown.includes('### JeoPARTY! Diagnostic Trace Export'));
  assert.ok(markdown.includes('Event Timeline (Chronological)'));
  assert.ok(markdown.includes('Clicked Declare Co-Winners'));
  assert.ok(markdown.includes('Raw JSON Trace'));
  assert.ok(markdown.includes('"winner": "tie"'));
});

test('Action Idempotency: Ring buffer deduplicates action IDs', () => {
  const processed = new Set<string>();
  const queue: string[] = [];

  const dedupe = (id: string): boolean => {
    if (processed.has(id)) return false;
    processed.add(id);
    queue.push(id);
    if (queue.length > 3) {
      const oldest = queue.shift();
      if (oldest) processed.delete(oldest);
    }
    return true;
  };

  assert.equal(dedupe('act-1'), true);
  assert.equal(dedupe('act-1'), false);
  assert.equal(dedupe('act-2'), true);
  assert.equal(dedupe('act-3'), true);
  assert.equal(dedupe('act-4'), true);
  assert.equal(processed.has('act-1'), false);
  assert.equal(dedupe('act-1'), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Duplex } from 'node:stream';
import { initialGameState, gameReducer } from '../src/utils/gameReducer';
import {
  GameAction,
  GameConfig,
  GameState,
  createGameFromPreferences,
} from '../src/types/game';
import {
  serializeGameConfigToYaml,
  parseGameConfigFromYaml,
} from '../src/utils/gameYaml';
import { isBoardComplete, getWinnerState } from '../src/utils/gameRules';
import { defaultGame } from '../src/data/defaultGame';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PlayerDisplay,
  SCORE_SPIN_DURATION_MS,
  calculateAnimatedScore,
} from '../src/views/PlayerDisplay';

/**
 * Creates an in-memory Duplex stream pair simulating a client-server socket.
 * This runs the real Node http.Server parser without creating OS TCP sockets,
 * preventing sandbox EPERM connect errors while testing real HTTP semantics.
 */
function createDuplexPair(): [Duplex, Duplex] {
  const holder: { s1?: Duplex; s2?: Duplex } = {};

  const s1 = new Duplex({
    read() {},
    write(chunk, _enc, cb) {
      holder.s2?.push(chunk);
      cb();
    },
    destroy(err, cb) {
      holder.s2?.push(null);
      cb(err);
    },
  });

  const s2 = new Duplex({
    read() {},
    write(chunk, _enc, cb) {
      holder.s1?.push(chunk);
      cb();
    },
    destroy(err, cb) {
      holder.s1?.push(null);
      cb(err);
    },
  });

  holder.s1 = s1;
  holder.s2 = s2;
  return [s1, s2];
}

/**
 * Headless HTTP game simulation driver.
 * Implements the /api/action and /api/state contracts from electron/main.ts
 * through a real Node http.Server, testing HTTP serialization, routing,
 * idempotency, and state transitions without window dependencies.
 */
class GameSimulation {
  private server: http.Server;
  private currentState: GameState;
  private processedActionIds = new Set<string>();

  private constructor(server: http.Server, initialState: GameState) {
    this.server = server;
    this.currentState = initialState;
  }

  static async start(
    initialState: GameState = initialGameState
  ): Promise<GameSimulation> {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || '/', 'http://127.0.0.1');

      if (parsedUrl.pathname === '/api/state' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, state: sim.currentState }));
        return;
      }

      if (parsedUrl.pathname === '/api/action' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body) as { action?: GameAction };
            const action = parsed?.action;
            if (action) {
              if (action._actionId) {
                if (sim.processedActionIds.has(action._actionId)) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      ok: true,
                      state: sim.currentState,
                      deduplicated: true,
                    })
                  );
                  return;
                }
                sim.processedActionIds.add(action._actionId);
              }
              sim.currentState = gameReducer(sim.currentState, action);
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, state: sim.currentState }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
        return;
      }

      res.statusCode = 404;
      res.end('Not found');
    });

    const sim = new GameSimulation(server, initialState);
    return sim;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private request<T>(
    method: 'GET' | 'POST',
    path: string,
    bodyPayload?: unknown
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const [clientSock, serverSock] = createDuplexPair();
      this.server.emit('connection', serverSock);

      const jsonStr = bodyPayload ? JSON.stringify(bodyPayload) : '';
      const rawRequest =
        `${method} ${path} HTTP/1.1\r\n` +
        `Host: 127.0.0.1\r\n` +
        `Content-Type: application/json\r\n` +
        `Content-Length: ${Buffer.byteLength(jsonStr)}\r\n` +
        `Connection: close\r\n\r\n` +
        jsonStr;

      let resBuffer = '';
      clientSock.on('data', (chunk) => {
        resBuffer += chunk.toString();
        if (resBuffer.includes('\r\n\r\n')) {
          const parts = resBuffer.split('\r\n\r\n');
          const body = parts.slice(1).join('\r\n\r\n');
          try {
            const parsed = JSON.parse(body) as T;
            resolve(parsed);
          } catch (e) {
            reject(e);
          }
        }
      });

      clientSock.on('error', reject);
      clientSock.write(rawRequest);
    });
  }

  async dispatch(action: GameAction): Promise<GameState> {
    const res = await this.request<{ ok: boolean; state: GameState }>(
      'POST',
      '/api/action',
      { action }
    );
    this.currentState = res.state;
    return res.state;
  }

  async getState(): Promise<GameState> {
    const res = await this.request<{ ok: boolean; state: GameState }>(
      'GET',
      '/api/state'
    );
    this.currentState = res.state;
    return res.state;
  }

  // Intent-based game helper methods
  async loadGame(config: GameConfig): Promise<GameState> {
    return this.dispatch({ type: 'LOAD_GAME', payload: config });
  }

  async selectClue(
    roundIndex: number,
    categoryIndex: number,
    clueIndex: number,
    firstAnsweringTeam: 1 | 2,
    timerStartedAt?: number
  ): Promise<GameState> {
    return this.dispatch({
      type: 'SELECT_CLUE',
      payload: {
        roundIndex,
        categoryIndex,
        clueIndex,
        firstAnsweringTeam,
        timerStartedAt,
      },
    });
  }

  async answerCorrect(team: 1 | 2): Promise<GameState> {
    return this.dispatch({ type: 'ANSWER_CORRECT', payload: { team } });
  }

  async answerWrong(team: 1 | 2): Promise<GameState> {
    return this.dispatch({ type: 'ANSWER_WRONG', payload: { team } });
  }

  async advanceRebound(): Promise<GameState> {
    return this.dispatch({ type: 'ADVANCE_REBOUND' });
  }

  async passRebound(): Promise<GameState> {
    return this.dispatch({ type: 'PASS_REBOUND' });
  }

  async revealHint(): Promise<GameState> {
    return this.dispatch({ type: 'REVEAL_HINT' });
  }

  async revealMedia(timerStartedAt?: number): Promise<GameState> {
    return this.dispatch({
      type: 'REVEAL_MEDIA',
      payload: timerStartedAt ? { timerStartedAt } : undefined,
    });
  }

  async setMediaPlaying(playing: boolean): Promise<GameState> {
    return this.dispatch({
      type: 'SET_MEDIA_PLAYING',
      payload: { playing },
    });
  }

  async hideMedia(): Promise<GameState> {
    return this.dispatch({ type: 'HIDE_MEDIA' });
  }

  async closeClue(): Promise<GameState> {
    return this.dispatch({ type: 'CLOSE_CLUE' });
  }

  async resetClueBox(
    roundIndex: number,
    categoryIndex: number,
    clueIndex: number
  ): Promise<GameState> {
    return this.dispatch({
      type: 'RESET_CLUE_BOX',
      payload: { roundIndex, categoryIndex, clueIndex },
    });
  }

  async overrideScores(
    team1Score: number,
    team2Score: number
  ): Promise<GameState> {
    return this.dispatch({
      type: 'OVERRIDE_SCORES',
      payload: { team1Score, team2Score },
    });
  }

  async setRound(roundIndex: number): Promise<GameState> {
    return this.dispatch({ type: 'SET_ROUND', payload: { roundIndex } });
  }

  async setWagers(team1Wager: number, team2Wager: number): Promise<GameState> {
    return this.dispatch({
      type: 'FJ_SET_WAGERS',
      payload: { team1Wager, team2Wager },
    });
  }

  async unlockWagers(): Promise<GameState> {
    return this.dispatch({ type: 'FJ_UNLOCK_WAGERS' });
  }

  async revealTieBreakerQuestion(): Promise<GameState> {
    return this.dispatch({ type: 'FJ_REVEAL_QUESTION' });
  }

  async judgeTieBreaker(
    team1Correct: boolean,
    team2Correct: boolean
  ): Promise<GameState> {
    return this.dispatch({
      type: 'FJ_JUDGE',
      payload: { team1Correct, team2Correct },
    });
  }

  async declareCoWinners(): Promise<GameState> {
    return this.dispatch({ type: 'DECLARE_CO_WINNERS' });
  }

  async resetTieBreaker(): Promise<GameState> {
    return this.dispatch({ type: 'FJ_RESET' });
  }
}

// ---------------------------------------------------------------------------
// SUITE 1: Game Creation & Configuration Preferences
// ---------------------------------------------------------------------------

test(
  'Simulation: Game Creation - custom dimensions and point progression',
  () => {
  const config = createGameFromPreferences({
    title: 'Science Bowl 2026',
    team1Name: 'Protons',
    team2Name: 'Electrons',
    numCategories: 4,
    numQuestionsPerCategory: 5,
    cluePointValues: [200, 400, 600, 800, 1000],
    hintPenalty: 75,
    reboundPercentage: 50,
    includeFinalJeopardy: true,
  });

  assert.equal(config.title, 'Science Bowl 2026');
  assert.equal(config.team1Name, 'Protons');
  assert.equal(config.team2Name, 'Electrons');
  assert.equal(config.defaultHintDeduction, 75);
  assert.equal(config.reboundPercentage, 50);

  const categories = config.rounds[0].categories;
  assert.equal(categories.length, 4, 'Must create exactly 4 categories');

  for (const cat of categories) {
    assert.equal(cat.clues.length, 5, 'Must create 5 clues per category');
    assert.deepEqual(
      cat.clues.map((c) => c.points),
      [200, 400, 600, 800, 1000],
      'Points must match configured custom progression'
    );
  }

  assert.ok(config.finalJeopardy, 'Must configure tie-breaker when requested');
});

test(
  'Simulation: Game Creation - extrapolates points when questions exceed array',
  () => {
  const config = createGameFromPreferences({
    numCategories: 3,
    numQuestionsPerCategory: 5,
    cluePointValues: [100, 200, 300], // Only 3 provided, 5 needed
  });

  const clues = config.rounds[0].categories[0].clues;
  assert.equal(clues.length, 5);
  assert.deepEqual(
    clues.map((c) => c.points),
    [100, 200, 300, 400, 500],
    'Must extrapolate point values linearly to match question count'
  );
});

// ---------------------------------------------------------------------------
// SUITE 2: File Persistence Roundtrip & Clean Export Integrity
// ---------------------------------------------------------------------------

test(
  'Simulation: Persistence - YAML roundtrip preserves questions and media',
  () => {
  const originalGame = createGameFromPreferences({
    title: 'Multimedia Championship',
    team1Name: 'Red Team',
    team2Name: 'Blue Team',
    numCategories: 3,
    numQuestionsPerCategory: 3,
  });

  originalGame.rounds[0].categories[0].name = 'Soundtracks';
  originalGame.rounds[0].categories[0].clues[0].question = 'Name this movie';
  originalGame.rounds[0].categories[0].clues[0].answer = 'Inception';
  originalGame.rounds[0].categories[0].clues[0].hint = 'Hans Zimmer';
  originalGame.rounds[0].categories[0].clues[0].media = {
    type: 'audio',
    urlOrPath: 'local-file/inception.mp3',
  };

  originalGame.questionTimerSeconds = 30;

  const yamlOutput = serializeGameConfigToYaml(originalGame);
  const reloadedGame = parseGameConfigFromYaml(yamlOutput);

  assert.equal(reloadedGame.title, 'Multimedia Championship');
  assert.equal(reloadedGame.team1Name, 'Red Team');
  assert.equal(reloadedGame.team2Name, 'Blue Team');
  assert.equal(reloadedGame.questionTimerSeconds, 30);

  const reloadedClue = reloadedGame.rounds[0].categories[0].clues[0];
  assert.equal(reloadedClue.question, 'Name this movie');
  assert.equal(reloadedClue.answer, 'Inception');
  assert.equal(reloadedClue.hint, 'Hans Zimmer');
  assert.equal(reloadedClue.media?.type, 'audio');
});

test('Simulation: Persistence - exported YAML strips runtime state', () => {
  const dirtyGame = createGameFromPreferences({
    title: 'Sanitized Export Test',
    numCategories: 2,
    numQuestionsPerCategory: 2,
  });

  dirtyGame.rounds[0].categories[0].clues[0].state = 'completed';
  dirtyGame.rounds[0].categories[0].clues[0].result = {
    winner: 1,
    type: 'full',
    pointsAwarded: 100,
  };

  const yamlOutput = serializeGameConfigToYaml(dirtyGame);

  assert.ok(!yamlOutput.includes('completed'));
  assert.ok(!yamlOutput.includes('pointsAwarded'));
  assert.ok(!yamlOutput.includes('team1Score'));
});

// ---------------------------------------------------------------------------
// SUITE 3: Core Gameplay - Direct Wins, Alternation & Zero Miss Penalties
// ---------------------------------------------------------------------------

test(
  'Simulation: Clue Answering - correct answer alternates control',
  async () => {
  const sim = await GameSimulation.start();
  try {
    await sim.loadGame(defaultGame);

    let state = await sim.getState();
    assert.equal(state.team1Score, 0);
    assert.equal(state.team2Score, 0);
    assert.equal(state.controllingTeam, 1);

    await sim.selectClue(0, 0, 0, 1);
    state = await sim.getState();
    assert.ok(state.activeClue !== null);
    assert.equal(state.activeClue?.originalPoints, 100);
    assert.equal(state.activeClue?.currentAvailablePoints, 100);

    await sim.answerCorrect(1);
    state = await sim.getState();
    assert.equal(state.team1Score, 100, 'Team 1 score must increment by 100');
    assert.equal(state.team2Score, 0, 'Team 2 score must remain 0');
    assert.equal(state.activeClue?.lastJudgedResult, 'correct');

    state = await sim.closeClue();
    assert.equal(state.activeClue, null, 'Active clue must be dismissed');
    assert.equal(
      state.controllingTeam,
      2,
      'Board control must alternate to Team 2'
    );
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Clue Answering - wrong answer incurs zero penalty',
  async () => {
  const sim = await GameSimulation.start();
  try {
    await sim.loadGame(defaultGame);

    await sim.selectClue(0, 0, 0, 1);
    let state = await sim.answerWrong(1);

    assert.equal(
      state.team1Score,
      0,
      'Score must not be deducted on wrong answer'
    );
    assert.equal(
      state.activeClue?.reboundAvailable,
      true,
      'Rebound must become available after first miss'
    );

    // Host offers rebound to Team 2
    state = await sim.advanceRebound();
    assert.equal(
      state.activeClue?.reboundOpportunity,
      true,
      '50% rebound opportunity must activate for opposing team'
    );
    assert.equal(
      state.activeClue?.currentAnsweringTeam,
      2,
      'Answering turn must pass to Team 2'
    );
    assert.equal(
      state.activeClue?.currentAvailablePoints,
      50,
      'Rebound points must scale to 50%'
    );
  } finally {
    await sim.stop();
  }
});

// ---------------------------------------------------------------------------
// SUITE 4: Rebound Mechanics & Double Misses
// ---------------------------------------------------------------------------

test(
  'Simulation: Rebound Flow - opposing team answers rebound for 50%',
  async () => {
  const sim = await GameSimulation.start();
  try {
    await sim.loadGame(defaultGame);

    await sim.selectClue(0, 0, 1, 1);
    await sim.answerWrong(1);

    // Host advances to rebound for Team 2
    await sim.advanceRebound();

    // Team 2 answers the rebound correctly
    await sim.answerCorrect(2);
    let state = await sim.getState();

    assert.equal(state.team1Score, 0);
    assert.equal(
      state.team2Score,
      100,
      'Team 2 must receive 50% points ($100)'
    );
    assert.equal(state.activeClue?.awardResult?.type, 'rebound');

    state = await sim.closeClue();
    assert.equal(
      state.controllingTeam,
      2,
      'Team 2 must take board control after round'
    );
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Rebound Flow - first team passes without wrong answer and ' +
    'opposing team answers rebound for 50%',
  async () => {
    const sim = await GameSimulation.start();
    try {
      await sim.loadGame(defaultGame);

      await sim.selectClue(0, 0, 1, 1);
      let state = await sim.getState();
      assert.deepEqual(state.activeClue?.incorrectTeams, []);

      // Host advances to rebound directly upon first team pass
      await sim.advanceRebound();
      state = await sim.getState();

      assert.deepEqual(state.activeClue?.incorrectTeams, []);
      assert.equal(state.activeClue?.reboundOpportunity, true);
      assert.equal(state.activeClue?.currentAnsweringTeam, 2);
      assert.equal(state.activeClue?.currentAvailablePoints, 100);

      // Opposing team answers rebound correctly
      await sim.answerCorrect(2);
      state = await sim.getState();

      assert.equal(state.team1Score, 0);
      assert.equal(state.team2Score, 100);
      assert.equal(state.activeClue?.awardResult?.type, 'rebound');

      state = await sim.closeClue();
      assert.equal(state.controllingTeam, 2);
    } finally {
      await sim.stop();
    }
  }
);

test('Simulation: Rebound Flow - double miss awards zero points', async () => {
  const sim = await GameSimulation.start();
  try {
    await sim.loadGame(defaultGame);

    await sim.selectClue(0, 0, 0, 1);
    await sim.answerWrong(1);
    await sim.advanceRebound();

    // Team 2 misses rebound
    const state = await sim.answerWrong(2);

    assert.equal(state.team1Score, 0);
    assert.equal(state.team2Score, 0);
    assert.deepEqual(state.activeClue?.incorrectTeams, [1, 2]);

    const finalState = await sim.closeClue();
    assert.equal(
      finalState.controllingTeam,
      2,
      'Regular turn alternation passes to Team 2'
    );
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Rebound Flow - passing rebound awards zero points',
  async () => {
  const sim = await GameSimulation.start();
  try {
    await sim.loadGame(defaultGame);

    await sim.selectClue(0, 0, 0, 1);
    await sim.answerWrong(1);

    // Host records rebound pass
    await sim.passRebound();
    const state = await sim.closeClue();

    assert.equal(state.team1Score, 0);
    assert.equal(state.team2Score, 0);
    assert.equal(state.controllingTeam, 2);
  } finally {
    await sim.stop();
  }
});

// ---------------------------------------------------------------------------
// SUITE 5: Hint Deductions & Floor Clamping
// ---------------------------------------------------------------------------

test(
  'Simulation: Hint Lifecycle - points clamp at zero when deduction exceeds',
  async () => {
  const sim = await GameSimulation.start();
  try {
    const gameWithBigHint = createGameFromPreferences({
      numCategories: 1,
      numQuestionsPerCategory: 1,
      cluePointValues: [100],
      hintPenalty: 150,
    });
    // Ensure clue contains non-empty hint text so deduction guard allows reveal
    gameWithBigHint.rounds[0].categories[0].clues[0].hint = 'Historic landmark';

    await sim.loadGame(gameWithBigHint);

    await sim.selectClue(0, 0, 0, 1);
    let state = await sim.getState();
    assert.equal(state.activeClue?.currentAvailablePoints, 100);

    // Host reveals hint
    await sim.revealHint();
    state = await sim.getState();

    assert.equal(
      state.activeClue?.currentAvailablePoints,
      0,
      'Available points must clamp to 0, never negative'
    );

    // Team 1 answers correctly
    await sim.answerCorrect(1);
    state = await sim.getState();
    assert.equal(
      state.team1Score,
      0,
      'No points awarded when clue clamped to 0'
    );
  } finally {
    await sim.stop();
  }
});

// ---------------------------------------------------------------------------
// SUITE 6: Full Regulation Game Simulation to Victory
// ---------------------------------------------------------------------------

test(
  'Simulation: Full Match - plays complete mini-board to victory',
  async () => {
  const sim = await GameSimulation.start();
  try {
    const miniGame = createGameFromPreferences({
      title: 'Sprint Cup',
      team1Name: 'Team Alpha',
      team2Name: 'Team Beta',
      numCategories: 2,
      numQuestionsPerCategory: 2,
      cluePointValues: [100, 200],
      includeFinalJeopardy: false,
    });
    await sim.loadGame(miniGame);

    // Clue 1: Cat 0, Clue 0 ($100) -> Team 1 direct win ($100)
    await sim.selectClue(0, 0, 0, 1);
    await sim.answerCorrect(1);
    await sim.closeClue();

    // Clue 2: Cat 0, Clue 1 ($200) -> Team 2 direct win ($200)
    await sim.selectClue(0, 0, 1, 2);
    await sim.answerCorrect(2);
    await sim.closeClue();

    // Clue 3: Cat 1, Clue 0 ($100) -> Team 1 misses, Team 2 rebounds ($50)
    await sim.selectClue(0, 1, 0, 1);
    await sim.answerWrong(1);
    await sim.advanceRebound();
    await sim.answerCorrect(2);
    await sim.closeClue();

    // Clue 4: Cat 1, Clue 1 ($200) -> Team 2 direct win ($200)
    await sim.selectClue(0, 1, 1, 2);
    await sim.answerCorrect(2);
    const finalState = await sim.closeClue();

    assert.equal(finalState.team1Score, 100);
    assert.equal(finalState.team2Score, 450); // 200 + 50 + 200 = 450
    assert.ok(isBoardComplete(finalState.config), 'Board must be complete');

    const winner = getWinnerState(finalState);
    assert.equal(winner.isGameOver, true, 'Game must be over');
    assert.equal(winner.winner, 'team2', 'Team Beta must be declared winner');
    assert.equal(winner.winningTeamName, 'Team Beta');
    assert.equal(winner.reason, 'regulation_win');
  } finally {
    await sim.stop();
  }
});

// ---------------------------------------------------------------------------
// SUITE 7: Tie-Breaker & Sudden Death Scenarios
// ---------------------------------------------------------------------------

test(
  'Simulation: Tie Resolution - sudden death resolves tied regulation match',
  async () => {
  const sim = await GameSimulation.start();
  try {
    const tieGame = createGameFromPreferences({
      team1Name: 'Hawks',
      team2Name: 'Eagles',
      numCategories: 1,
      numQuestionsPerCategory: 2,
      cluePointValues: [200, 200],
      includeFinalJeopardy: true,
    });
    await sim.loadGame(tieGame);

    // Clue 1: Team 1 answers ($200)
    await sim.selectClue(0, 0, 0, 1);
    await sim.answerCorrect(1);
    await sim.closeClue();

    // Clue 2: Team 2 answers ($200)
    await sim.selectClue(0, 0, 1, 2);
    await sim.answerCorrect(2);
    let state = await sim.closeClue();

    assert.equal(state.team1Score, 200);
    assert.equal(state.team2Score, 200);

    let winner = getWinnerState(state);
    assert.equal(winner.isGameOver, false);
    assert.equal(
      winner.canProceedToTieBreaker,
      true,
      'Must offer tie-breaker when regulation ends in tie'
    );

    // Advance to tie-breaker round (-1)
    await sim.setRound(-1);
    await sim.revealTieBreakerQuestion();

    // Lock initial wagers
    state = await sim.setWagers(100, 100);
    assert.equal(state.config?.finalJeopardy?.wagersLocked, true);

    // Host unlocks to edit wagers
    state = await sim.unlockWagers();
    assert.equal(state.config?.finalJeopardy?.wagersLocked, false);

    // Re-lock updated wagers
    state = await sim.setWagers(150, 100);
    assert.equal(state.config?.finalJeopardy?.wagersLocked, true);
    assert.equal(state.config?.finalJeopardy?.team1Wager, 150);

    await sim.judgeTieBreaker(true, false);
    state = await sim.getState();

    winner = getWinnerState(state);
    assert.equal(winner.isGameOver, true);
    assert.equal(winner.winner, 'team1', 'Hawks must win tie-breaker');
    assert.equal(winner.reason, 'tie_breaker_win');
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Tie Resolution - host declares co-winners for tied match',
  async () => {
  const sim = await GameSimulation.start();
  try {
    const tieGame = createGameFromPreferences({
      numCategories: 1,
      numQuestionsPerCategory: 2,
      cluePointValues: [100, 100],
      includeFinalJeopardy: true,
    });
    await sim.loadGame(tieGame);

    await sim.selectClue(0, 0, 0, 1);
    await sim.answerCorrect(1);
    await sim.closeClue();

    await sim.selectClue(0, 0, 1, 2);
    await sim.answerCorrect(2);
    await sim.closeClue();

    const state = await sim.declareCoWinners();
    const winner = getWinnerState(state);

    assert.equal(winner.isGameOver, true);
    assert.equal(winner.winner, 'tie', 'Outcome must be tie');
    assert.equal(winner.reason, 'regulation_tie');
  } finally {
    await sim.stop();
  }
});

// ---------------------------------------------------------------------------
// SUITE 8: Host Overrides, Undos & Network Idempotency
// ---------------------------------------------------------------------------

test(
  'Simulation: Host Operations - score override updates standing scores',
  async () => {
  const sim = await GameSimulation.start();
  try {
    await sim.loadGame(defaultGame);

    const state = await sim.overrideScores(1250, 950);
    assert.equal(state.team1Score, 1250);
    assert.equal(state.team2Score, 950);
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Host Operations - reset clue box deducts points and reopens',
  async () => {
  const sim = await GameSimulation.start();
  try {
    await sim.loadGame(defaultGame);

    await sim.selectClue(0, 0, 0, 1);
    await sim.answerCorrect(1);
    await sim.closeClue();

    let state = await sim.getState();
    assert.equal(state.team1Score, 100);
    assert.equal(
      state.config?.rounds[0].categories[0].clues[0].state,
      'completed'
    );

    // Host resets box (undo mistake)
    state = await sim.resetClueBox(0, 0, 0);
    assert.equal(
      state.team1Score,
      0,
      'Points must be deducted back to original score'
    );
    assert.equal(
      state.config?.rounds[0].categories[0].clues[0].state,
      'unopened',
      'Tile must be restored to unopened'
    );
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Network Reliability - duplicate action ID is dropped',
  async () => {
  const sim = await GameSimulation.start();
  try {
    await sim.loadGame(defaultGame);

    await sim.selectClue(0, 0, 0, 1);

    const idempotentAction: GameAction = {
      type: 'ANSWER_CORRECT',
      payload: { team: 1 },
      _actionId: 'action-uuid-12345',
    };

    await sim.dispatch(idempotentAction);
    let state = await sim.getState();
    assert.equal(state.team1Score, 100);

    // Second dispatch with same ID (e.g. Wi-Fi retry)
    await sim.dispatch(idempotentAction);
    state = await sim.getState();
    assert.equal(
      state.team1Score,
      100,
      'Duplicate action must be dropped without double-scoring'
    );
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Reducer Integrity - duplicate ANSWER_CORRECT is ignored',
  async () => {
  const sim = await GameSimulation.start();
  try {
    await sim.loadGame(defaultGame);
    await sim.selectClue(0, 0, 0, 1);

    // First correct answer awards $100
    let state = await sim.answerCorrect(1);
    assert.equal(state.team1Score, 100);

    // Second call without idempotency ID is guarded by reducer
    state = await sim.answerCorrect(1);
    assert.equal(
      state.team1Score,
      100,
      'Duplicate judging must be rejected by reducer'
    );
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Rebound Flow - direct answer during pending rebound gets 50%',
  async () => {
  const sim = await GameSimulation.start();
  try {
    await sim.loadGame(defaultGame);
    await sim.selectClue(0, 0, 0, 1);

    // Team 1 misses: clue is in pending rebound
    await sim.answerWrong(1);

    // Team 2 directly answers without ADVANCE_REBOUND
    const state = await sim.answerCorrect(2);
    assert.equal(
      state.team2Score,
      50,
      'Pending rebound answer must be auto-scaled to 50% ($50)'
    );
    assert.equal(state.activeClue?.awardResult?.type, 'rebound');
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Tie Resolution - FJ_RESET reverts wagers and allows re-judging',
  async () => {
  const sim = await GameSimulation.start();
  try {
    const tieGame = createGameFromPreferences({
      team1Name: 'Hawks',
      team2Name: 'Eagles',
      numCategories: 1,
      numQuestionsPerCategory: 2,
      cluePointValues: [200, 200],
      includeFinalJeopardy: true,
    });
    await sim.loadGame(tieGame);

    await sim.selectClue(0, 0, 0, 1);
    await sim.answerCorrect(1);
    await sim.closeClue();

    await sim.selectClue(0, 0, 1, 2);
    await sim.answerCorrect(2);
    await sim.closeClue();

    // Advance to tie-breaker round (-1)
    await sim.setRound(-1);
    await sim.revealTieBreakerQuestion();
    await sim.setWagers(100, 100);

    // Mistaken judgment: Team 1 won, Team 2 lost
    await sim.judgeTieBreaker(true, false);
    let state = await sim.getState();
    assert.equal(state.team1Score, 300);
    assert.equal(state.team2Score, 100);
    assert.equal(getWinnerState(state).isGameOver, true);

    // Host resets tie-breaker
    state = await sim.resetTieBreaker();
    assert.equal(state.team1Score, 200, 'Score must revert to pre-wager value');
    assert.equal(state.team2Score, 200, 'Score must revert to pre-wager value');
    assert.equal(
      getWinnerState(state).isGameOver,
      false,
      'Game over must be cleared after tie-breaker reset'
    );

    // Re-judge correctly: Team 2 won, Team 1 lost
    await sim.setWagers(150, 150);
    await sim.judgeTieBreaker(false, true);
    state = await sim.getState();
    assert.equal(state.team1Score, 50);
    assert.equal(state.team2Score, 350);
    const winner = getWinnerState(state);
    assert.equal(winner.isGameOver, true);
    assert.equal(winner.winner, 'team2', 'Eagles must win after re-judging');
  } finally {
    await sim.stop();
  }
});

// ---------------------------------------------------------------------------
// SUITE 8: Question Countdown Timer - Triggers, Media Delay & Expiration
// ---------------------------------------------------------------------------

test(
  'Simulation: Question Timer - clue without media starts countdown',
  async () => {
  const sim = await GameSimulation.start();
  try {
    const timerGame = createGameFromPreferences({
      title: 'Countdown Simulation',
      team1Name: 'Stars',
      team2Name: 'Stripes',
      numCategories: 3,
      numQuestionsPerCategory: 3,
      questionTimerSeconds: 30,
    });

    await sim.loadGame(timerGame);

    const beforeState = await sim.getState();
    assert.equal(beforeState.activeClue, null);

    const now = Date.now();
    await sim.selectClue(0, 0, 0, 1, now);

    const activeState = await sim.getState();
    assert.ok(activeState.activeClue);
    assert.equal(activeState.activeClue.timerStartedAt, now);
    assert.equal(activeState.config?.questionTimerSeconds, 30);
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Question Timer - clue with media defers until reveal',
  async () => {
  const sim = await GameSimulation.start();
  try {
    const mediaGame = createGameFromPreferences({
      title: 'Media Timer Simulation',
      team1Name: 'Stars',
      team2Name: 'Stripes',
      numCategories: 3,
      numQuestionsPerCategory: 3,
      questionTimerSeconds: 45,
    });

    mediaGame.rounds[0].categories[0].clues[0].media = {
      type: 'audio',
      urlOrPath: 'sample.mp3',
    };

    await sim.loadGame(mediaGame);
    await sim.selectClue(0, 0, 0, 1);

    let state = await sim.getState();
    assert.ok(state.activeClue);
    assert.equal(
      state.activeClue.timerStartedAt,
      null,
      'Timer must remain null before media is revealed'
    );

    const mediaRevealTime = Date.now();
    await sim.revealMedia(mediaRevealTime);

    state = await sim.getState();
    assert.equal(
      state.activeClue?.timerStartedAt,
      mediaRevealTime,
      'Timer must start when host reveals media'
    );
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Media Playback - controls media playing and reveal state',
  async () => {
  const sim = await GameSimulation.start();
  try {
    const mediaGame = createGameFromPreferences({
      title: 'Media Playback Simulation',
      team1Name: 'Alpha',
      team2Name: 'Beta',
      numCategories: 3,
      numQuestionsPerCategory: 3,
    });
    mediaGame.rounds[0].categories[0].clues[0].media = {
      type: 'video',
      urlOrPath: 'media/test_video.mp4',
    };

    await sim.loadGame(mediaGame);
    await sim.selectClue(0, 0, 0, 1);

    let state = await sim.getState();
    assert.equal(state.activeClue?.mediaRevealed, false);
    assert.equal(state.activeClue?.mediaPlaying, false);

    await sim.revealMedia();
    state = await sim.getState();
    assert.equal(state.activeClue?.mediaRevealed, true);
    assert.equal(state.activeClue?.mediaPlaying, true);

    await sim.setMediaPlaying(false);
    state = await sim.getState();
    assert.equal(state.activeClue?.mediaRevealed, true);
    assert.equal(state.activeClue?.mediaPlaying, false);

    await sim.setMediaPlaying(true);
    state = await sim.getState();
    assert.equal(state.activeClue?.mediaPlaying, true);

    await sim.hideMedia();
    state = await sim.getState();
    assert.equal(state.activeClue?.mediaRevealed, false);
    assert.equal(state.activeClue?.mediaPlaying, false);
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Question Timer - expiration incurs zero auto side effects',
  async () => {
  const sim = await GameSimulation.start();
  try {
    const expiredGame = createGameFromPreferences({
      title: 'Expired Timer Simulation',
      team1Name: 'Stars',
      team2Name: 'Stripes',
      numCategories: 3,
      numQuestionsPerCategory: 3,
      questionTimerSeconds: 15,
    });

    await sim.loadGame(expiredGame);

    // Clue started 25 seconds ago (10s past 15s limit)
    const pastTime = Date.now() - 25000;
    await sim.selectClue(0, 0, 0, 1, pastTime);

    let state = await sim.getState();
    assert.ok(state.activeClue, 'Clue must remain open upon timer expiry');
    assert.equal(state.team1Score, 0);
    assert.equal(state.team2Score, 0);
    assert.equal(
      state.config?.rounds[0].categories[0].clues[0].state,
      'active'
    );

    // Host can still judge clue correct without restriction
    await sim.answerCorrect(1);
    state = await sim.getState();
    assert.equal(state.team1Score, 100);
    assert.equal(state.activeClue?.correctTeam, 1);

    await sim.closeClue();
    state = await sim.getState();
    assert.equal(state.controllingTeam, 2);
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Question Timer - unconfigured timer leaves timer null',
  async () => {
  const sim = await GameSimulation.start();
  try {
    const standardGame = createGameFromPreferences({
      title: 'No Timer Simulation',
      team1Name: 'Stars',
      team2Name: 'Stripes',
      numCategories: 3,
      numQuestionsPerCategory: 3,
    });

    await sim.loadGame(standardGame);
    await sim.selectClue(0, 0, 0, 1);

    const state = await sim.getState();
    assert.ok(state.activeClue);
    assert.equal(state.activeClue.timerStartedAt, null);
    assert.equal(state.config?.questionTimerSeconds, undefined);
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Question Timer - countdown urgency transitions at 10s',
  async () => {
  const sim = await GameSimulation.start();
  try {
    const timerGame = createGameFromPreferences({
      title: 'Timer Urgency Simulation',
      team1Name: 'Stars',
      team2Name: 'Stripes',
      numCategories: 3,
      numQuestionsPerCategory: 3,
      questionTimerSeconds: 30,
    });

    await sim.loadGame(timerGame);

    // 18s elapsed -> 12s remaining (>10s, calm state)
    const calmTime = Date.now() - 18000;
    await sim.selectClue(0, 0, 0, 1, calmTime);

    let state = await sim.getState();
    assert.ok(state.activeClue);
    assert.equal(state.activeClue.timerStartedAt, calmTime);

    let html = renderToStaticMarkup(
      React.createElement(PlayerDisplay, {
        state,
        toMediaUrl: (p: string) => p,
        onToggleFullScreen: () => {},
      })
    );
    assert.ok(html.includes('00:12'));
    assert.ok(html.includes('text-modern-gold'));
    assert.ok(!html.includes('animate-timer-blink'));

    // 20s elapsed -> 10s remaining (threshold: urgent blinking)
    const urgentTime = Date.now() - 20000;
    await sim.selectClue(0, 0, 1, 1, urgentTime);

    state = await sim.getState();
    assert.ok(state.activeClue);
    assert.equal(state.activeClue.timerStartedAt, urgentTime);

    html = renderToStaticMarkup(
      React.createElement(PlayerDisplay, {
        state,
        toMediaUrl: (p: string) => p,
        onToggleFullScreen: () => {},
      })
    );
    assert.ok(html.includes('00:10'));
    assert.ok(html.includes('animate-timer-blink'));
    assert.ok(html.includes('text-amber-300'));

    // 30s elapsed -> 0s remaining (expired state)
    const expiredTime = Date.now() - 30000;
    await sim.selectClue(0, 0, 2, 1, expiredTime);

    state = await sim.getState();
    html = renderToStaticMarkup(
      React.createElement(PlayerDisplay, {
        state,
        toMediaUrl: (p: string) => p,
        onToggleFullScreen: () => {},
      })
    );
    assert.ok(html.includes('00:00'));
    assert.ok(html.includes('text-rose-300'));
    assert.ok(!html.includes('animate-timer-blink'));
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Score Lifecycle - green points clear when next clue opens',
  async () => {
  const sim = await GameSimulation.start();
  try {
    const matchGame = createGameFromPreferences({
      title: 'Score Lifecycle Simulation',
      team1Name: 'Stars',
      team2Name: 'Stripes',
      numCategories: 3,
      numQuestionsPerCategory: 3,
    });

    await sim.loadGame(matchGame);

    // Question 1: Team 1 answers correctly
    await sim.selectClue(0, 0, 0, 1);
    await sim.answerCorrect(1);

    let state = await sim.getState();
    assert.equal(state.team1Score, 100);
    assert.equal(state.activeClue?.correctTeam, 1);

    // Question 2: Host closes Question 1 and selects Question 2
    await sim.closeClue();
    await sim.selectClue(0, 0, 1, 2);

    state = await sim.getState();
    assert.ok(state.activeClue);
    assert.equal(state.activeClue.correctTeam, null);

    // Render PlayerDisplay: score must be resting gold, not green
    const html = renderToStaticMarkup(
      React.createElement(PlayerDisplay, {
        state,
        toMediaUrl: (p: string) => p,
        onToggleFullScreen: () => {},
      })
    );
    assert.ok(html.includes('w-[0.65em]'));
    assert.ok(html.includes('text-modern-gold'));
    assert.ok(!html.includes('text-emerald-400 drop-shadow'));
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Score Animation - correct answer triggers 1.5s spin duration',
  async () => {
  const sim = await GameSimulation.start();
  try {
    const matchGame = createGameFromPreferences({
      title: 'Score Animation Simulation',
      team1Name: 'Stars',
      team2Name: 'Stripes',
      numCategories: 3,
      numQuestionsPerCategory: 3,
    });

    await sim.loadGame(matchGame);
    await sim.selectClue(0, 0, 0, 1);
    await sim.answerCorrect(1);

    const state = await sim.getState();
    assert.equal(state.team1Score, 100);
    assert.equal(state.activeClue?.correctTeam, 1);
    assert.equal(SCORE_SPIN_DURATION_MS, 1500);

    // Verify that during the 1.5s window the calculation reports animating
    const midStep = calculateAnimatedScore(0, 100, 750, SCORE_SPIN_DURATION_MS);
    assert.equal(midStep.isAnimating, true);
    assert.ok(midStep.currentScore > 0 && midStep.currentScore <= 100);

    // Verify that after 1.5s the calculation reports complete
    const finalStep = calculateAnimatedScore(
      0,
      100,
      1500,
      SCORE_SPIN_DURATION_MS
    );
    assert.equal(finalStep.isAnimating, false);
    assert.equal(finalStep.currentScore, 100);
  } finally {
    await sim.stop();
  }
});

test(
  'Simulation: Tie-Breaker - category belongs to main board categories',
  async () => {
    const sim = await GameSimulation.start();
    try {
      const yamlPath = path.resolve(
        process.cwd(),
        'tests/fixtures/minimal_game/game.yaml'
      );
      const rawYaml = fs.readFileSync(yamlPath, 'utf-8');
      const game = parseGameConfigFromYaml(rawYaml);

      await sim.loadGame(game);
      const state = await sim.getState();

      const boardCategories = (state.config?.rounds || []).flatMap((r) =>
        r.categories.map((c) => c.name)
      );
      const tieCategory = state.config?.finalJeopardy?.category;

      assert.ok(tieCategory, 'Tie-breaker category must exist');
      assert.ok(
        boardCategories.includes(tieCategory),
        `Tie-breaker category ${tieCategory} must belong to board categories`
      );

      // Transition to tie-breaker round
      await sim.setRound(-1);
      const tieState = await sim.getState();
      assert.equal(tieState.currentRoundIndex, -1);
      assert.equal(tieState.config?.finalJeopardy?.category, tieCategory);
    } finally {
      await sim.stop();
    }
  }
);

test(
  'Simulation: Game Editing - updates title and team names via reload',
  async () => {
    const sim = await GameSimulation.start();
    try {
      const matchGame = createGameFromPreferences({
        title: 'Initial Title',
        team1Name: 'Team Red',
        team2Name: 'Team Blue',
        numRounds: 1,
        numCategories: 1,
        numQuestionsPerCategory: 1,
      });

      await sim.loadGame(matchGame);
      let state = await sim.getState();
      assert.equal(state.config?.title, 'Initial Title');
      assert.equal(state.config?.team1Name, 'Team Red');
      assert.equal(state.config?.team2Name, 'Team Blue');

      // Edit title and team names and reload
      const updatedGame = {
        ...matchGame,
        title: 'Updated Grand Final',
        team1Name: 'Champions',
        team2Name: 'Challengers',
      };

      await sim.loadGame(updatedGame);
      state = await sim.getState();
      assert.equal(state.config?.title, 'Updated Grand Final');
      assert.equal(state.config?.team1Name, 'Champions');
      assert.equal(state.config?.team2Name, 'Challengers');

      // Verify answering clue operates with new team configuration
      await sim.selectClue(0, 0, 0, 1);
      await sim.answerCorrect(1);
      state = await sim.getState();
      assert.equal(state.team1Score, 100);
      assert.equal(state.activeClue?.correctTeam, 1);
    } finally {
      await sim.stop();
    }
  }
);


import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'yaml';
import { initialGameState, gameReducer } from '../src/utils/gameReducer';
import { defaultGame } from '../src/data/defaultGame';
import { createGameFromPreferences } from '../src/types/game';
import {
  parseYouTubeTimestamp,
  formatSecondsToTime,
  parseYouTubeUrl,
} from '../src/utils/youtube';
import {
  serializeGameConfigToYaml,
  parseGameConfigFromYaml,
} from '../src/utils/gameYaml';
import { isBoardComplete, getWinnerState } from '../src/utils/gameRules';

const createLoadedState = (config = defaultGame) => {
  return gameReducer(initialGameState, { type: 'LOAD_GAME', payload: config });
};

test('Initial Game State: config is null for empty admin box on startup', () => {
  assert.equal(initialGameState.config, null);
  assert.equal(initialGameState.team1Score, 0);
  assert.equal(initialGameState.team2Score, 0);
  assert.equal(initialGameState.activeClue, null);
});

test('Game Lifecycle: LOAD_GAME and UNLOAD_GAME', () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });
  assert.ok(state.config !== null);
  assert.equal(state.config?.title, 'Ultimate Trivia Championship');

  state = gameReducer(state, { type: 'UNLOAD_GAME' });
  assert.equal(state.config, null);
  assert.equal(state.team1Score, 0);
  assert.equal(state.activeClue, null);
});

test('Preferences: createGameFromPreferences generates single jeopardy with custom categories and questions', () => {
  const customGame = createGameFromPreferences({
    title: 'Custom Tech Bowl',
    team1Name: 'Hackers',
    team2Name: 'Coders',
    numCategories: 4,
    numQuestionsPerCategory: 5,
    cluePointValues: [100, 200, 300, 400, 500],
    hintPenalty: 50,
    reboundPercentage: 75,
    includeFinalJeopardy: true,
  });

  assert.equal(customGame.title, 'Custom Tech Bowl');
  assert.equal(customGame.team1Name, 'Hackers');
  assert.equal(customGame.team2Name, 'Coders');
  assert.equal(customGame.reboundPercentage, 75);
  assert.equal(customGame.defaultHintDeduction, 50);
  assert.equal(customGame.rounds.length, 1); // Single Jeopardy only
  assert.equal(customGame.rounds[0].categories.length, 4);
  assert.equal(customGame.rounds[0].categories[0].clues.length, 5);
  assert.equal(customGame.rounds[0].categories[0].clues[0].points, 100);
  assert.equal(customGame.rounds[0].categories[0].clues[4].points, 500);
  assert.ok(customGame.finalJeopardy !== null);
  assert.equal(customGame.finalJeopardy?.category, '');
});

test('Preferences: Supports 3 to 7 categories and 3 to 8 rounds per category', () => {
  const gameMax = createGameFromPreferences({
    numCategories: 7,
    numQuestionsPerCategory: 8,
    includeFinalJeopardy: false, // Optional Final Jeopardy
  });

  assert.equal(gameMax.rounds.length, 1);
  assert.equal(gameMax.rounds[0].categories.length, 7);
  assert.equal(gameMax.rounds[0].categories[0].clues.length, 8);
  assert.equal(gameMax.rounds[0].categories[0].clues[0].points, 100);
  assert.equal(gameMax.rounds[0].categories[0].clues[7].points, 800);
  assert.equal(gameMax.finalJeopardy, undefined);
});

test('Preferences: Rebound percentage dynamically scales points on rebound', () => {
  const customGame = createGameFromPreferences({
    cluePointValues: [100, 200, 300, 400, 500],
    reboundPercentage: 75,
  });
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: customGame,
  });

  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 1,
      firstAnsweringTeam: 1,
    },
  });

  state = gameReducer(state, { type: 'ANSWER_WRONG', payload: { team: 1 } });
  state = gameReducer(state, { type: 'ADVANCE_REBOUND' });

  // 75% of 200 is 150
  assert.equal(state.activeClue?.currentAvailablePoints, 150);
});

test('Jeopardy Rules: Clue Selection', () => {
  const state = createLoadedState();
  const next = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 0,
      firstAnsweringTeam: 1,
    },
  });

  assert.ok(next.activeClue !== null);
  assert.equal(next.activeClue?.originalPoints, 100);
  assert.equal(next.activeClue?.currentAvailablePoints, 100);
  assert.equal(next.activeClue?.currentAnsweringTeam, 1);
  assert.equal(next.activeClue?.reboundOpportunity, false);
  assert.equal(next.config?.rounds[0].categories[0].clues[0].state, 'active');
});

test('Jeopardy Rules: Correct Answer awards full points without deduction', () => {
  let state = gameReducer(createLoadedState(), {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 1,
      firstAnsweringTeam: 1,
    }, // $200 clue
  });

  state = gameReducer(state, {
    type: 'ANSWER_CORRECT',
    payload: { team: 1 },
  });

  assert.equal(state.team1Score, 200);
  assert.equal(state.team2Score, 0);
  assert.equal(state.controllingTeam, 1);
  assert.equal(
    state.config?.rounds[0].categories[0].clues[1].state,
    'completed'
  );
  assert.deepEqual(state.config?.rounds[0].categories[0].clues[1].result, {
    winner: 1,
    type: 'full',
    pointsAwarded: 200,
  });
});

test('Jeopardy Rules: Incorrect Answer gives other team 50% rebound opportunity (no penalty)', () => {
  let state = gameReducer(createLoadedState(), {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 2,
      firstAnsweringTeam: 1,
    }, // $300 clue
  });

  // Team 1 is wrong
  state = gameReducer(state, {
    type: 'ANSWER_WRONG',
    payload: { team: 1 },
  });

  // Team 1 has NO point deduction!
  assert.equal(state.team1Score, 0);
  // Rebound is not automatically forced; admin decides to advance
  assert.equal(state.activeClue?.reboundOpportunity, false);
  assert.equal(state.activeClue?.reboundAvailable, true);

  // Admin clicks Advance to Rebound for Team 2 at 50% value ($150)
  state = gameReducer(state, { type: 'ADVANCE_REBOUND' });
  assert.equal(state.activeClue?.reboundOpportunity, true);
  assert.equal(state.activeClue?.currentAnsweringTeam, 2);
  assert.equal(state.activeClue?.currentAvailablePoints, 150);

  // Team 2 answers correctly on rebound!
  state = gameReducer(state, {
    type: 'ANSWER_CORRECT',
    payload: { team: 2 },
  });

  assert.equal(state.team1Score, 0);
  assert.equal(state.team2Score, 150);
  // During rebound correct, regular controlling team is not overwritten
  assert.equal(state.controllingTeam, 1);
  assert.deepEqual(state.config?.rounds[0].categories[0].clues[2].result, {
    winner: 2,
    type: 'rebound',
    pointsAwarded: 150,
  });

  // When clue is closed, turn alternates to Team 2 (giving a rebound answer doesn't take your turn away!)
  state = gameReducer(state, { type: 'CLOSE_CLUE' });
  assert.equal(state.controllingTeam, 2);
});

test('Admin Rebound Decision: Host can decide NOT to offer rebound and close clue with 0 pts', () => {
  let state = gameReducer(createLoadedState(), {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 3,
      firstAnsweringTeam: 1,
    }, // $800 clue
  });

  // Team 1 answers wrong
  state = gameReducer(state, { type: 'ANSWER_WRONG', payload: { team: 1 } });
  assert.equal(state.activeClue?.reboundAvailable, true);
  assert.equal(state.activeClue?.reboundOpportunity, false);

  // Host decides NOT to advance to rebound, closes clue
  state = gameReducer(state, { type: 'CLOSE_CLUE' });
  assert.equal(state.team1Score, 0);
  assert.equal(state.team2Score, 0);
  assert.deepEqual(state.config?.rounds[0].categories[0].clues[3].result, {
    winner: 'none',
    type: 'none',
    pointsAwarded: 0,
  });
  // Turn alternates to Team 2
  assert.equal(state.controllingTeam, 2);
});

test('Reset Specific Box: Resetting completed clue deducts score and restores unopened state', () => {
  let state = { ...createLoadedState(), controllingTeam: 1 as const };

  // 1. Select clue ($300 clue in Round 1, Cat 2, Clue 2)
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 2,
      clueIndex: 2,
      firstAnsweringTeam: 1,
    },
  });
  assert.equal(state.config?.rounds[0].categories[2].clues[2].state, 'active');

  // 2. Team 1 answers correctly -> gets $300
  state = gameReducer(state, { type: 'ANSWER_CORRECT', payload: { team: 1 } });
  assert.equal(state.team1Score, 300);

  // 3. Clue finished and closed
  state = gameReducer(state, { type: 'CLOSE_CLUE' });
  assert.equal(state.activeClue, null);
  assert.equal(
    state.config?.rounds[0].categories[2].clues[2].state,
    'completed'
  );

  // 4. Admin resets this specific box!
  state = gameReducer(state, {
    type: 'RESET_CLUE_BOX',
    payload: { roundIndex: 0, categoryIndex: 2, clueIndex: 2 },
  });

  // Verify: Team 1 score was deducted by $300 back to 0!
  assert.equal(
    state.team1Score,
    0,
    'Awarded points should be deducted when box is reset'
  );
  // Verify: Clue is back to unopened!
  assert.equal(
    state.config?.rounds[0].categories[2].clues[2].state,
    'unopened',
    'Box should be reset to unopened'
  );
  assert.equal(
    state.config?.rounds[0].categories[2].clues[2].result,
    undefined,
    'Result should be cleared'
  );
  assert.equal(state.activeClue, null);
});

test('Reset Specific Box: Resetting active clue closes modal and restores box', () => {
  let state = { ...createLoadedState(), controllingTeam: 1 as const };

  // Accidental box selection
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 1,
      clueIndex: 3,
      firstAnsweringTeam: 1,
    },
  });
  assert.ok(state.activeClue !== null);
  assert.equal(state.config?.rounds[0].categories[1].clues[3].state, 'active');

  // Admin clicks Reset Box (Unopened) in active modal
  state = gameReducer(state, {
    type: 'RESET_CLUE_BOX',
    payload: { roundIndex: 0, categoryIndex: 1, clueIndex: 3 },
  });

  assert.equal(state.activeClue, null, 'Active clue modal should close');
  assert.equal(
    state.config?.rounds[0].categories[1].clues[3].state,
    'unopened',
    'Box should be back to unopened'
  );
  assert.equal(state.team1Score, 0);
  assert.equal(state.team2Score, 0);
});

test('Reset Specific Box: Resetting rebound clue deducts 50% points from rebound winner', () => {
  let state = { ...createLoadedState(), controllingTeam: 1 as const };

  // 1. Select clue ($300)
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 2,
      clueIndex: 2,
      firstAnsweringTeam: 1,
    },
  });

  // 2. Team 1 wrong, advance to rebound for Team 2 ($150)
  state = gameReducer(state, { type: 'ANSWER_WRONG', payload: { team: 1 } });
  state = gameReducer(state, { type: 'ADVANCE_REBOUND' });
  state = gameReducer(state, { type: 'ANSWER_CORRECT', payload: { team: 2 } });
  assert.equal(state.team2Score, 150);

  // 3. Close clue
  state = gameReducer(state, { type: 'CLOSE_CLUE' });
  assert.equal(
    state.config?.rounds[0].categories[2].clues[2].state,
    'completed'
  );

  // 4. Admin resets box
  state = gameReducer(state, {
    type: 'RESET_CLUE_BOX',
    payload: { roundIndex: 0, categoryIndex: 2, clueIndex: 2 },
  });

  assert.equal(
    state.team2Score,
    0,
    'Rebound points should be deducted from Team 2'
  );
  assert.equal(
    state.config?.rounds[0].categories[2].clues[2].state,
    'unopened'
  );
});

test('Turn Alternation: Turns strictly alternate and host can manually override', () => {
  // 1. Host starts with Team 1
  let state = { ...createLoadedState(), controllingTeam: 1 as const };

  // 2. Team 1 plays clue 0
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 0,
      firstAnsweringTeam: 1,
    },
  });
  state = gameReducer(state, { type: 'ANSWER_CORRECT', payload: { team: 1 } });
  state = gameReducer(state, { type: 'CLOSE_CLUE' });

  // 3. Automatically alternates to Team 2
  assert.equal(state.controllingTeam, 2);

  // 4. Team 2 plays clue 1
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 1,
      firstAnsweringTeam: 2,
    },
  });
  state = gameReducer(state, { type: 'ANSWER_CORRECT', payload: { team: 2 } });
  state = gameReducer(state, { type: 'CLOSE_CLUE' });

  // 5. Automatically alternates back to Team 1
  assert.equal(state.controllingTeam, 1);

  // 6. Host manual override: host sets turn to Team 2
  state = gameReducer(state, {
    type: 'SET_CONTROLLING_TEAM',
    payload: { team: 2 },
  });
  assert.equal(state.controllingTeam, 2);

  // 7. Team 2 plays, misses, Team 1 gets rebound:
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 2,
      firstAnsweringTeam: 2,
    },
  });
  state = gameReducer(state, { type: 'ANSWER_WRONG', payload: { team: 2 } });
  state = gameReducer(state, { type: 'ADVANCE_REBOUND' });
  state = gameReducer(state, { type: 'ANSWER_CORRECT', payload: { team: 1 } }); // Team 1 rebound
  state = gameReducer(state, { type: 'CLOSE_CLUE' });

  // 8. Turn still alternates to Team 1 for their regular turn next!
  assert.equal(state.controllingTeam, 1);
});

test('Jeopardy Rules: Rebound team fails or passes -> 0 points awarded and result recorded as none', () => {
  let state = gameReducer(createLoadedState(), {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 4,
      firstAnsweringTeam: 1,
    }, // $500 clue
  });

  // Team 1 wrong
  state = gameReducer(state, { type: 'ANSWER_WRONG', payload: { team: 1 } });
  // Host advances to rebound
  state = gameReducer(state, { type: 'ADVANCE_REBOUND' });
  assert.equal(state.activeClue?.currentAvailablePoints, 250);

  // Team 2 also wrong
  state = gameReducer(state, { type: 'ANSWER_WRONG', payload: { team: 2 } });
  assert.equal(state.activeClue?.currentAvailablePoints, 0);
  assert.equal(state.activeClue?.reboundOpportunity, false);
  assert.equal(state.team1Score, 0);
  assert.equal(state.team2Score, 0);

  // Close clue
  state = gameReducer(state, { type: 'CLOSE_CLUE' });
  assert.deepEqual(state.config?.rounds[0].categories[0].clues[4].result, {
    winner: 'none',
    type: 'none',
    pointsAwarded: 0,
  });
});

test('Jeopardy Rules: Hint Deduction reduces prize points', () => {
  let state = gameReducer(createLoadedState(), {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 3,
      firstAnsweringTeam: 2,
    }, // $400 clue
  });

  // Reveal Hint (default deduction is 100)
  state = gameReducer(state, { type: 'REVEAL_HINT' });
  assert.equal(state.activeClue?.hintRevealed, true);
  assert.equal(state.activeClue?.currentAvailablePoints, 300); // 400 - 100 = 300

  // Team 2 answers correctly
  state = gameReducer(state, { type: 'ANSWER_CORRECT', payload: { team: 2 } });
  assert.equal(state.team2Score, 300);
});

test('Jeopardy Rules: Clue with empty hint cannot reveal hint or deduct points', () => {
  const customGame = createGameFromPreferences({
    numCategories: 3,
    numQuestionsPerCategory: 3,
  });
  // Clear hint for first clue with whitespace/empty string
  customGame.rounds[0].categories[0].clues[0].hint = '   ';
  customGame.rounds[0].categories[0].clues[0].points = 200;

  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: customGame,
  });
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 0,
      firstAnsweringTeam: 1,
    },
  });

  // Attempt to reveal hint
  state = gameReducer(state, { type: 'REVEAL_HINT' });
  assert.equal(state.activeClue?.hintRevealed, false);
  assert.equal(state.activeClue?.currentAvailablePoints, 200);
});

test('Jeopardy Rules: Final Jeopardy Wagers & Scoring', () => {
  let state = {
    ...createLoadedState(),
    team1Score: 3000,
    team2Score: 2400,
    currentRoundIndex: -1,
  };

  // Set wagers
  state = gameReducer(state, {
    type: 'FJ_SET_WAGERS',
    payload: { team1Wager: 2000, team2Wager: 2400 },
  });

  assert.equal(state.config?.finalJeopardy?.team1Wager, 2000);
  assert.equal(state.config?.finalJeopardy?.team2Wager, 2400);

  // Judge: Team 1 correct (+2000), Team 2 wrong (-2400)
  state = gameReducer(state, {
    type: 'FJ_JUDGE',
    payload: { team1Correct: true, team2Correct: false },
  });

  assert.equal(state.team1Score, 5000);
  assert.equal(state.team2Score, 0);
  assert.equal(state.config?.finalJeopardy?.answersRevealed, true);
});

test('Host Tools: Manual Score Override', () => {
  const state = gameReducer(createLoadedState(), {
    type: 'OVERRIDE_SCORES',
    payload: { team1Score: 1500, team2Score: 1200 },
  });

  assert.equal(state.team1Score, 1500);
  assert.equal(state.team2Score, 1200);
});

test('Window Management: displayWindowOpen state is preserved across reducer actions', () => {
  const stateWithWindowOpen = {
    ...createLoadedState(),
    displayWindowOpen: true,
  };

  const nextState = gameReducer(stateWithWindowOpen, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 0,
      firstAnsweringTeam: 1,
    },
  });

  assert.equal(nextState.displayWindowOpen, true);

  const closedClueState = gameReducer(nextState, {
    type: 'CLOSE_CLUE',
  });

  assert.equal(closedClueState.displayWindowOpen, true);
});

test('State Sync: SYNC_STATE adopts state and preserves display', () => {
  const localState = {
    ...initialGameState,
    displayWindowOpen: true,
  };

  const remoteState = {
    ...createLoadedState(),
    team1Score: 1200,
    team2Score: 800,
    controllingTeam: 2 as const,
    displayWindowOpen: false,
  };

  const syncedState = gameReducer(localState, {
    type: 'SYNC_STATE',
    payload: remoteState,
  });

  assert.equal(syncedState.config?.title, defaultGame.title);
  assert.equal(syncedState.team1Score, 1200);
  assert.equal(syncedState.team2Score, 800);
  assert.equal(syncedState.controllingTeam, 2);
  assert.equal(syncedState.displayWindowOpen, true);
});

test('Save Game: Cancellation does not mark game as saved', async () => {
  let isSaved: boolean;
  let savedYaml: string | null = null;
  const currentConfig = defaultGame;
  const currentYaml = yaml.stringify(currentConfig);

  // Mock save function where user clicks Cancel in dialog
  const mockSaveGameFileCancel = async () => false;

  const success = await mockSaveGameFileCancel();
  if (success) {
    savedYaml = currentYaml;
  }

  isSaved = savedYaml !== null && yaml.stringify(currentConfig) === savedYaml;
  assert.equal(success, false);
  assert.equal(
    isSaved,
    false,
    'Game should NOT be marked as saved when dialog is cancelled'
  );

  // When save actually succeeds
  const mockSaveGameFileSuccess = async () => true;
  const saveSuccess = await mockSaveGameFileSuccess();
  if (saveSuccess) {
    savedYaml = currentYaml;
  }
  isSaved = savedYaml !== null && yaml.stringify(currentConfig) === savedYaml;
  assert.equal(saveSuccess, true);
  assert.equal(
    isSaved,
    true,
    'Game should be marked as saved when file is written'
  );
});

test('YAML Game File: Clean format contains only configuration, zero gameplay state', () => {
  const original = defaultGame;
  const yamlString = serializeGameConfigToYaml(original);

  assert.ok(typeof yamlString === 'string');
  assert.ok(yamlString.includes('title:'));
  assert.ok(
    yamlString.includes('pointProgression:'),
    'Should contain top-level pointProgression'
  );
  assert.ok(
    !yamlString.includes('points:'),
    'Should not contain per-question points tags'
  );
  assert.ok(yamlString.includes('categories:'));
  assert.ok(
    yamlString.includes('questions:'),
    'Should use questions instead of clues'
  );
  assert.ok(!yamlString.includes('clues:'), 'Should not contain clues tag');

  // Ensure NO runtime gameplay state is leaked into disk file
  assert.ok(
    !yamlString.includes('state: unopened'),
    'Should not contain runtime state: unopened'
  );
  assert.ok(
    !yamlString.includes('round-1'),
    'Should not contain internal round ID'
  );
  assert.ok(
    !yamlString.includes('c-r1-cat'),
    'Should not contain internal clue IDs'
  );
  assert.ok(
    !yamlString.includes('team1Score'),
    'Should not contain runtime scores'
  );
  assert.ok(
    !yamlString.includes('result:'),
    'Should not contain runtime judge results'
  );

  // Verify full restoration into working GameConfig
  const parsed = parseGameConfigFromYaml(yamlString);
  assert.equal(parsed.title, original.title);
  assert.equal(parsed.team1Name, original.team1Name);
  assert.equal(parsed.team2Name, original.team2Name);
  assert.equal(
    parsed.rounds[0].categories.length,
    original.rounds[0].categories.length
  );
  assert.equal(
    parsed.rounds[0].categories[0].clues.length,
    original.rounds[0].categories[0].clues.length
  );
  assert.equal(parsed.rounds[0].categories[0].clues[0].state, 'unopened');
  assert.ok(
    parsed.rounds[0].categories[0].clues[0].id.startsWith('c-r1-cat1-')
  );
  assert.equal(
    parsed.rounds[0].categories[0].clues[0].question,
    original.rounds[0].categories[0].clues[0].question
  );
  assert.equal(parsed.rounds[0].categories[0].clues[0].points, 100);
  assert.equal(parsed.rounds[0].categories[0].clues[1].points, 200);
});

test('YouTube Utils: parseYouTubeTimestamp parses diverse timestamp formats into seconds', () => {
  assert.equal(parseYouTubeTimestamp('90'), 90);
  assert.equal(parseYouTubeTimestamp('90s'), 90);
  assert.equal(parseYouTubeTimestamp('1m30s'), 90);
  assert.equal(parseYouTubeTimestamp('2m'), 120);
  assert.equal(parseYouTubeTimestamp('45s'), 45);
  assert.equal(parseYouTubeTimestamp('1h'), 3600);
  assert.equal(parseYouTubeTimestamp('1h30m'), 5400);
  assert.equal(parseYouTubeTimestamp('1h2m3s'), 3723);
  assert.equal(parseYouTubeTimestamp('01:30'), 90);
  assert.equal(parseYouTubeTimestamp('1:02:03'), 3723);
  assert.equal(parseYouTubeTimestamp(''), null);
  assert.equal(parseYouTubeTimestamp(undefined), null);
  assert.equal(parseYouTubeTimestamp('invalid'), null);
});

test('YouTube Utils: formatSecondsToTime formats seconds into readable time string', () => {
  assert.equal(formatSecondsToTime(90), '1:30');
  assert.equal(formatSecondsToTime(45), '0:45');
  assert.equal(formatSecondsToTime(3723), '1:02:03');
  assert.equal(formatSecondsToTime(0), '0:00');
});

test('YouTube Utils: parseYouTubeUrl extracts videoId and generates embed URL with timestamp parameter', () => {
  // Standard watch URL with t=1m30s
  const res1 = parseYouTubeUrl(
    'https://www.youtube.com/watch?v=Psxktpxkc6o&t=1m30s'
  );
  assert.equal(res1.videoId, 'Psxktpxkc6o');
  assert.equal(res1.startTimestampSeconds, 90);
  assert.ok(
    res1.embedUrl.includes('https://www.youtube-nocookie.com/embed/Psxktpxkc6o')
  );
  assert.ok(res1.embedUrl.includes('&start=90'));

  // youtu.be URL with t=90s
  const res2 = parseYouTubeUrl('https://youtu.be/Psxktpxkc6o?t=90s');
  assert.equal(res2.videoId, 'Psxktpxkc6o');
  assert.equal(res2.startTimestampSeconds, 90);
  assert.ok(res2.embedUrl.includes('&start=90'));

  // URL with start=120
  const res3 = parseYouTubeUrl(
    'https://www.youtube.com/watch?v=Psxktpxkc6o&start=120'
  );
  assert.equal(res3.videoId, 'Psxktpxkc6o');
  assert.equal(res3.startTimestampSeconds, 120);
  assert.ok(res3.embedUrl.includes('&start=120'));

  // URL with hash timestamp #t=45s
  const res4 = parseYouTubeUrl(
    'https://www.youtube.com/watch?v=Psxktpxkc6o#t=45s'
  );
  assert.equal(res4.videoId, 'Psxktpxkc6o');
  assert.equal(res4.startTimestampSeconds, 45);
  assert.ok(res4.embedUrl.includes('&start=45'));

  // URL without timestamp starts at beginning without &start=
  const res5 = parseYouTubeUrl('https://www.youtube.com/watch?v=Psxktpxkc6o');
  assert.equal(res5.videoId, 'Psxktpxkc6o');
  assert.equal(res5.startTimestampSeconds, null);
  assert.ok(!res5.embedUrl.includes('&start='));
  assert.ok(!res5.embedUrl.includes('&controls=0'));

  // When showControls is false, URL includes controls=0
  const res6 = parseYouTubeUrl(
    'https://www.youtube.com/watch?v=Psxktpxkc6o',
    undefined,
    false
  );
  assert.ok(res6.embedUrl.includes('&controls=0'));
  assert.ok(res6.embedUrl.includes('&rel=0'));
});

test('Load Game File: Successfully loads custom game JSON with custom categories and questions', () => {
  const customConfig = {
    title: "dipika's game",
    team1Name: 'rohit',
    team2Name: 'tejal',
    defaultHintDeduction: 100,
    reboundPercentage: 50,
    pointProgression: [100, 200, 300],
    rounds: [
      {
        id: 'round-1',
        name: 'Jeopardy Round',
        categories: [
          {
            id: 'cat-r1-1',
            name: 'baby facts',
            clues: [
              {
                id: 'c-1',
                points: 100,
                question: 'question 1',
                answer: 'answer 1',
                hint: '',
                state: 'unopened' as const,
              },
              {
                id: 'c-2',
                points: 200,
                question: 'quest 2',
                answer: 'ans 2',
                hint: 'hint 2',
                state: 'unopened' as const,
              },
              {
                id: 'c-3',
                points: 300,
                question: '',
                answer: '',
                hint: '',
                state: 'unopened' as const,
              },
            ],
          },
          {
            id: 'cat-r1-2',
            name: 'baby movies',
            clues: [
              {
                id: 'c-4',
                points: 100,
                question: '',
                answer: '',
                hint: '',
                state: 'unopened' as const,
              },
              {
                id: 'c-5',
                points: 200,
                question: '',
                answer: '',
                hint: '',
                state: 'unopened' as const,
              },
              {
                id: 'c-6',
                points: 300,
                question: '',
                answer: '',
                hint: '',
                state: 'unopened' as const,
              },
            ],
          },
          {
            id: 'cat-r1-3',
            name: 'baby movies',
            clues: [
              {
                id: 'c-7',
                points: 100,
                question: '',
                answer: '',
                hint: '',
                state: 'unopened' as const,
              },
              {
                id: 'c-8',
                points: 200,
                question: '',
                answer: '',
                hint: '',
                state: 'unopened' as const,
              },
              {
                id: 'c-9',
                points: 300,
                question: '',
                answer: '',
                hint: '',
                state: 'unopened' as const,
              },
            ],
          },
        ],
      },
    ],
  };

  const loadedState = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: customConfig,
  });
  assert.ok(loadedState.config !== null);
  assert.equal(loadedState.config.title, "dipika's game");
  assert.equal(loadedState.config.team1Name, 'rohit');
  assert.equal(loadedState.config.team2Name, 'tejal');
  assert.equal(loadedState.config.rounds[0].categories.length, 3);
  assert.equal(loadedState.config.rounds[0].categories[0].name, 'baby facts');
  assert.equal(
    loadedState.config.rounds[0].categories[0].clues[0].question,
    'question 1'
  );
  assert.equal(
    loadedState.config.rounds[0].categories[0].clues[0].answer,
    'answer 1'
  );
  assert.equal(loadedState.config.rounds[0].categories[1].name, 'baby movies');
});

test('Load Game File: Successfully parses YAML without question points using pointProgression', () => {
  const yamlText = `
title: "dipika's game"
team1: rohit
team2: tejal
pointProgression:
  - 100
  - 200
  - 300
hintPenalty: 100
reboundPercentage: 50
categories:
  - name: baby facts
    questions:
      - title: question 1
        answer: answer 1
      - title: quest 2
        answer: ans 2
        hint: hint 2
      - title: ""
        answer: ""
  - name: baby movies
    questions:
      - title: ""
        answer: ""
      - title: ""
        answer: ""
      - title: ""
        answer: ""
`;

  const parsed = parseGameConfigFromYaml(yamlText);
  assert.equal(parsed.title, "dipika's game");
  assert.equal(parsed.team1Name, 'rohit');
  assert.equal(parsed.team2Name, 'tejal');
  assert.equal(parsed.rounds[0].categories.length, 2);
  assert.equal(parsed.rounds[0].categories[0].clues.length, 3);
  assert.equal(parsed.rounds[0].categories[0].clues[0].points, 100);
  assert.equal(parsed.rounds[0].categories[0].clues[1].points, 200);
  assert.equal(parsed.rounds[0].categories[0].clues[2].points, 300);
  assert.equal(parsed.rounds[0].categories[0].clues[1].hint, 'hint 2');

  const loadedState = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: parsed,
  });
  assert.ok(loadedState.config !== null);
  assert.equal(loadedState.config.rounds[0].categories[0].clues[1].points, 200);
});

test('Sample Trivia Game: Successfully parses 5x5 game with diverse multimedia', () => {
  const filePath = path.resolve(process.cwd(), 'sample_trivia_game.yaml');
  const content = fs.readFileSync(filePath, 'utf-8');

  const config = parseGameConfigFromYaml(content);
  assert.equal(config.title, 'Ultimate Trivia Challenge');
  assert.equal(config.team1Name, 'Team Alpha');
  assert.equal(config.team2Name, 'Team Omega');
  assert.equal(config.rounds.length, 1);

  const categories = config.rounds[0].categories;
  assert.equal(categories.length, 5);

  const mediaTypesFound = new Set<string>();
  for (const cat of categories) {
    assert.equal(cat.clues.length, 5);
    cat.clues.forEach((clue, idx) => {
      assert.equal(clue.points, (idx + 1) * 100);
      if (clue.media?.type) {
        mediaTypesFound.add(clue.media.type);
      }
    });
  }

  assert.ok(mediaTypesFound.has('image'), 'Should contain image media');
  assert.ok(mediaTypesFound.has('audio'), 'Should contain audio media');
  assert.ok(mediaTypesFound.has('video'), 'Should contain video media');
  assert.ok(mediaTypesFound.has('youtube'), 'Should contain youtube media');

  assert.ok(config.finalJeopardy);
  assert.equal(config.finalJeopardy?.category, 'THE COSMOS');
  assert.equal(config.finalJeopardy?.media?.type, 'image');

  // Verify YAML round-trip serialization
  const serialized = serializeGameConfigToYaml(config);
  assert.ok(serialized.includes('pointProgression:'));
  assert.ok(!serialized.includes('points:'));
  const reparsed = parseGameConfigFromYaml(serialized);
  assert.equal(reparsed.rounds[0].categories.length, 5);
});

test('Team Management: SET_TEAMS updates team names in active configuration', () => {
  let state = createLoadedState();
  state = gameReducer(state, {
    type: 'SET_TEAMS',
    payload: { team1Name: 'Red Rockets', team2Name: 'Blue Comets' },
  });

  assert.equal(state.config?.team1Name, 'Red Rockets');
  assert.equal(state.config?.team2Name, 'Blue Comets');
});

test('Media Controls: REVEAL_MEDIA, HIDE_MEDIA, and SET_MEDIA_PLAYING', () => {
  let state = createLoadedState();
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 0,
      firstAnsweringTeam: 1,
    },
  });

  assert.equal(state.activeClue?.mediaRevealed, false);
  assert.equal(state.activeClue?.mediaPlaying, false);

  // Reveal media starts playback
  state = gameReducer(state, { type: 'REVEAL_MEDIA' });
  assert.equal(state.activeClue?.mediaRevealed, true);
  assert.equal(state.activeClue?.mediaPlaying, true);

  // Toggle play/pause
  state = gameReducer(state, {
    type: 'SET_MEDIA_PLAYING',
    payload: { playing: false },
  });
  assert.equal(state.activeClue?.mediaPlaying, false);

  // Hide media stops playback
  state = gameReducer(state, { type: 'HIDE_MEDIA' });
  assert.equal(state.activeClue?.mediaRevealed, false);
  assert.equal(state.activeClue?.mediaPlaying, false);

  // Calling without active clue is a no-op
  const closedState = gameReducer(state, { type: 'CLOSE_CLUE' });
  const noopState = gameReducer(closedState, { type: 'REVEAL_MEDIA' });
  assert.equal(noopState.activeClue, null);
});

test('Clue Lifecycle: REVEAL_ANSWER reveals answer without closing clue', () => {
  let state = createLoadedState();
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 0,
      firstAnsweringTeam: 1,
    },
  });

  assert.equal(state.activeClue?.answerRevealed, false);
  state = gameReducer(state, { type: 'REVEAL_ANSWER' });
  assert.equal(state.activeClue?.answerRevealed, true);
  assert.ok(state.activeClue !== null);
});

test('Rebound Lifecycle: PASS_REBOUND marks clue passed with 0 points', () => {
  let state = createLoadedState();
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 0,
      firstAnsweringTeam: 1,
    },
  });

  // Team 1 misses
  state = gameReducer(state, {
    type: 'ANSWER_WRONG',
    payload: { team: 1 },
  });
  state = gameReducer(state, { type: 'ADVANCE_REBOUND' });
  assert.equal(state.activeClue?.reboundOpportunity, true);

  // Team 2 passes on rebound
  state = gameReducer(state, { type: 'PASS_REBOUND' });
  assert.equal(state.activeClue?.reboundOpportunity, false);
  assert.equal(state.activeClue?.reboundAvailable, false);
  assert.equal(state.activeClue?.currentAvailablePoints, 0);
  assert.equal(state.activeClue?.lastJudgedResult, 'passed');
});

test('Hint Deductions: Points clamp to zero when deduction exceeds clue value', () => {
  const customConfig = createGameFromPreferences({
    cluePointValues: [50, 100, 150],
    hintPenalty: 100, // Penalty is greater than first clue (50 pts)
  });
  // Add hint to first clue
  customConfig.rounds[0].categories[0].clues[0].hint = 'Helpful hint';
  customConfig.rounds[0].categories[0].clues[0].hintDeduction = 100;

  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: customConfig,
  });
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 0,
      firstAnsweringTeam: 1,
    },
  });

  state = gameReducer(state, { type: 'REVEAL_HINT' });
  // Math.max(0, 50 - 100) = 0 points
  assert.equal(state.activeClue?.currentAvailablePoints, 0);
  assert.equal(state.activeClue?.hintRevealed, true);

  // Subsequent call does not deduct again
  const reState = gameReducer(state, { type: 'REVEAL_HINT' });
  assert.equal(reState.activeClue?.currentAvailablePoints, 0);
});

test('Game Reset: RESET_GAME clears scores and resets clue states to unopened', () => {
  let state = createLoadedState();
  // Open and answer a clue
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 0,
      firstAnsweringTeam: 1,
    },
  });
  state = gameReducer(state, {
    type: 'ANSWER_CORRECT',
    payload: { team: 1 },
  });
  state = gameReducer(state, { type: 'CLOSE_CLUE' });

  assert.equal(state.team1Score, 100);
  const clue0 = state.config?.rounds[0].categories[0].clues[0];
  assert.equal(clue0?.state, 'completed');

  // Trigger full reset
  state = gameReducer(state, { type: 'RESET_GAME' });

  assert.equal(state.team1Score, 0);
  assert.equal(state.team2Score, 0);
  assert.equal(state.controllingTeam, 1);
  assert.equal(state.currentRoundIndex, 0);
  assert.equal(state.activeClue, null);
  // All clues restored to unopened
  state.config?.rounds.forEach((round) => {
    round.categories.forEach((cat) => {
      cat.clues.forEach((clue) => {
        assert.equal(clue.state, 'unopened');
        assert.equal(clue.result, undefined);
      });
    });
  });
});

test('Final Jeopardy: FJ_REVEAL_QUESTION reveals question in state', () => {
  let state = createLoadedState();
  assert.equal(state.config?.finalJeopardy?.questionRevealed ?? false, false);

  state = gameReducer(state, { type: 'FJ_REVEAL_QUESTION' });
  assert.equal(state.config?.finalJeopardy?.questionRevealed, true);
});

test('Media Actions: ANSWER_CORRECT hides and halts media playback', () => {
  let state = createLoadedState();
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 0,
      firstAnsweringTeam: 1,
    },
  });

  state = gameReducer(state, { type: 'REVEAL_MEDIA' });
  assert.equal(state.activeClue?.mediaRevealed, true);
  assert.equal(state.activeClue?.mediaPlaying, true);

  state = gameReducer(state, {
    type: 'ANSWER_CORRECT',
    payload: { team: 1 },
  });

  assert.equal(state.activeClue?.mediaRevealed, false);
  assert.equal(state.activeClue?.mediaPlaying, false);
  assert.equal(state.activeClue?.answerRevealed, true);
  assert.equal(state.activeClue?.correctTeam, 1);
});

test('Media Actions: REVEAL_ANSWER hides and halts media playback', () => {
  let state = createLoadedState();
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 0,
      firstAnsweringTeam: 1,
    },
  });

  state = gameReducer(state, { type: 'REVEAL_MEDIA' });
  assert.equal(state.activeClue?.mediaRevealed, true);

  state = gameReducer(state, { type: 'REVEAL_ANSWER' });
  assert.equal(state.activeClue?.mediaRevealed, false);
  assert.equal(state.activeClue?.mediaPlaying, false);
  assert.equal(state.activeClue?.answerRevealed, true);
});

test('Media Actions: Rebound failure and pass hide and halt media playback', () => {
  let state = createLoadedState();
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 0,
      firstAnsweringTeam: 1,
    },
  });

  state = gameReducer(state, { type: 'REVEAL_MEDIA' });
  assert.equal(state.activeClue?.mediaRevealed, true);
  assert.equal(state.activeClue?.mediaPlaying, true);

  // First team incorrect pauses playback
  state = gameReducer(state, {
    type: 'ANSWER_WRONG',
    payload: { team: 1 },
  });
  assert.equal(state.activeClue?.mediaPlaying, false);
  assert.equal(state.activeClue?.reboundAvailable, true);

  // Rebound attempt starts
  state = gameReducer(state, { type: 'ADVANCE_REBOUND' });
  assert.equal(state.activeClue?.reboundOpportunity, true);
  assert.equal(state.activeClue?.mediaPlaying, false);

  // Second team incorrect -> both missed -> media hidden
  const missState = gameReducer(state, {
    type: 'ANSWER_WRONG',
    payload: { team: 2 },
  });
  assert.equal(missState.activeClue?.mediaRevealed, false);
  assert.equal(missState.activeClue?.mediaPlaying, false);
  assert.equal(missState.activeClue?.incorrectTeams?.length, 2);

  // Alternatively, passing rebound also hides media
  const passState = gameReducer(state, { type: 'PASS_REBOUND' });
  assert.equal(passState.activeClue?.mediaRevealed, false);
  assert.equal(passState.activeClue?.mediaPlaying, false);
});

test('Game Rules: isBoardComplete accurately detects completion', () => {
  assert.equal(isBoardComplete(null), false);

  const state = createLoadedState();
  assert.equal(isBoardComplete(state.config), false);

  // Mark all clues as completed
  const completedConfig = {
    ...state.config!,
    rounds: state.config!.rounds.map((r) => ({
      ...r,
      categories: r.categories.map((c) => ({
        ...c,
        clues: c.clues.map((cl) => ({ ...cl, state: 'completed' as const })),
      })),
    })),
  };
  assert.equal(isBoardComplete(completedConfig), true);
});

test('Game Rules: getWinnerState evaluates regulation wins and ties', () => {
  const customGame = createGameFromPreferences({
    title: 'Short Game',
    team1Name: 'Alpha',
    team2Name: 'Beta',
    numCategories: 3,
    numQuestionsPerCategory: 3,
    includeFinalJeopardy: false,
  });

  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: customGame,
  });

  // Game in progress
  let winner = getWinnerState(state);
  assert.equal(winner.isGameOver, false);
  assert.equal(winner.winner, null);

  // Complete all clues
  const completedRounds = state.config!.rounds.map((r) => ({
    ...r,
    categories: r.categories.map((c) => ({
      ...c,
      clues: c.clues.map((cl) => ({ ...cl, state: 'completed' as const })),
    })),
  }));

  state = {
    ...state,
    config: {
      ...state.config!,
      rounds: completedRounds,
    },
    team1Score: 600,
    team2Score: 400,
  };

  // Case 1: Regulation Win Team 1
  winner = getWinnerState(state);
  assert.equal(winner.isGameOver, true);
  assert.equal(winner.winner, 'team1');
  assert.equal(winner.winningTeamName, 'Alpha');
  assert.equal(winner.reason, 'regulation_win');

  // Case 2: Regulation Win Team 2
  state = { ...state, team1Score: 300, team2Score: 500 };
  winner = getWinnerState(state);
  assert.equal(winner.isGameOver, true);
  assert.equal(winner.winner, 'team2');
  assert.equal(winner.winningTeamName, 'Beta');
  assert.equal(winner.reason, 'regulation_win');

  // Case 3: Regulation Tie without Final Jeopardy -> Co-Winners immediately
  state = { ...state, team1Score: 500, team2Score: 500 };
  winner = getWinnerState(state);
  assert.equal(winner.isGameOver, true);
  assert.equal(winner.winner, 'tie');
  assert.equal(winner.reason, 'regulation_tie');
  assert.equal(winner.canProceedToTieBreaker, false);
});

test('Game Rules: getWinnerState handles tie-breaker decisions', () => {
  const gameWithFJ = createGameFromPreferences({
    title: 'Championship Match',
    team1Name: 'Lions',
    team2Name: 'Tigers',
    numCategories: 3,
    numQuestionsPerCategory: 3,
    includeFinalJeopardy: true,
  });

  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: gameWithFJ,
  });

  const completedRounds = state.config!.rounds.map((r) => ({
    ...r,
    categories: r.categories.map((c) => ({
      ...c,
      clues: c.clues.map((cl) => ({ ...cl, state: 'completed' as const })),
    })),
  }));

  state = {
    ...state,
    config: { ...state.config!, rounds: completedRounds },
    team1Score: 800,
    team2Score: 800,
  };

  // Tied regulation with tie-breaker configured -> host must decide
  let winner = getWinnerState(state);
  assert.equal(winner.isGameOver, false);
  assert.equal(winner.canProceedToTieBreaker, true);

  // Host decides to declare co-winners directly
  const coWinnersState = gameReducer(state, { type: 'DECLARE_CO_WINNERS' });
  assert.equal(coWinnersState.coWinnersDeclared, true);
  winner = getWinnerState(coWinnersState);
  assert.equal(winner.isGameOver, true);
  assert.equal(winner.winner, 'tie');
  assert.equal(winner.reason, 'regulation_tie');

  // Host decides to proceed with tie-breaker
  let fjState = gameReducer(state, {
    type: 'SET_ROUND',
    payload: { roundIndex: -1 },
  });
  fjState = gameReducer(fjState, {
    type: 'FJ_SET_WAGERS',
    payload: { team1Wager: 300, team2Wager: 200 },
  });
  fjState = gameReducer(fjState, { type: 'FJ_REVEAL_QUESTION' });

  // Before judging: tie-breaker in progress
  winner = getWinnerState(fjState);
  assert.equal(winner.isGameOver, false);

  // Team 1 gets it right, Team 2 wrong -> Team 1 wins
  const judgedState = gameReducer(fjState, {
    type: 'FJ_JUDGE',
    payload: { team1Correct: true, team2Correct: false },
  });
  winner = getWinnerState(judgedState);
  assert.equal(winner.isGameOver, true);
  assert.equal(winner.winner, 'team1');
  assert.equal(winner.winningTeamName, 'Lions');
  assert.equal(winner.reason, 'tie_breaker_win');
  assert.equal(judgedState.team1Score, 1100);
  assert.equal(judgedState.team2Score, 600);
});

test('Game Rules: DECLARE_CO_WINNERS resolves tied game immediately', () => {
  const game = createGameFromPreferences({
    title: 'Instant Co-Winners Match',
    team1Name: 'Team A',
    team2Name: 'Team B',
    numCategories: 3,
    numQuestionsPerCategory: 3,
    includeFinalJeopardy: true,
  });

  const state = {
    ...initialGameState,
    config: game,
    team1Score: 400,
    team2Score: 400,
    coWinnersDeclared: true,
  };

  const outcome = getWinnerState(state);
  assert.equal(outcome.isGameOver, true);
  assert.equal(outcome.winner, 'tie');
  assert.equal(outcome.reason, 'regulation_tie');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseGameConfigFromYaml } from '../src/utils/gameYaml';
import {
  PlayerDisplay,
  CategoryHeaderCard,
  QuestionTimerBadge,
  SCORE_SPIN_DURATION_MS,
  calculateAnimatedScore,
} from '../src/views/PlayerDisplay';
import { AdminHost, CreateGameModal } from '../src/views/AdminHost';
import { GameBuilder } from '../src/components/builder/GameBuilder';
import { MediaRenderer } from '../src/components/common/MediaRenderer';
import { MediaIndicator } from '../src/components/common/MediaIndicator';
import { MobileConnectModal } from '../src/components/common/MobileConnectModal';
import { CompletedClueModal } from '../src/components/common/CompletedClueModal';
import { defaultGame } from '../src/data/defaultGame';
import { maxSampleGame } from '../src/data/maxSampleGame';
import { initialGameState, gameReducer } from '../src/utils/gameReducer';
import { createGameFromPreferences } from '../src/types/game';

test(
  'PlayerDisplay UI: Waiting screen displays logo, tagline, and message',
  () => {
  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state: initialGameState,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(html.includes('logo.svg'));
  assert.ok(html.includes('Trivia, Team Fights &amp; Petty Rivalries'));
  assert.ok(html.includes('Waiting for the host to start the game...'));
  assert.ok(!html.includes('Player Board'));
});

test(
  'PlayerDisplay UI: Active Board Grid renders categories and clue tiles',
  () => {
  const state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(html.includes('WORLD GEOGRAPHY'));
  assert.ok(html.includes('SCIENCE &amp; NATURE'));
  assert.ok(html.includes('text-modern-gold'));
  assert.ok(html.includes('$100'));
  assert.ok(html.includes('$500'));
  assert.ok(html.includes('Champions'));
  assert.ok(html.includes('Challengers'));

  // Classic Jeopardy Royal Blue aesthetic assertions
  assert.ok(
    html.includes('from-[#082470] to-[#051644]'),
    'Category headers must use royal sapphire gradient'
  );
  assert.ok(
    html.includes('from-[#08206b] to-[#05133d]'),
    'Clue tiles must use royal sapphire vertical gradient'
  );
  assert.ok(
    html.includes('border-t border-blue-900/60'),
    'Scoreboard HUD must use edge-to-edge broadcast bar styling'
  );
  assert.ok(
    !html.includes('glass-category-card'),
    'Obsolete glass-category-card must not be present'
  );
});

test(
  'PlayerDisplay UI: Detailed question view has flat category & chunky points',
  () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
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

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(html.includes('bg-blue-500/20'));
  assert.ok(html.includes('text-blue-100'));
  assert.ok(html.includes('WORLD GEOGRAPHY'));
  assert.ok(html.includes('Danube River'));
  assert.ok(html.includes('font-display font-bold text-white'));
  assert.ok(html.includes('$100'));
  assert.ok(html.includes('text-modern-gold font-display leading-none'));
});

test(
  'QuestionTimerBadge UI: Renders waiting, active, urgent, and expired',
  () => {
  const waitingHtml = renderToStaticMarkup(
    React.createElement(QuestionTimerBadge, {
      remaining: 30,
      isWaitingForMedia: true,
    })
  );
  assert.ok(waitingHtml.includes('00:30'));
  assert.ok(waitingHtml.includes('Timer starts when media is shown'));

  const activeHtml = renderToStaticMarkup(
    React.createElement(QuestionTimerBadge, {
      remaining: 11,
      isWaitingForMedia: false,
    })
  );
  assert.ok(activeHtml.includes('00:11'));
  assert.ok(activeHtml.includes('text-sky-300'));
  assert.ok(
    !activeHtml.includes('text-modern-gold'),
    'Timer must not use gold reserved for points'
  );
  assert.ok(activeHtml.includes('font-display font-bold'));
  assert.ok(!activeHtml.includes('font-mono'));
  assert.ok(!activeHtml.includes('animate-timer-blink'));

  const thresholdHtml = renderToStaticMarkup(
    React.createElement(QuestionTimerBadge, {
      remaining: 10,
      isWaitingForMedia: false,
    })
  );
  assert.ok(thresholdHtml.includes('00:10'));
  assert.ok(thresholdHtml.includes('text-amber-300'));
  assert.ok(thresholdHtml.includes('animate-timer-blink'));

  const urgentHtml = renderToStaticMarkup(
    React.createElement(QuestionTimerBadge, {
      remaining: 4,
      isWaitingForMedia: false,
    })
  );
  assert.ok(urgentHtml.includes('00:04'));
  assert.ok(urgentHtml.includes('text-amber-300'));
  assert.ok(urgentHtml.includes('animate-timer-blink'));

  const expiredHtml = renderToStaticMarkup(
    React.createElement(QuestionTimerBadge, {
      remaining: 0,
      isWaitingForMedia: false,
    })
  );
  assert.ok(expiredHtml.includes('00:00'));
  assert.ok(expiredHtml.includes('text-rose-300'));
  assert.ok(!expiredHtml.includes('animate-timer-blink'));
});

test(
  'PlayerDisplay UI: Question timer renders countdown on active clue',
  () => {
  const timerGame = {
    ...defaultGame,
    questionTimerSeconds: 30,
  };

  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: timerGame,
  });

  const now = Date.now();
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 0,
      firstAnsweringTeam: 1,
      timerStartedAt: now - 5000,
    },
  });

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(html.includes('00:25'));
  assert.ok(html.includes('tabular-nums'));
});

test(
  'PlayerDisplay UI: Question timer renders blink animation at 10s and down',
  () => {
  const timerGame = {
    ...defaultGame,
    questionTimerSeconds: 30,
  };

  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: timerGame,
  });

  const now = Date.now();
  // 20s elapsed -> 10s remaining (threshold)
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 0,
      firstAnsweringTeam: 1,
      timerStartedAt: now - 20000,
    },
  });

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(html.includes('00:10'));
  assert.ok(html.includes('animate-timer-blink'));
  assert.ok(html.includes('text-amber-300'));
});

test(
  'PlayerDisplay UI: Wrong answer displays red border around clue box',
  () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
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
  state = gameReducer(state, {
    type: 'ANSWER_WRONG',
    payload: { team: 1 },
  });

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(html.includes('!border-2 !border-rose-500'));
  assert.ok(html.includes('Missed'));
});

test(
  'PlayerDisplay UI: Answer revealed banner renders with chunky font',
  () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
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
  state = gameReducer(state, {
    type: 'ANSWER_CORRECT',
    payload: { team: 1 },
  });

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(html.includes('Budapest'));
  assert.ok(html.includes('font-black uppercase tracking-wide text-white'));
  assert.ok(html.includes('font-display'));
});

test('PlayerDisplay UI: Hint revealed renders hint card with deduction', () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
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
  state = gameReducer(state, {
    type: 'REVEAL_HINT',
  });

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(html.includes('Hint (-$100 pts)'));
  assert.ok(html.includes('Capital of Hungary.'));
});

test('PlayerDisplay UI: Score resets to resting gold on next question', () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });

  // Clue 1: Team 1 answers correctly
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

  assert.equal(state.team1Score, 100);
  assert.equal(state.activeClue?.correctTeam, 1);

  // Close Clue 1 and open Clue 2
  state = gameReducer(state, { type: 'CLOSE_CLUE' });
  state = gameReducer(state, {
    type: 'SELECT_CLUE',
    payload: {
      roundIndex: 0,
      categoryIndex: 0,
      clueIndex: 1,
      firstAnsweringTeam: 2,
    },
  });

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
});

test('PlayerDisplay UI: Points animation spins for roughly 1.5 seconds', () => {
  assert.equal(SCORE_SPIN_DURATION_MS, 1500);

  // At start (0ms), score remains startScore and isAnimating is true
  const initial = calculateAnimatedScore(200, 600, 0, SCORE_SPIN_DURATION_MS);
  assert.equal(initial.currentScore, 200);
  assert.equal(initial.isAnimating, true);

  // Midway (750ms), score has counted up and continues spinning
  const mid = calculateAnimatedScore(200, 600, 750, SCORE_SPIN_DURATION_MS);
  assert.ok(mid.currentScore > 200 && mid.currentScore < 600);
  assert.equal(mid.isAnimating, true);

  // Late progress (1400ms), still spinning near the target
  const late = calculateAnimatedScore(200, 600, 1400, SCORE_SPIN_DURATION_MS);
  assert.ok(late.currentScore >= 590);
  assert.equal(late.isAnimating, true);

  // Target duration (1500ms), resolves to endScore and finishes animation
  const complete = calculateAnimatedScore(
    200,
    600,
    1500,
    SCORE_SPIN_DURATION_MS
  );
  assert.equal(complete.currentScore, 600);
  assert.equal(complete.isAnimating, false);

  // Identity check when start score equals end score
  const identity = calculateAnimatedScore(600, 600, 0, SCORE_SPIN_DURATION_MS);
  assert.equal(identity.currentScore, 600);
  assert.equal(identity.isAnimating, false);
});

test(
  'PlayerDisplay UI: Footer score displays tabular slots for each digit',
  () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });
  state = gameReducer(state, {
    type: 'OVERRIDE_SCORES',
    payload: { team1Score: 1200, team2Score: -300 },
  });

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(html.includes('tabular-nums'));
  assert.ok(html.includes('w-[0.65em]'));
  assert.ok(html.includes('1'));
  assert.ok(html.includes('2'));
  assert.ok(html.includes('-'));
});

test('AdminHost UI: Setup screen renders logo, tagline, and actions', () => {
  const html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state: initialGameState,
      dispatch: () => {},
      openDisplayWindow: () => {},
      onOpenBuilder: () => {},
      onGameCreated: () => {},
    })
  );

  assert.ok(html.includes('stage-ambient'));
  assert.ok(html.includes('ambient-grid'));
  assert.ok(html.includes('animate-stage-aura'));
  assert.ok(html.includes('logo.svg'));
  assert.ok(html.includes('Trivia, Team Fights &amp; Petty Rivalries'));
  assert.ok(html.includes('text-amber-200/80'));
  assert.ok(html.includes('font-display'));
  assert.ok(html.includes('Create New Game'));
  assert.ok(html.includes('Load Game File'));
  assert.ok(html.includes('Load Sample Game'));
  assert.ok(!html.includes('hover:underline'));
  assert.ok(!html.includes('lucide-sparkles'));
});

test(
  'AdminHost UI: Active console has no green dot and has big X Close Game',
  () => {
  const state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });

  const html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state,
      dispatch: () => {},
      openDisplayWindow: () => {},
      onOpenBuilder: () => {},
      onGameCreated: () => {},
    })
  );

  assert.ok(html.includes('Host Console'));
  assert.ok(!html.includes('rounded-full bg-emerald-400 animate-pulse'));
  assert.ok(!html.includes('(alternates automatically)'));
  assert.ok(html.includes('Board Turn:'));
  assert.ok(html.includes('border-yellow-400'));
  assert.ok(!html.includes('Active Turn'));
  assert.ok(!html.includes('ring-yellow-400'));
  assert.ok(html.includes('Close Game'));
});

test(
  'AdminHost UI: Clue grid applies Option 1 contrast and omits answer previews',
  () => {
  const state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });

  const html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state,
      dispatch: () => {},
      openDisplayWindow: () => {},
      onOpenBuilder: () => {},
      onGameCreated: () => {},
    })
  );

  // Option 1 Elevated Slate-Navy styling
  assert.ok(html.includes('bg-[#0c2356]'));
  assert.ok(html.includes('bg-[#0e1f42]'));
  assert.ok(html.includes('text-amber-400'));
  assert.ok(html.includes('font-display tracking-tight tabular-nums'));
  assert.ok(!html.includes('font-mono'));
  assert.ok(html.includes('text-slate-100'));

  // Question text remains visible as sneak peek for host
  assert.ok(html.includes('Danube River'));

  // Answer previews must NOT appear on the home panel grid
  assert.ok(!html.includes('Ans:'));
  assert.ok(!html.includes('Budapest'));
});

test('GameBuilder UI: Renders game settings and clue editor', () => {
  const html = renderToStaticMarkup(
    React.createElement(GameBuilder, {
      currentConfig: defaultGame,
      onSaveSuccess: () => {},
      onSaveAndPlay: () => {},
      onCloseGame: () => {},
      saveGameFile: async () => true,
      selectMediaFile: async () => null,
    })
  );

  assert.ok(html.includes('Game Builder'));
  assert.ok(html.includes('placeholder="Game Title"'));
  assert.ok(html.includes('placeholder="Team 1"'));
  assert.ok(html.includes('placeholder="Team 2"'));
  assert.ok(html.includes('value="Ultimate Trivia Championship"'));
  assert.ok(html.includes('value="Champions"'));
  assert.ok(html.includes('value="Challengers"'));
  assert.ok(html.includes('WORLD GEOGRAPHY'));
  assert.ok(html.includes('Close Game'));
  assert.ok(html.includes('Question Timer'));
  assert.ok(html.includes('Play Game'));
  assert.ok(html.includes('lucide-play'));
  assert.ok(!html.includes('lucide-sparkles'));
});

test(
  'GameBuilder UI: Renders tie-breaker category select from main board',
  () => {
    const html = renderToStaticMarkup(
      React.createElement(GameBuilder, {
        currentConfig: defaultGame,
        initialTab: 'tiebreaker',
        onSaveSuccess: () => {},
        onSaveAndPlay: () => {},
        onCloseGame: () => {},
        saveGameFile: async () => true,
        selectMediaFile: async () => null,
      })
    );

    assert.ok(html.includes('Tie-Breaker Question'));
    assert.ok(html.includes('Tie-Breaker Category'));
    assert.ok(html.includes('<select'));
    assert.ok(
      html.includes('<option value="WORLD GEOGRAPHY">WORLD GEOGRAPHY</option>')
    );
    assert.ok(
      html.includes(
        '<option value="SCIENCE &amp; NATURE">SCIENCE &amp; NATURE</option>'
      )
    );
    assert.ok(
      html.includes(
        '<option value="SPACE EXPLORATION">SPACE EXPLORATION</option>'
      )
    );
  }
);

test(
  'GameBuilder UI: Renders Audio only checkbox for YouTube clues',
  () => {
    const configWithYt = {
      ...defaultGame,
      rounds: [
        {
          ...defaultGame.rounds[0],
          categories: [
            {
              ...defaultGame.rounds[0].categories[0],
              clues: [
                {
                  ...defaultGame.rounds[0].categories[0].clues[0],
                  media: {
                    type: 'youtube' as const,
                    urlOrPath: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    audioOnly: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const html = renderToStaticMarkup(
      React.createElement(GameBuilder, {
        currentConfig: configWithYt,
        initialClueIdx: 0,
        onSaveSuccess: () => {},
        onSaveAndPlay: () => {},
        onCloseGame: () => {},
        saveGameFile: async () => true,
        selectMediaFile: async () => null,
      })
    );

    assert.ok(html.includes('Audio only'));
    assert.ok(html.includes('Test Link'));
  }
);

test(
  'AdminHost UI: Clue modal displays YouTube audio-only badge & pause control',
  () => {
    const configWithYtAudio = {
      ...defaultGame,
      rounds: [
        {
          ...defaultGame.rounds[0],
          categories: [
            {
              ...defaultGame.rounds[0].categories[0],
              clues: [
                {
                  ...defaultGame.rounds[0].categories[0].clues[0],
                  media: {
                    type: 'youtube' as const,
                    urlOrPath: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    audioOnly: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    let state = gameReducer(initialGameState, {
      type: 'LOAD_GAME',
      payload: configWithYtAudio,
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
    state = gameReducer(state, {
      type: 'REVEAL_MEDIA',
    });

    const html = renderToStaticMarkup(
      React.createElement(AdminHost, {
        state,
        dispatch: () => {},
        openDisplayWindow: () => {},
        onOpenBuilder: () => {},
        onGameCreated: () => {},
      })
    );

    assert.ok(
      html.includes('YouTube (Audio Only)'),
      'Must render YouTube (Audio Only) badge in clue modal'
    );
    assert.ok(
      html.includes('title="Pause"'),
      'Must render Pause button for active YouTube audio-only clue'
    );
  }
);

test('CreateGameModal UI: Renders countdown timer presets and input', () => {
  const html = renderToStaticMarkup(
    React.createElement(CreateGameModal, {
      isOpen: true,
      onClose: () => {},
      onCreate: () => {},
    })
  );

  assert.ok(html.includes('Question Points'));
  assert.ok(html.includes('Question Countdown Timer'));
  assert.ok(!html.includes('Question Countdown Timer (Seconds)'));
  assert.ok(html.includes('Off'));
  assert.ok(html.includes('30s'));
  assert.ok(html.includes('1m'));
  assert.ok(html.includes('2m (Default)'));
  assert.ok(html.includes('3m'));
  assert.ok(html.includes('value="120"'));
  assert.ok(html.includes('seconds'));
  assert.ok(!html.includes('lucide-sparkles'));
});

test(
  'PlayerDisplay UI: Final Jeopardy tie-breaker renders category & question',
  () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });
  state = gameReducer(state, {
    type: 'SET_ROUND',
    payload: { roundIndex: -1 },
  });

  let html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(html.includes('Tie-Breaker Category'));
  assert.ok(!html.includes('lucide-sparkles'));
  assert.ok(html.includes('FAMOUS LANDMARKS'));
  assert.ok(html.includes('Teams are submitting secret wagers'));

  state = gameReducer(state, {
    type: 'FJ_SET_WAGERS',
    payload: { team1Wager: 300, team2Wager: 400 },
  });
  html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );
  assert.ok(html.includes('Wagers locked in'));

  state = gameReducer(state, { type: 'FJ_REVEAL_QUESTION' });
  html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(html.includes('Exposition Universelle'));
  assert.ok(html.includes('font-display font-bold text-white'));
  assert.ok(
    html.includes('from-[#071c59] to-[#041038]'),
    'Tie-breaker container must use calibrated royal sapphire gradient'
  );
  assert.ok(
    html.includes('from-[#08206b] to-[#05133d]'),
    'Tie-breaker question card must use calibrated royal blue gradient'
  );
});

test('AdminHost UI: Tie-breaker panel toggles wager lock feedback', () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });
  state = gameReducer(state, {
    type: 'SET_ROUND',
    payload: { roundIndex: -1 },
  });

  let html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state,
      dispatch: () => {},
      toMediaUrl: (p: string) => p,
      onOpenDisplay: () => {},
      onResetGame: () => {},
    })
  );

  assert.ok(html.includes('Lock Wagers'));
  assert.ok(!html.includes('Wagers Locked in'));

  state = gameReducer(state, {
    type: 'FJ_SET_WAGERS',
    payload: { team1Wager: 500, team2Wager: 500 },
  });

  html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state,
      dispatch: () => {},
      toMediaUrl: (p: string) => p,
      onOpenDisplay: () => {},
      onResetGame: () => {},
    })
  );

  assert.ok(html.includes('Wagers Locked in'));
  assert.ok(html.includes('Edit Wagers'));
  assert.ok(html.includes('disabled=""'));

  state = gameReducer(state, { type: 'FJ_UNLOCK_WAGERS' });

  html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state,
      dispatch: () => {},
      toMediaUrl: (p: string) => p,
      onOpenDisplay: () => {},
      onResetGame: () => {},
    })
  );

  assert.ok(html.includes('Lock Wagers'));
  assert.ok(!html.includes('Wagers Locked in'));
});

test(
  'AdminHost UI: Clue judging modal displays judging buttons & hint controls',
  () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
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

  const html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state,
      dispatch: () => {},
      openDisplayWindow: () => {},
      onOpenBuilder: () => {},
      onGameCreated: () => {},
    })
  );

  assert.ok(html.includes('Question'));
  assert.ok(html.includes('Danube River'));
  assert.ok(html.includes('Answer'));
  assert.ok(html.includes('Budapest'));
  assert.ok(html.includes('+$100'));
  assert.ok(html.includes('Wrong'));
  assert.ok(html.includes('<span>Rebound</span>'));
  assert.ok(html.includes('bg-violet-600'));
  assert.ok(html.includes('<span>Answer</span>'));
  assert.ok(html.includes('bg-indigo-600'));
  assert.ok(html.includes('<span>Hint</span>'));
  assert.ok(html.includes('<span>Close</span>'));
  assert.ok(html.includes('border-gray-700 hover:border-gray-600'));
  assert.ok(html.includes('bg-gray-800/60'));
  assert.ok(!html.includes('<span>Reveal</span>'));
  assert.ok(html.includes('Reset'));
  assert.ok(html.includes('Hint (-$100)'));
  assert.ok(html.includes('Answering:'));
  assert.ok(html.includes('Team 1'));
  assert.ok(html.includes('Team 2'));
  assert.ok(html.includes('bg-blue-600 text-white'));
});

test(
  'AdminHost UI: Clue judging modal displays Revealed for hint once revealed',
  () => {
    let state = gameReducer(initialGameState, {
      type: 'LOAD_GAME',
      payload: defaultGame,
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

    const html = renderToStaticMarkup(
      React.createElement(AdminHost, {
        state,
        dispatch: () => {},
        openDisplayWindow: () => {},
        onOpenBuilder: () => {},
        onGameCreated: () => {},
      })
    );

    assert.ok(html.includes('<span>Revealed</span>'));
    assert.ok(!html.includes('<span>Hint</span>'));
    assert.ok(html.includes('<span>Answer</span>'));
  }
);

test(
  'AdminHost UI: Clue judging modal displays Pass button during rebound',
  () => {
    let state = gameReducer(initialGameState, {
      type: 'LOAD_GAME',
      payload: defaultGame,
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
    state = gameReducer(state, { type: 'ADVANCE_REBOUND' });

    const html = renderToStaticMarkup(
      React.createElement(AdminHost, {
        state,
        dispatch: () => {},
        openDisplayWindow: () => {},
        onOpenBuilder: () => {},
        onGameCreated: () => {},
      })
    );

    assert.ok(html.includes('+$50'));
    assert.ok(html.includes('Wrong'));
    assert.ok(html.includes('Pass'));
    assert.ok(html.includes('border-gray-700'));
    assert.ok(!html.includes('<span>Rebound</span>'));
    assert.ok(html.includes('text-violet-300 bg-violet-950/60'));
    assert.ok(html.includes('Rebound 50%'));
  }
);

test(
  'AdminHost UI: First incorrect answer offers rebound option with skip',
  () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
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
  state = gameReducer(state, {
    type: 'ANSWER_WRONG',
    payload: { team: 1 },
  });

  const html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state,
      dispatch: () => {},
      openDisplayWindow: () => {},
      onOpenBuilder: () => {},
      onGameCreated: () => {},
    })
  );

  assert.ok(html.includes('Champions incorrect'));
  assert.ok(html.includes('Rebound: $50'));
  assert.ok(html.includes('<span>Rebound</span>'));
  assert.ok(html.includes('bg-violet-600'));
  assert.ok(html.includes('border-gray-700'));
  assert.ok(!html.includes('Rebound ($50)'));
  assert.ok(html.includes('Skip'));
});

test('MediaRenderer UI: Omits controls when showControls is false', () => {
  const videoHtml = renderToStaticMarkup(
    React.createElement(MediaRenderer, {
      media: { type: 'video', urlOrPath: 'sample.mp4' },
      resolvedUrl: 'media://sample.mp4',
      showControls: false,
    })
  );
  assert.ok(videoHtml.includes('<video'));
  assert.ok(videoHtml.includes('loop'));
  assert.ok(!videoHtml.includes('controls'));

  const audioHtml = renderToStaticMarkup(
    React.createElement(MediaRenderer, {
      media: { type: 'audio', urlOrPath: 'sample.mp3' },
      resolvedUrl: 'media://sample.mp3',
      showControls: false,
    })
  );
  assert.ok(audioHtml.includes('<audio'));
  assert.ok(audioHtml.includes('loop'));
  assert.ok(!audioHtml.includes('controls'));

  const withControls = renderToStaticMarkup(
    React.createElement(MediaRenderer, {
      media: { type: 'video', urlOrPath: 'sample.mp4' },
      resolvedUrl: 'media://sample.mp4',
      showControls: true,
    })
  );
  assert.ok(withControls.includes('controls'));
});

test(
  'MediaRenderer UI: Renders media with loop and playsInline attributes',
  () => {
    const videoHtml = renderToStaticMarkup(
      React.createElement(MediaRenderer, {
        media: { type: 'video', urlOrPath: 'sample.mp4' },
        resolvedUrl: 'media://sample.mp4',
      })
    );
    assert.ok(videoHtml.includes('playsinline'));
    assert.ok(videoHtml.includes('preload="auto"'));
    assert.ok(!videoHtml.includes('autoplay'));

    const audioHtml = renderToStaticMarkup(
      React.createElement(MediaRenderer, {
        media: { type: 'audio', urlOrPath: 'sample.mp3' },
        resolvedUrl: 'media://sample.mp3',
      })
    );
    assert.ok(audioHtml.includes('preload="auto"'));
    assert.ok(!audioHtml.includes('autoplay'));
  }
);

test(
  'MediaRenderer UI: Propagates autoPlay attribute when requested',
  () => {
    const videoHtml = renderToStaticMarkup(
      React.createElement(MediaRenderer, {
        media: { type: 'video', urlOrPath: 'sample.mp4' },
        resolvedUrl: 'media://sample.mp4',
        autoPlay: true,
      })
    );
    assert.ok(videoHtml.includes('autoplay'));

    const audioHtml = renderToStaticMarkup(
      React.createElement(MediaRenderer, {
        media: { type: 'audio', urlOrPath: 'sample.mp3' },
        resolvedUrl: 'media://sample.mp3',
        autoPlay: true,
      })
    );
    assert.ok(audioHtml.includes('autoplay'));
  }
);

test('PlayerDisplay UI: Active video clue renders without controls', () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });

  // Inject a video media clue
  if (state.config) {
    state.config.rounds[0].categories[0].clues[0].media = {
      type: 'video',
      urlOrPath: 'clip.mp4',
    };
  }

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

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => `media://${p}`,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(html.includes('<video'));
  assert.ok(!html.includes('controls'));
});

test('MediaRenderer UI: YouTube masks title when showControls is false', () => {
  const maskedHtml = renderToStaticMarkup(
    React.createElement(MediaRenderer, {
      media: {
        type: 'youtube',
        urlOrPath: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      resolvedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      showControls: false,
    })
  );

  assert.ok(maskedHtml.includes('youtube-title-mask'));
  assert.ok(maskedHtml.includes('controls=0'));

  const unmaskedHtml = renderToStaticMarkup(
    React.createElement(MediaRenderer, {
      media: {
        type: 'youtube',
        urlOrPath: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      resolvedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      showControls: true,
    })
  );

  assert.ok(!unmaskedHtml.includes('youtube-title-mask'));
  assert.ok(!unmaskedHtml.includes('controls=0'));
});

test(
  'MediaRenderer UI: YouTube audioOnly renders audio clue card with stream',
  () => {
    const audioOnlyHtml = renderToStaticMarkup(
      React.createElement(MediaRenderer, {
        media: {
          type: 'youtube',
          urlOrPath: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          audioOnly: true,
        },
        resolvedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        isPlaying: true,
        showControls: false,
      })
    );

    assert.ok(
      audioOnlyHtml.includes('AUDIO CLUE'),
      'Must display AUDIO CLUE label'
    );
    assert.ok(
      audioOnlyHtml.includes('youtube-audio-stream'),
      'Must embed hidden offscreen youtube-audio-stream'
    );
    assert.ok(
      !audioOnlyHtml.includes('youtube-title-mask'),
      'Must not render video title mask for audio only'
    );
    assert.ok(
      !audioOnlyHtml.includes('YouTube Clue Video'),
      'Must not render visible video frame title'
    );
  }
);

test(
  'MediaRenderer UI: YouTube audioOnly reflects paused state and controls',
  () => {
    const pausedHtml = renderToStaticMarkup(
      React.createElement(MediaRenderer, {
        media: {
          type: 'youtube',
          urlOrPath: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          audioOnly: true,
        },
        resolvedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        isPlaying: false,
        showControls: true,
      })
    );

    assert.ok(pausedHtml.includes('opacity-40'));
    assert.ok(pausedHtml.includes('Open in Browser'));
  }
);

test(
  'PlayerDisplay UI: YouTube audioOnly clue renders audio card on player' +
    ' display',
  () => {
    const yamlPath = path.resolve(
      process.cwd(),
      'tests',
      'fixtures',
      'minimal_game',
      'game.yaml'
    );
    const config = parseGameConfigFromYaml(fs.readFileSync(yamlPath, 'utf-8'));
    let state = gameReducer(initialGameState, {
      type: 'LOAD_GAME',
      payload: config,
    });
    // Category 1, clue 2 is the YouTube audio-only clue ($300)
    state = gameReducer(state, {
      type: 'SELECT_CLUE',
      payload: {
        roundIndex: 0,
        categoryIndex: 1,
        clueIndex: 2,
        firstAnsweringTeam: 1,
      },
    });
    state = gameReducer(state, { type: 'REVEAL_MEDIA' });

    const html = renderToStaticMarkup(
      React.createElement(PlayerDisplay, {
        state,
        toMediaUrl: (p: string) => p,
        onToggleFullScreen: () => {},
      })
    );

    assert.ok(html.includes('AUDIO CLUE'), 'Must render AUDIO CLUE card');
    assert.ok(
      !html.includes('YouTube Clue Video'),
      'Must not render YouTube Clue Video'
    );
  }
);

test(
  'PlayerDisplay UI: Standard YouTube clue renders video frame on player' +
    ' display',
  () => {
    const yamlPath = path.resolve(
      process.cwd(),
      'tests',
      'fixtures',
      'minimal_game',
      'game.yaml'
    );
    const config = parseGameConfigFromYaml(fs.readFileSync(yamlPath, 'utf-8'));
    let state = gameReducer(initialGameState, {
      type: 'LOAD_GAME',
      payload: config,
    });
    // Category 0, clue 2 is the standard YouTube video clue ($300)
    state = gameReducer(state, {
      type: 'SELECT_CLUE',
      payload: {
        roundIndex: 0,
        categoryIndex: 0,
        clueIndex: 2,
        firstAnsweringTeam: 1,
      },
    });
    state = gameReducer(state, { type: 'REVEAL_MEDIA' });

    const html = renderToStaticMarkup(
      React.createElement(PlayerDisplay, {
        state,
        toMediaUrl: (p: string) => p,
        onToggleFullScreen: () => {},
      })
    );

    assert.ok(
      html.includes('YouTube Clue Video'),
      'Must render YouTube Clue Video'
    );
    assert.ok(
      !html.includes('AUDIO CLUE'),
      'Must not render AUDIO CLUE card'
    );
  }
);

test(
  'PlayerDisplay UI: Active media vanishes on ANSWER_CORRECT for all types',
  () => {
  const mediaCases: Array<{
    type: 'video' | 'youtube' | 'image' | 'audio';
    url: string;
    tag: string;
  }> = [
    { type: 'video', url: 'sample.mp4', tag: '<video' },
    {
      type: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      tag: '<iframe',
    },
    { type: 'image', url: 'clue.png', tag: 'alt="Clue Picture"' },
    { type: 'audio', url: 'clue.mp3', tag: '<audio' },
  ];

  for (const testCase of mediaCases) {
    let state = gameReducer(initialGameState, {
      type: 'LOAD_GAME',
      payload: defaultGame,
    });

    if (state.config) {
      state.config.rounds[0].categories[0].clues[0].media = {
        type: testCase.type,
        urlOrPath: testCase.url,
      };
    }

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

    // Before judging: media element is present
    const preJudgeHtml = renderToStaticMarkup(
      React.createElement(PlayerDisplay, {
        state,
        toMediaUrl: (p: string) => p,
        onToggleFullScreen: () => {},
      })
    );
    assert.ok(
      preJudgeHtml.includes(testCase.tag),
      `Expected ${testCase.tag} before answer judgment`
    );

    // Judge correct
    state = gameReducer(state, {
      type: 'ANSWER_CORRECT',
      payload: { team: 1 },
    });

    const postJudgeHtml = renderToStaticMarkup(
      React.createElement(PlayerDisplay, {
        state,
        toMediaUrl: (p: string) => p,
        onToggleFullScreen: () => {},
      })
    );

    // Green box is rendered with correct answer
    assert.ok(postJudgeHtml.includes('Danube River'));
    assert.ok(postJudgeHtml.includes('bg-emerald-950/70'));
    assert.ok(!postJudgeHtml.includes('!border-emerald-500'));
    assert.ok(postJudgeHtml.includes('bg-emerald-950/30'));
    // Media is completely unmounted
    assert.ok(
      !postJudgeHtml.includes(testCase.tag),
      `Expected ${testCase.tag} to be absent after correct answer judgment`
    );
  }
});

test(
  'PlayerDisplay UI: Active media vanishes on REVEAL_ANSWER & rebound miss',
  () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });

  if (state.config) {
    state.config.rounds[0].categories[0].clues[0].media = {
      type: 'video',
      urlOrPath: 'sample.mp4',
    };
  }

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

  // Host reveals answer directly
  const revealState = gameReducer(state, { type: 'REVEAL_ANSWER' });
  const revealHtml = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state: revealState,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );
  assert.ok(revealHtml.includes('Danube River'));
  assert.ok(!revealHtml.includes('<video'));

  // Both teams miss on rebound
  let missState = gameReducer(state, {
    type: 'ANSWER_WRONG',
    payload: { team: 1 },
  });
  missState = gameReducer(missState, { type: 'ADVANCE_REBOUND' });
  missState = gameReducer(missState, {
    type: 'ANSWER_WRONG',
    payload: { team: 2 },
  });

  const missHtml = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state: missState,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );
  assert.ok(missHtml.includes('Both teams missed!'));
  assert.ok(!missHtml.includes('<video'));
});

test(
  'PlayerDisplay UI: Active media layout prevents overlap with shrink-0',
  () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });

  if (state.config) {
    state.config.rounds[0].categories[0].clues[0].media = {
      type: 'video',
      urlOrPath: 'sample.mp4',
    };
  }

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

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  // Question h2 must have shrink-0 so it cannot be squished/overlapped
  assert.ok(html.includes('shrink-0'));
  // Media wrapper must have flex-1 min-h-0 overflow-hidden without my-auto
  assert.ok(html.includes('flex-1 min-h-0 w-full flex items-center'));
  assert.ok(html.includes('overflow-hidden py-1'));
  // MediaRenderer has max-h-full max-w-full
  assert.ok(html.includes('max-h-full max-w-full'));
});

test(
  'PlayerDisplay UI: Winner screen renders when regulation ends with winner',
  () => {
  const customGame = createGameFromPreferences({
    title: 'Champions League',
    team1Name: 'Gryffindor',
    team2Name: 'Slytherin',
    numCategories: 3,
    numQuestionsPerCategory: 2,
    includeFinalJeopardy: false,
  });

  const completedRounds = customGame.rounds.map((r) => ({
    ...r,
    categories: r.categories.map((c) => ({
      ...c,
      clues: c.clues.map((cl) => ({ ...cl, state: 'completed' as const })),
    })),
  }));

  const state = {
    ...initialGameState,
    config: { ...customGame, rounds: completedRounds },
    team1Score: 1200,
    team2Score: 800,
  };

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  // JeoPARTY! logo centerpiece
  assert.ok(html.includes('logo.svg'));

  // Headline and champion pill (game name champion, no sparkler)
  assert.ok(html.includes('Champions League Champion'));
  assert.ok(!html.includes('Sparkles'));

  // Winning team name (without 'wins')
  assert.ok(html.includes('Gryffindor'));
  assert.ok(!html.includes('Gryffindor Wins'));

  // Winning score rendered with tabular numerals
  assert.ok(html.includes('tabular-nums'));

  // Losing team name and score rendered without Runner-up prefix
  assert.ok(!html.includes('Runner-up:'));
  assert.ok(html.includes('Slytherin'));
  assert.ok(html.includes('800'));

  // Top header bar removed on victory screen
  assert.ok(!html.includes('Toggle Fullscreen (F)'));

  // Standard clue board and score cards should not be rendered
  assert.ok(!html.includes('group-hover:scale-105'));
  assert.ok(!html.includes('Team 1 Score Card'));

  // Royal blue victory stage wash
  assert.ok(
    html.includes('rgba(8,32,107,0.42)'),
    'Winner screen must render royal blue victory stage wash'
  );
});

test(
  'PlayerDisplay UI: Co-winners screen renders when tied without tie-breaker',
  () => {
  const customGame = createGameFromPreferences({
    title: 'Tie Battle',
    team1Name: 'Red Owls',
    team2Name: 'Blue Jays',
    numCategories: 3,
    numQuestionsPerCategory: 2,
    includeFinalJeopardy: false,
  });

  const completedRounds = customGame.rounds.map((r) => ({
    ...r,
    categories: r.categories.map((c) => ({
      ...c,
      clues: c.clues.map((cl) => ({ ...cl, state: 'completed' as const })),
    })),
  }));

  const state = {
    ...initialGameState,
    config: { ...customGame, rounds: completedRounds },
    team1Score: 1000,
    team2Score: 1000,
  };

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(html.includes('logo.svg'));
  assert.ok(html.includes('Tie Battle Co-Champions'));
  assert.ok(html.includes('Red Owls'));
  assert.ok(html.includes('&amp;'));
  assert.ok(html.includes('Blue Jays'));
  assert.ok(html.includes('tabular-nums'));
  assert.ok(!html.includes('Runner-up:'));
});

test('AdminHost UI: Game completed banner renders on victory', () => {
  const customGame = createGameFromPreferences({
    title: 'Admin Victory Test',
    team1Name: 'Hawks',
    team2Name: 'Eagles',
    numCategories: 3,
    numQuestionsPerCategory: 2,
    includeFinalJeopardy: false,
  });

  const completedRounds = customGame.rounds.map((r) => ({
    ...r,
    categories: r.categories.map((c) => ({
      ...c,
      clues: c.clues.map((cl) => ({ ...cl, state: 'completed' as const })),
    })),
  }));

  const state = {
    ...initialGameState,
    config: { ...customGame, rounds: completedRounds },
    team1Score: 900,
    team2Score: 400,
  };

  const html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state,
      dispatch: () => {},
      openGameFile: async () => null,
      saveGameFile: async () => false,
    })
  );

  assert.ok(html.includes('Game Completed'));
  assert.ok(html.includes('Winner: Hawks'));
  assert.ok(html.includes('Winner screen active on player display'));
});

test(
  'AdminHost UI: Regulation tied banner renders when tie-breaker available',
  () => {
  const customGame = createGameFromPreferences({
    title: 'Tied With FJ',
    team1Name: 'Team X',
    team2Name: 'Team Y',
    numCategories: 3,
    numQuestionsPerCategory: 2,
    includeFinalJeopardy: true,
  });

  const completedRounds = customGame.rounds.map((r) => ({
    ...r,
    categories: r.categories.map((c) => ({
      ...c,
      clues: c.clues.map((cl) => ({ ...cl, state: 'completed' as const })),
    })),
  }));

  const state = {
    ...initialGameState,
    config: { ...customGame, rounds: completedRounds },
    team1Score: 500,
    team2Score: 500,
  };

  const html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state,
      dispatch: () => {},
      openGameFile: async () => null,
      saveGameFile: async () => false,
    })
  );

  assert.ok(html.includes('Regulation Tied ($500 each)'));
  assert.ok(html.includes('Start Tie-Breaker'));
  assert.ok(html.includes('Declare Co-Winners'));
  assert.ok(!html.includes('lucide-sparkles'));
});

test('AdminHost UI: Setup screen renders Connect Phone button', () => {
  const html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state: initialGameState,
      dispatch: () => {},
      openGameFile: async () => null,
      saveGameFile: async () => false,
    })
  );

  assert.ok(html.includes('Connect Phone'));
});

test('AdminHost UI: Active console header renders Connect Phone button', () => {
  const state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });

  const html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state,
      dispatch: () => {},
      openGameFile: async () => null,
      saveGameFile: async () => false,
    })
  );

  assert.ok(html.includes('Connect Phone'));
});

test('MobileConnectModal UI: Renders QR modal with pairing elements', () => {
  const html = renderToStaticMarkup(
    React.createElement(MobileConnectModal, {
      isOpen: true,
      onClose: () => {},
    })
  );

  assert.ok(html.includes('Mobile Pairing'));
  assert.ok(html.includes('LAN Connect'));
  assert.ok(html.includes('Host Console (Phone)'));
  assert.ok(html.includes('Player Board (TV/Display)'));
  assert.ok(html.includes('Same Wi-Fi network required'));
  assert.ok(html.includes('<svg'));
});

test('AdminHost UI: Completed clue tile displays compact outcome pill', () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
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
  state = gameReducer(state, {
    type: 'ANSWER_CORRECT',
    payload: { team: 1 },
  });
  state = gameReducer(state, {
    type: 'CLOSE_CLUE',
  });

  const html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state,
      dispatch: () => {},
      openGameFile: async () => null,
      saveGameFile: async () => false,
    })
  );

  assert.ok(html.includes('line-through text-slate-500'));
  assert.ok(html.includes('T1'));
  // Grid tile has no inline reset button
  assert.ok(!html.includes('Reset</span>'));
});

test('CompletedClueModal UI: Renders details and reset action', () => {
  const completedClue = {
    id: 'c1',
    points: 500,
    question: 'What term describes a substance?',
    answer: 'Matter',
    state: 'completed' as const,
    result: { winner: 1 as const, type: 'full' as const },
  };

  const html = renderToStaticMarkup(
    React.createElement(CompletedClueModal, {
      isOpen: true,
      onClose: () => {},
      categoryName: 'SCIENCE & NATURE',
      clue: completedClue,
      team1Name: 'Champions',
      team2Name: 'Challengers',
      onReset: () => {},
    })
  );

  assert.ok(html.includes('SCIENCE &amp; NATURE'));
  assert.ok(html.includes('$500'));
  assert.ok(html.includes('T1'));
  assert.ok(html.includes('Awarded to Champions (+500 pts, Full Value)'));
  assert.ok(html.includes('What term describes a substance?'));
  assert.ok(html.includes('Matter'));
  assert.ok(html.includes('Reset Question'));
});

test('AdminHost UI: Setup screen & host console render drag regions', () => {
  // 1. Setup screen (no config)
  const setupHtml = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state: initialGameState,
      dispatch: () => {},
      toMediaUrl: (p: string) => p,
      openDisplayWindow: () => {},
    })
  );
  assert.ok(
    setupHtml.includes('titlebar-drag'),
    'Setup screen must render top titlebar-drag strip'
  );

  // 2. Active host console (game loaded)
  const loadedState = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });
  const hostHtml = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state: loadedState,
      dispatch: () => {},
      toMediaUrl: (p: string) => p,
      openDisplayWindow: () => {},
    })
  );
  assert.ok(
    hostHtml.includes('titlebar-drag titlebar-pad'),
    'Host console header must include titlebar-drag and titlebar-pad'
  );
});

test(
  'GameBuilder UI: Header renders drag region and platform clearance',
  () => {
  const html = renderToStaticMarkup(
    React.createElement(GameBuilder, {
      initialConfig: defaultGame,
      onSaveAndPlay: () => {},
      onClose: () => {},
      toMediaUrl: (p: string) => p,
    })
  );
  assert.ok(
    html.includes('titlebar-drag titlebar-pad'),
    'GameBuilder header must include titlebar-drag and titlebar-pad'
  );
});

test(
  'PlayerDisplay UI: Waiting screen and edge header render drag zones',
  () => {
  // 1. Waiting screen
  const waitHtml = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state: initialGameState,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );
  assert.ok(
    waitHtml.includes('titlebar-drag'),
    'PlayerDisplay waiting screen must render titlebar-drag strip'
  );

  // 2. Active board header
  const loadedState = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });
  const boardHtml = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state: loadedState,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );
  assert.ok(
    boardHtml.includes('titlebar-drag titlebar-pad'),
    'PlayerDisplay header must include titlebar-drag and titlebar-pad'
  );
  assert.ok(
    boardHtml.includes('Ultimate Trivia Championship'),
    'PlayerDisplay renders game title'
  );
});

test('AdminHost UI: Mobile host panel enables 2D touch scroll', () => {
  const state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });

  const html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state,
      dispatch: () => {},
      openDisplayWindow: () => {},
      onOpenBuilder: () => {},
      onGameCreated: () => {},
    })
  );

  // Dynamic viewport height prevents cutoff
  assert.ok(
    html.includes('h-[100dvh]') && html.includes('max-h-[100dvh]'),
    'Root must use dynamic viewport height'
  );

  // Main must NOT be a scroll container to avoid
  // nested scroller gesture conflicts on mobile
  assert.ok(html.includes('overflow-hidden'), 'Main must be overflow-hidden');

  // Grid wrapper is the sole 2D touch scroller
  assert.ok(
    html.includes('overflow-auto') &&
      html.includes('touch-pan-x') &&
      html.includes('touch-pan-y') &&
      html.includes('pb-20') &&
      html.includes('min-h-0'),
    'Grid wrapper must be sole 2D touch scroller'
  );

  // Category headers stay pinned on scroll
  assert.ok(
    html.includes('sticky top-0 z-10'),
    'Category headers must be sticky'
  );
});

test(
  'PlayerDisplay UI: Clue questions unify on font-display typography',
  () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
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

  const playerHtml = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  const adminHtml = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state,
      dispatch: () => {},
      openDisplayWindow: () => {},
      onOpenBuilder: () => {},
      onGameCreated: () => {},
    })
  );

  assert.ok(
    playerHtml.includes('font-display font-bold text-white'),
    'PlayerDisplay clue question must use font-display font-bold'
  );
  assert.ok(
    adminHtml.includes('font-display font-bold text-white'),
    'AdminHost clue question must use matching font-display font-bold'
  );
});

test('PlayerDisplay UI: Active clue renders spotlight and points HUD', () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
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

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(
    html.includes('ellipse_at_center'),
    'Stage must render sapphire spotlight gradient'
  );
  assert.ok(
    html.includes('tracking-[0.15em]'),
    'Category badge must render marquee tracking'
  );
  assert.ok(
    html.includes('text-modern-gold font-display leading-none'),
    'Points must render in modern gold display typography'
  );
  assert.ok(
    !html.includes('border-amber-400/35'),
    'Points must not render with boxed border'
  );
  assert.ok(
    html.includes('border-amber-400'),
    'Active team podium must render uniform amber border'
  );
  assert.ok(
    !html.includes('h-0.5 bg-gradient-to-r from-amber-400'),
    'Podium must not render uneven top light bar'
  );

  const answeredState = gameReducer(state, {
    type: 'ANSWER_CORRECT',
    payload: { team: 1 },
  });
  const answeredHtml = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state: answeredState,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(
    answeredHtml.includes('border-emerald-500'),
    'Podium must render clean emerald border on correct answer'
  );
});

test('PlayerDisplay UI: Media clue renders responsive split columns', () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });

  if (state.config) {
    state.config.rounds[0].categories[0].clues[0].media = {
      type: 'image',
      urlOrPath: 'sample.png',
    };
  }

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

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(
    html.includes('md:flex-row'),
    'Media clue must render split columns on wide displays'
  );
  assert.ok(
    html.includes('self-stretch'),
    'Media column must stretch to full height of stage'
  );
  assert.ok(
    html.includes('object-contain'),
    'Image must enforce object-contain'
  );
  assert.ok(
    html.includes('shadow-[0_12px_40px_rgba(0,0,0,0.8)]'),
    'Image must render in cinematic shadow frame'
  );
});

test('PlayerDisplay UI: Layout preserves viewport-height proportions', () => {
  let state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
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

  const html = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(
    html.includes('h-[8vh]'),
    'Header must use proportional 8vh height'
  );
  assert.ok(
    html.includes('h-[14vh]'),
    'Footer must use proportional 14vh height'
  );
  assert.ok(
    html.includes('p-[1.5vh] md:p-[2vh]'),
    'Main container must use proportional vh padding'
  );
  assert.ok(
    html.includes('text-[clamp(1rem,2vh,2.25rem)]'),
    'Game title must scale with fluid clamp vh typography'
  );
  assert.ok(
    html.includes('text-[clamp(1.75rem,4.5vh,6rem)]'),
    'TabularScore must scale with fluid clamp vh typography'
  );
  assert.ok(
    html.includes('text-[clamp(1.75rem,4.2vh,4.8rem)]'),
    'Team name must scale with enlarged clamp typography'
  );
  assert.ok(
    !html.includes('>Team 1<'),
    'Score footer must not render Team 1 label'
  );
  assert.ok(
    !html.includes('>Team 2<'),
    'Score footer must not render Team 2 label'
  );

  const boardState = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: defaultGame,
  });
  const boardHtml = renderToStaticMarkup(
    React.createElement(PlayerDisplay, {
      state: boardState,
      toMediaUrl: (p: string) => p,
      onToggleFullScreen: () => {},
    })
  );

  assert.ok(
    boardHtml.includes('text-[clamp(1.75rem,4.5vh,5.25rem)]'),
    'Board clue points must use enlarged clamp typography'
  );
  assert.ok(
    boardHtml.includes('text-[clamp(1.15rem,2.4vh,2.5rem)]'),
    'Board category headers must scale with enlarged clamp typography'
  );
});

test(
  'PlayerDisplay UI: CategoryHeaderCard renders auto-fitting title layout',
  () => {
    const cardHtml = renderToStaticMarkup(
      React.createElement(CategoryHeaderCard, {
        name: 'POP CULTURE & CINEMA',
      })
    );
    assert.ok(cardHtml.includes('POP CULTURE &amp; CINEMA'));
    assert.ok(cardHtml.includes('w-full break-words'));
    assert.ok(cardHtml.includes('h-[clamp(4rem,8.5vh,7.5rem)]'));

    const maxBoardState = gameReducer(initialGameState, {
      type: 'LOAD_GAME',
      payload: maxSampleGame,
    });
    const maxHtml = renderToStaticMarkup(
      React.createElement(PlayerDisplay, {
        state: maxBoardState,
        toMediaUrl: (p: string) => p,
        onToggleFullScreen: () => {},
      })
    );

    assert.ok(maxHtml.includes('POP CULTURE &amp; CINEMA'));
    assert.ok(maxHtml.includes('SCIENCE &amp; DISCOVERY'));
    assert.ok(maxHtml.includes('FOOD &amp; CUISINE'));
  }
);

test('MediaIndicator: Renders image icon for image clues', () => {
  const html = renderToStaticMarkup(
    React.createElement(MediaIndicator, {
      media: { type: 'image', urlOrPath: 'sample.png' },
    })
  );
  assert.ok(html.includes('data-testid="media-indicator"'));
  assert.ok(html.includes('data-testid="media-icon-image"'));
  assert.ok(html.includes('title="Image Clue"'));
  assert.ok(html.includes('aria-label="Image clue"'));
});

test('MediaIndicator: Renders volume icon for audio clues', () => {
  const html = renderToStaticMarkup(
    React.createElement(MediaIndicator, {
      media: { type: 'audio', urlOrPath: 'sample.mp3' },
    })
  );
  assert.ok(html.includes('data-testid="media-indicator"'));
  assert.ok(html.includes('data-testid="media-icon-audio"'));
  assert.ok(html.includes('title="Audio Clue"'));
  assert.ok(html.includes('aria-label="Audio clue"'));
});

test('MediaIndicator: Renders video icon for video clues', () => {
  const html = renderToStaticMarkup(
    React.createElement(MediaIndicator, {
      media: { type: 'video', urlOrPath: 'sample.mp4' },
    })
  );
  assert.ok(html.includes('data-testid="media-indicator"'));
  assert.ok(html.includes('data-testid="media-icon-video"'));
  assert.ok(html.includes('title="Video Clue"'));
  assert.ok(html.includes('aria-label="Video clue"'));
});

test(
  'MediaIndicator: Renders single YouTube icon for video YouTube clues',
  () => {
  const html = renderToStaticMarkup(
    React.createElement(MediaIndicator, {
      media: {
        type: 'youtube',
        urlOrPath: 'https://youtube.com/watch?v=abc',
        audioOnly: false,
      },
    })
  );
  assert.ok(html.includes('data-testid="media-indicator"'));
  assert.ok(html.includes('data-testid="media-icon-youtube"'));
  assert.ok(!html.includes('data-testid="media-icon-audio"'));
  assert.ok(html.includes('title="YouTube Clue"'));
});

test('MediaIndicator: Renders dual icons for YouTube audio-only clues', () => {
  const html = renderToStaticMarkup(
    React.createElement(MediaIndicator, {
      media: {
        type: 'youtube',
        urlOrPath: 'https://youtube.com/watch?v=abc',
        audioOnly: true,
      },
    })
  );
  assert.ok(html.includes('data-testid="media-indicator"'));
  assert.ok(html.includes('data-testid="media-icon-youtube"'));
  assert.ok(html.includes('data-testid="media-icon-audio"'));
  assert.ok(html.includes('title="YouTube (Audio Only)"'));
  assert.ok(html.includes('aria-label="YouTube audio-only clue"'));
});

test('MediaIndicator: Returns null for missing or none media', () => {
  assert.equal(
    renderToStaticMarkup(React.createElement(MediaIndicator, { media: null })),
    ''
  );
  assert.equal(
    renderToStaticMarkup(
      React.createElement(MediaIndicator, {
        media: { type: 'none', urlOrPath: '' },
      })
    ),
    ''
  );
});

test(
  'AdminHost UI: Clue grid renders media indicator icons instead of text',
  () => {
  const testGame: GameConfig = {
    ...defaultGame,
    rounds: [
      {
        id: 'r1',
        name: 'Jeopardy',
        categories: [
          {
            id: 'c1',
            name: 'Media Gallery',
            clues: [
              {
                id: 'clue-img',
                points: 100,
                question: 'Image Q',
                answer: 'Image A',
                state: 'unopened',
                media: { type: 'image', urlOrPath: 'sample.png' },
              },
              {
                id: 'clue-aud',
                points: 200,
                question: 'Audio Q',
                answer: 'Audio A',
                state: 'unopened',
                media: { type: 'audio', urlOrPath: 'sample.mp3' },
              },
              {
                id: 'clue-vid',
                points: 300,
                question: 'Video Q',
                answer: 'Video A',
                state: 'unopened',
                media: { type: 'video', urlOrPath: 'sample.mp4' },
              },
              {
                id: 'clue-yt',
                points: 400,
                question: 'YT Q',
                answer: 'YT A',
                state: 'unopened',
                media: {
                  type: 'youtube',
                  urlOrPath: 'https://youtube.com/watch?v=123',
                },
              },
              {
                id: 'clue-yta',
                points: 500,
                question: 'YTA Q',
                answer: 'YTA A',
                state: 'unopened',
                media: {
                  type: 'youtube',
                  urlOrPath: 'https://youtube.com/watch?v=456',
                  audioOnly: true,
                },
              },
            ],
          },
        ],
      },
    ],
  };

  const state = gameReducer(initialGameState, {
    type: 'LOAD_GAME',
    payload: testGame,
  });
  const html = renderToStaticMarkup(
    React.createElement(AdminHost, {
      state,
      dispatch: () => {},
      openDisplayWindow: () => {},
      onOpenBuilder: () => {},
      onGameCreated: () => {},
    })
  );

  assert.ok(html.includes('data-testid="media-indicator"'));
  assert.ok(html.includes('data-testid="media-icon-image"'));
  assert.ok(html.includes('data-testid="media-icon-audio"'));
  assert.ok(html.includes('data-testid="media-icon-video"'));
  assert.ok(html.includes('data-testid="media-icon-youtube"'));
  assert.ok(html.includes('title="YouTube (Audio Only)"'));
  assert.ok(html.includes('title="Image Clue"'));
  assert.ok(html.includes('title="Audio Clue"'));
  assert.ok(html.includes('title="Video Clue"'));
  assert.ok(html.includes('title="YouTube Clue"'));
});

test('GameBuilder UI: Clue cards render media indicator icons', () => {
  const testGame: GameConfig = {
    ...defaultGame,
    rounds: [
      {
        id: 'r1',
        name: 'Jeopardy',
        categories: [
          {
            id: 'c1',
            name: 'Media Gallery',
            clues: [
              {
                id: 'clue-img',
                points: 100,
                question: 'Image Q',
                answer: 'Image A',
                state: 'unopened',
                media: { type: 'image', urlOrPath: 'sample.png' },
              },
              {
                id: 'clue-aud',
                points: 200,
                question: 'Audio Q',
                answer: 'Audio A',
                state: 'unopened',
                media: { type: 'audio', urlOrPath: 'sample.mp3' },
              },
              {
                id: 'clue-vid',
                points: 300,
                question: 'Video Q',
                answer: 'Video A',
                state: 'unopened',
                media: { type: 'video', urlOrPath: 'sample.mp4' },
              },
              {
                id: 'clue-yt',
                points: 400,
                question: 'YT Q',
                answer: 'YT A',
                state: 'unopened',
                media: {
                  type: 'youtube',
                  urlOrPath: 'https://youtube.com/watch?v=123',
                },
              },
              {
                id: 'clue-yta',
                points: 500,
                question: 'YTA Q',
                answer: 'YTA A',
                state: 'unopened',
                media: {
                  type: 'youtube',
                  urlOrPath: 'https://youtube.com/watch?v=456',
                  audioOnly: true,
                },
              },
            ],
          },
        ],
      },
    ],
  };

  const html = renderToStaticMarkup(
    React.createElement(GameBuilder, {
      currentConfig: testGame,
      onSaveSuccess: () => {},
      onSaveAndPlay: () => {},
      onCloseGame: () => {},
      saveGameFile: async () => true,
    })
  );
  assert.ok(html.includes('data-testid="media-indicator"'));
  assert.ok(html.includes('data-testid="media-icon-image"'));
  assert.ok(html.includes('data-testid="media-icon-audio"'));
  assert.ok(html.includes('data-testid="media-icon-video"'));
  assert.ok(html.includes('data-testid="media-icon-youtube"'));
});

test(
  'MediaIndicator: High-contrast color themes applied per media type',
  () => {
    const imgHtml = renderToStaticMarkup(
      React.createElement(MediaIndicator, {
        media: { type: 'image', urlOrPath: 'sample.png' },
      })
    );
    assert.ok(imgHtml.includes('bg-sky-950/80'));
    assert.ok(imgHtml.includes('text-sky-300'));
    assert.ok(imgHtml.includes('border-sky-500/60'));

    const audHtml = renderToStaticMarkup(
      React.createElement(MediaIndicator, {
        media: { type: 'audio', urlOrPath: 'sample.mp3' },
      })
    );
    assert.ok(audHtml.includes('bg-purple-950/80'));
    assert.ok(audHtml.includes('text-purple-300'));
    assert.ok(audHtml.includes('border-purple-500/60'));

    const vidHtml = renderToStaticMarkup(
      React.createElement(MediaIndicator, {
        media: { type: 'video', urlOrPath: 'sample.mp4' },
      })
    );
    assert.ok(vidHtml.includes('bg-teal-950/80'));
    assert.ok(vidHtml.includes('text-teal-300'));
    assert.ok(vidHtml.includes('border-teal-500/60'));

    const ytHtml = renderToStaticMarkup(
      React.createElement(MediaIndicator, {
        media: {
          type: 'youtube',
          urlOrPath: 'https://youtube.com/watch?v=123',
        },
      })
    );
    assert.ok(ytHtml.includes('bg-red-950/80'));
    assert.ok(ytHtml.includes('text-red-400'));
    assert.ok(ytHtml.includes('border-red-600/60'));

    const ytaHtml = renderToStaticMarkup(
      React.createElement(MediaIndicator, {
        media: {
          type: 'youtube',
          urlOrPath: 'https://youtube.com/watch?v=123',
          audioOnly: true,
        },
      })
    );
    assert.ok(ytaHtml.includes('bg-purple-950/80'));
    assert.ok(ytaHtml.includes('text-purple-300'));
    assert.ok(ytaHtml.includes('border-purple-500/60'));
    assert.ok(ytaHtml.includes('text-red-400'));
  }
);

test(
  'AdminHost UI: Active clue question modal displays media indicator icon',
  () => {
    const testGame: GameConfig = {
      ...defaultGame,
      rounds: [
        {
          id: 'r1',
          name: 'Jeopardy',
          categories: [
            {
              id: 'c1',
              name: 'Media Gallery',
              clues: [
                {
                  id: 'clue-yta',
                  points: 500,
                  question: 'YTA Question',
                  answer: 'YTA Answer',
                  state: 'active',
                  media: {
                    type: 'youtube',
                    urlOrPath: 'https://youtube.com/watch?v=456',
                    audioOnly: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    let state = gameReducer(initialGameState, {
      type: 'LOAD_GAME',
      payload: testGame,
    });
    state = {
      ...state,
      activeClue: {
        roundIndex: 0,
        categoryIndex: 0,
        clueIndex: 0,
        selectedTeam: 1,
        answeringTeam: 1,
        buzzWinnerTeam: 1,
        reboundAvailable: false,
        reboundOpportunity: false,
        reboundPassedByFirstTeam: false,
        hintRevealed: false,
        answerRevealed: false,
        isReboundMiss: false,
        currentAvailablePoints: 500,
      },
    };

    const html = renderToStaticMarkup(
      React.createElement(AdminHost, {
        state,
        dispatch: () => {},
        openDisplayWindow: () => {},
        onOpenBuilder: () => {},
        onGameCreated: () => {},
      })
    );

    assert.ok(html.includes('$500'));
    assert.ok(html.includes('data-testid="media-indicator"'));
    assert.ok(html.includes('data-testid="media-icon-youtube"'));
    assert.ok(html.includes('data-testid="media-icon-audio"'));
    assert.ok(html.includes('title="YouTube (Audio Only)"'));

    // Question modal renders exactly one indicator, beside Play button
    // Total indicators in HTML: 1 on underlying board tile + 1 in modal
    const indicatorCount = (
      html.match(/data-testid="media-indicator"/g) || []
    ).length;
    assert.strictEqual(indicatorCount, 2);

    // Header point value does not contain an inline media indicator
    assert.ok(!html.includes('$500</span><span class="inline-flex'));
    assert.ok(html.includes('<span>Play</span>'));
  }
);

test(
  'AdminHost UI: Both teams wrong shows only Answer reveal and Done buttons',
  () => {
    let state = gameReducer(initialGameState, {
      type: 'LOAD_GAME',
      payload: defaultGame,
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
    state = gameReducer(state, {
      type: 'ANSWER_WRONG',
      payload: { team: 1 },
    });
    state = gameReducer(state, { type: 'ADVANCE_REBOUND' });
    state = gameReducer(state, {
      type: 'ANSWER_WRONG',
      payload: { team: 2 },
    });

    const html = renderToStaticMarkup(
      React.createElement(AdminHost, {
        state,
        dispatch: () => {},
        openDisplayWindow: () => {},
        onOpenBuilder: () => {},
        onGameCreated: () => {},
      })
    );

    assert.ok(html.includes('<span>Answer</span>'));
    assert.ok(html.includes('<span>Done</span>'));
    assert.ok(!html.includes('Answering:'));
    assert.ok(!html.includes('+$0'));
    assert.ok(!html.includes('<span>Wrong</span>'));
    assert.ok(!html.includes('<span>Rebound</span>'));
    assert.ok(!html.includes('<span>Pass</span>'));

    // Revealing answer disables the Answer button while keeping Done active
    const revealedState = gameReducer(state, { type: 'REVEAL_ANSWER' });
    const revealedHtml = renderToStaticMarkup(
      React.createElement(AdminHost, {
        state: revealedState,
        dispatch: () => {},
        openDisplayWindow: () => {},
        onOpenBuilder: () => {},
        onGameCreated: () => {},
      })
    );

    assert.ok(revealedHtml.includes('<span>Answer</span>'));
    assert.ok(revealedHtml.includes('<span>Done</span>'));
    assert.ok(revealedHtml.includes('title="Reveal answer to players"'));
    assert.ok(revealedHtml.includes('disabled=""'));
  }
);

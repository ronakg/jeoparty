import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PlayerDisplay,
  QuestionTimerBadge,
  SCORE_SPIN_DURATION_MS,
  calculateAnimatedScore,
} from '../src/views/PlayerDisplay';
import { AdminHost, CreateGameModal } from '../src/views/AdminHost';
import { GameBuilder } from '../src/components/builder/GameBuilder';
import { MediaRenderer } from '../src/components/common/MediaRenderer';
import { MobileConnectModal } from '../src/components/common/MobileConnectModal';
import { CompletedClueModal } from '../src/components/common/CompletedClueModal';
import { defaultGame } from '../src/data/defaultGame';
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
  assert.ok(activeHtml.includes('text-modern-gold'));
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
  assert.ok(html.includes('Reset'));
  assert.ok(html.includes('Hint (-$100)'));
  assert.ok(html.includes('Answering:'));
  assert.ok(html.includes('Team 1'));
  assert.ok(html.includes('Team 2'));
  assert.ok(html.includes('bg-blue-600 text-white'));
});

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
  assert.ok(html.includes('Rebound ($50)'));
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

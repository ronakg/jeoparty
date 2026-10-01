import { GameConfig, GameState } from '../types/game';

export type WinnerOutcome = 'team1' | 'team2' | 'tie' | null;

export type GameOverReason =
  | 'regulation_win'
  | 'regulation_tie'
  | 'tie_breaker_win'
  | 'tie_breaker_tie'
  | null;

export interface WinnerState {
  isGameOver: boolean;
  winner: WinnerOutcome;
  winningTeamName: string | null;
  reason: GameOverReason;
  canProceedToTieBreaker: boolean;
}

/**
 * Returns true if every category in every round has all clues marked completed.
 */
export function isBoardComplete(config: GameConfig | null): boolean {
  if (!config || !config.rounds || config.rounds.length === 0) {
    return false;
  }
  return config.rounds.every(
    (round) =>
      round.categories.length > 0 &&
      round.categories.every(
        (cat) =>
          cat.clues.length > 0 &&
          cat.clues.every((clue) => clue.state === 'completed')
      )
  );
}

/**
 * Evaluates game progress and returns current winner status and options.
 */
export function getWinnerState(state: GameState): WinnerState {
  const notOver: WinnerState = {
    isGameOver: false,
    winner: null,
    winningTeamName: null,
    reason: null,
    canProceedToTieBreaker: false,
  };

  if (!state.config || state.activeClue !== null) {
    return notOver;
  }

  // Host declared co-winners directly when scores are tied
  if (state.coWinnersDeclared && state.team1Score === state.team2Score) {
    return {
      isGameOver: true,
      winner: 'tie',
      winningTeamName: null,
      reason: 'regulation_tie',
      canProceedToTieBreaker: false,
    };
  }

  // 1. Tie-breaker round outcome if answers were revealed & judged
  if (state.config.finalJeopardy?.answersRevealed) {
    if (state.team1Score > state.team2Score) {
      return {
        isGameOver: true,
        winner: 'team1',
        winningTeamName: state.config.team1Name,
        reason: 'tie_breaker_win',
        canProceedToTieBreaker: false,
      };
    }
    if (state.team2Score > state.team1Score) {
      return {
        isGameOver: true,
        winner: 'team2',
        winningTeamName: state.config.team2Name,
        reason: 'tie_breaker_win',
        canProceedToTieBreaker: false,
      };
    }
    return {
      isGameOver: true,
      winner: 'tie',
      winningTeamName: null,
      reason: 'tie_breaker_tie',
      canProceedToTieBreaker: false,
    };
  }

  // Tie breaker active or in progress before reveal
  if (state.currentRoundIndex === -1) {
    return notOver;
  }

  // 2. Regulation board completion check
  if (!isBoardComplete(state.config)) {
    return notOver;
  }

  // Board is completed: check scores
  if (state.team1Score > state.team2Score) {
    return {
      isGameOver: true,
      winner: 'team1',
      winningTeamName: state.config.team1Name,
      reason: 'regulation_win',
      canProceedToTieBreaker: false,
    };
  }

  if (state.team2Score > state.team1Score) {
    return {
      isGameOver: true,
      winner: 'team2',
      winningTeamName: state.config.team2Name,
      reason: 'regulation_win',
      canProceedToTieBreaker: false,
    };
  }

  // Scores are equal: tie resolution
  if (!state.config.finalJeopardy) {
    return {
      isGameOver: true,
      winner: 'tie',
      winningTeamName: null,
      reason: 'regulation_tie',
      canProceedToTieBreaker: false,
    };
  }

  // Final jeopardy is configured: check if host declared co-winners
  if (state.coWinnersDeclared) {
    return {
      isGameOver: true,
      winner: 'tie',
      winningTeamName: null,
      reason: 'regulation_tie',
      canProceedToTieBreaker: false,
    };
  }

  // Awaiting host decision between tie-breaker and declaring co-winners
  return {
    isGameOver: false,
    winner: null,
    winningTeamName: null,
    reason: null,
    canProceedToTieBreaker: true,
  };
}

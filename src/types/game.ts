export type MediaType = 'none' | 'image' | 'audio' | 'video' | 'youtube';

export interface MediaClue {
  type: MediaType;
  urlOrPath: string; // File system path, data URI, or YouTube URL
}

export type ClueState = 'unopened' | 'active' | 'completed';

export interface ClueAwardResult {
  winner: 1 | 2 | 'none';
  type: 'full' | 'rebound' | 'none';
  pointsAwarded: number;
}

export interface Clue {
  id: string;
  points: number;
  question: string;
  answer: string;
  hint?: string;
  hintDeduction?: number; // Configurable fixed deduction, defaults to game-level setting
  media?: MediaClue;
  state: ClueState;
  result?: ClueAwardResult;
}

export interface Category {
  id: string;
  name: string;
  clues: Clue[];
}

export interface Round {
  id: string;
  name: string; // e.g. "Jeopardy", "Double Jeopardy"
  categories: Category[];
}

export interface FinalJeopardy {
  category: string;
  question: string;
  answer: string;
  hint?: string;
  media?: MediaClue;
  team1Wager?: number;
  team2Wager?: number;
  team1Correct?: boolean;
  team2Correct?: boolean;
  wagersLocked?: boolean;
  questionRevealed?: boolean;
  answersRevealed?: boolean;
}

export interface DefaultGamePreferences {
  title: string;
  team1Name: string;
  team2Name: string;
  numCategories: number; // 3 to 7
  numQuestionsPerCategory: number; // 3 to 8 rounds/questions per category
  numRounds?: number; // legacy alias
  numCategoriesPerRound?: number; // legacy alias
  cluePointValues: number[];
  hintPenalty: number;
  reboundPercentage: number;
  includeFinalJeopardy: boolean; // Optional tie-breaker
}

export const DEFAULT_PREFERENCES: DefaultGamePreferences = {
  title: '',
  team1Name: '',
  team2Name: '',
  numCategories: 5,
  numQuestionsPerCategory: 5,
  cluePointValues: [100, 200, 300, 400, 500],
  hintPenalty: 100,
  reboundPercentage: 50,
  includeFinalJeopardy: false,
};

export function createGameFromPreferences(
  prefs: Partial<DefaultGamePreferences> = {}
): GameConfig {
  const numCats =
    prefs.numCategories ??
    prefs.numCategoriesPerRound ??
    DEFAULT_PREFERENCES.numCategories;
  const numQuestions =
    prefs.numQuestionsPerCategory ??
    prefs.numRounds ??
    DEFAULT_PREFERENCES.numQuestionsPerCategory;

  let pointValues =
    prefs.cluePointValues && prefs.cluePointValues.length > 0
      ? [...prefs.cluePointValues]
      : Array.from({ length: numQuestions }, (_, i) => (i + 1) * 100);

  // Align point values count with numQuestions if needed
  if (pointValues.length < numQuestions) {
    const lastVal = pointValues[pointValues.length - 1] || 100;
    const step = pointValues.length > 1 ? pointValues[1] - pointValues[0] : 100;
    while (pointValues.length < numQuestions) {
      pointValues.push(
        lastVal +
          step * (pointValues.length - (prefs.cluePointValues?.length ?? 0) + 1)
      );
    }
  } else if (pointValues.length > numQuestions) {
    pointValues = pointValues.slice(0, numQuestions);
  }

  // Single Jeopardy only (no double jeopardy)
  const categories: Category[] = [];
  for (let c = 0; c < numCats; c++) {
    const catNumber = c + 1;
    const clues: Clue[] = pointValues.map((pts, i) => ({
      id: `c-r1-cat${catNumber}-${i + 1}`,
      points: pts,
      question: '',
      answer: '',
      hint: '',
      state: 'unopened',
    }));

    categories.push({
      id: `cat-r1-${catNumber}`,
      name: '',
      clues,
    });
  }

  const rounds: Round[] = [
    {
      id: 'round-1',
      name: 'Jeopardy Round',
      categories,
    },
  ];

  let finalJeopardy: FinalJeopardy | undefined = undefined;
  if (prefs.includeFinalJeopardy ?? DEFAULT_PREFERENCES.includeFinalJeopardy) {
    finalJeopardy = {
      category: '',
      question: '',
      answer: '',
      hint: '',
    };
  }

  return {
    title: prefs.title || '',
    team1Name: prefs.team1Name || '',
    team2Name: prefs.team2Name || '',
    defaultHintDeduction: prefs.hintPenalty ?? DEFAULT_PREFERENCES.hintPenalty,
    reboundPercentage:
      prefs.reboundPercentage ?? DEFAULT_PREFERENCES.reboundPercentage,
    pointProgression: [...pointValues],
    rounds,
    finalJeopardy,
  };
}

export interface GameConfig {
  title: string;
  team1Name: string;
  team2Name: string;
  defaultHintDeduction: number;
  reboundPercentage?: number; // percentage of original points for rebound, e.g. 50
  pointProgression?: number[];
  rounds: Round[];
  finalJeopardy?: FinalJeopardy;
}

export interface ActiveClueSession {
  roundIndex: number;
  categoryIndex: number;
  clueIndex: number;
  originalPoints: number;
  currentAvailablePoints: number;
  hintRevealed: boolean;
  mediaRevealed: boolean;
  mediaPlaying: boolean;
  answerRevealed: boolean;
  // Team turn management
  firstAnsweringTeam: 1 | 2;
  currentAnsweringTeam: 1 | 2;
  reboundOpportunity: boolean; // true if first team failed and second team is rebounding
  reboundAvailable: boolean; // false once rebound is used or passed
  lastJudgedResult?: 'correct' | 'wrong' | 'passed' | null;
  incorrectTeams?: (1 | 2)[];
  correctTeam?: 1 | 2 | null;
  awardResult?: ClueAwardResult;
}

export interface GameState {
  config: GameConfig | null;
  currentRoundIndex: number; // 0, 1, ... or -1 for Final Jeopardy
  team1Score: number;
  team2Score: number;
  activeClue: ActiveClueSession | null;
  controllingTeam: 1 | 2; // Team that selects the next clue
  displayWindowOpen: boolean;
  coWinnersDeclared?: boolean;
}

export type GameAction =
  | { type: 'LOAD_GAME'; payload: GameConfig }
  | { type: 'UNLOAD_GAME' }
  | { type: 'SET_ROUND'; payload: { roundIndex: number } }
  | { type: 'SET_TEAMS'; payload: { team1Name: string; team2Name: string } }
  | { type: 'SET_CONTROLLING_TEAM'; payload: { team: 1 | 2 } }
  | {
      type: 'SELECT_CLUE';
      payload: {
        roundIndex: number;
        categoryIndex: number;
        clueIndex: number;
        firstAnsweringTeam: 1 | 2;
      };
    }
  | { type: 'REVEAL_MEDIA' }
  | { type: 'HIDE_MEDIA' }
  | { type: 'SET_MEDIA_PLAYING'; payload: { playing: boolean } }
  | { type: 'REVEAL_HINT' }
  | { type: 'ANSWER_CORRECT'; payload: { team: 1 | 2 } }
  | { type: 'ANSWER_WRONG'; payload: { team: 1 | 2 } }
  | { type: 'ADVANCE_REBOUND' }
  | { type: 'PASS_REBOUND' }
  | { type: 'REVEAL_ANSWER' }
  | { type: 'CLOSE_CLUE' }
  | {
      type: 'OVERRIDE_SCORES';
      payload: { team1Score: number; team2Score: number };
    }
  | { type: 'RESET_GAME' }
  | {
      type: 'RESET_CLUE_BOX';
      payload: {
        roundIndex: number;
        categoryIndex: number;
        clueIndex: number;
      };
    }
  // Final Jeopardy & Tie-Breaker actions
  | {
      type: 'FJ_SET_WAGERS';
      payload: { team1Wager: number; team2Wager: number };
    }
  | { type: 'FJ_REVEAL_QUESTION' }
  | {
      type: 'FJ_JUDGE';
      payload: { team1Correct: boolean; team2Correct: boolean };
    }
  | { type: 'DECLARE_CO_WINNERS' };

// Electron IPC API definition
export interface ElectronAPI {
  // State sync
  getState: () => Promise<GameState>;
  dispatchAction: (action: GameAction) => Promise<void>;
  onStateUpdate: (callback: (state: GameState) => void) => () => void;
  // Window management
  openDisplayWindow: () => Promise<void>;
  toggleDisplayFullScreen: () => Promise<void>;
  // File operations
  openGameFile: () => Promise<GameConfig | null>;
  saveGameFile: (config: GameConfig) => Promise<boolean>;
  selectMediaFile: (
    type: 'image' | 'audio' | 'video'
  ) => Promise<string | null>;
  toMediaUrl: (filePath: string) => string;
  // Diagnostics
  writeTraceLog?: (entry: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

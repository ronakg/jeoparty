import { GameState, GameAction } from '../types/game';

export const initialGameState: GameState = {
  config: null,
  currentRoundIndex: 0,
  team1Score: 0,
  team2Score: 0,
  controllingTeam: 1,
  activeClue: null,
  displayWindowOpen: false,
  coWinnersDeclared: false,
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'LOAD_GAME': {
      return {
        ...state,
        config: action.payload,
        currentRoundIndex: 0,
        team1Score: 0,
        team2Score: 0,
        controllingTeam: 1,
        activeClue: null,
        coWinnersDeclared: false,
      };
    }

    case 'UNLOAD_GAME': {
      return {
        ...state,
        config: null,
        currentRoundIndex: 0,
        team1Score: 0,
        team2Score: 0,
        controllingTeam: 1,
        activeClue: null,
        coWinnersDeclared: false,
      };
    }

    case 'SET_ROUND': {
      return {
        ...state,
        currentRoundIndex: action.payload.roundIndex,
        activeClue: null,
      };
    }

    case 'SET_TEAMS': {
      if (!state.config) return state;
      return {
        ...state,
        config: {
          ...state.config,
          team1Name: action.payload.team1Name,
          team2Name: action.payload.team2Name,
        },
      };
    }

    case 'SET_CONTROLLING_TEAM': {
      const team = action.payload.team;
      return {
        ...state,
        controllingTeam: team,
        activeClue: state.activeClue
          ? {
              ...state.activeClue,
              currentAnsweringTeam: team,
              firstAnsweringTeam: state.activeClue.reboundOpportunity
                ? state.activeClue.firstAnsweringTeam
                : team,
            }
          : null,
      };
    }

    case 'SELECT_CLUE': {
      if (!state.config) return state;
      const { roundIndex, categoryIndex, clueIndex, firstAnsweringTeam } =
        action.payload;
      const actualFirstAnsweringTeam =
        firstAnsweringTeam || state.controllingTeam || 1;
      const targetRound = state.config.rounds[roundIndex];
      if (!targetRound) return state;
      const targetCategory = targetRound.categories[categoryIndex];
      if (!targetCategory) return state;
      const targetClue = targetCategory.clues[clueIndex];
      if (!targetClue || targetClue.state === 'completed') return state;

      // Mark clue as active
      const updatedRounds = state.config.rounds.map((r, rIdx) => {
        if (rIdx !== roundIndex) return r;
        return {
          ...r,
          categories: r.categories.map((c, cIdx) => {
            if (cIdx !== categoryIndex) return c;
            return {
              ...c,
              clues: c.clues.map((cl, clIdx) => {
                if (clIdx !== clueIndex) return cl;
                return { ...cl, state: 'active' as const };
              }),
            };
          }),
        };
      });

      return {
        ...state,
        config: {
          ...state.config,
          rounds: updatedRounds,
        },
        controllingTeam: actualFirstAnsweringTeam,
        activeClue: {
          roundIndex,
          categoryIndex,
          clueIndex,
          originalPoints: targetClue.points,
          currentAvailablePoints: targetClue.points,
          hintRevealed: false,
          mediaRevealed: false,
          mediaPlaying: false,
          answerRevealed: false,
          firstAnsweringTeam: actualFirstAnsweringTeam,
          currentAnsweringTeam: actualFirstAnsweringTeam,
          reboundOpportunity: false,
          reboundAvailable: true,
          lastJudgedResult: null,
          incorrectTeams: [],
          correctTeam: null,
        },
      };
    }

    case 'REVEAL_HINT': {
      if (!state.config || !state.activeClue || state.activeClue.hintRevealed)
        return state;
      const { roundIndex, categoryIndex, clueIndex } = state.activeClue;
      const clue =
        state.config.rounds[roundIndex]?.categories[categoryIndex]?.clues[
          clueIndex
        ];
      // Do not reveal or deduct points if clue has no hint or an empty hint string
      if (!clue?.hint || !clue.hint.trim()) return state;
      const deduction =
        clue?.hintDeduction ?? state.config.defaultHintDeduction ?? 100;
      const newPoints = Math.max(
        0,
        state.activeClue.currentAvailablePoints - deduction
      );

      return {
        ...state,
        activeClue: {
          ...state.activeClue,
          hintRevealed: true,
          currentAvailablePoints: newPoints,
        },
      };
    }

    case 'REVEAL_MEDIA': {
      if (!state.activeClue) return state;
      return {
        ...state,
        activeClue: {
          ...state.activeClue,
          mediaRevealed: true,
          mediaPlaying: true,
        },
      };
    }

    case 'HIDE_MEDIA': {
      if (!state.activeClue) return state;
      return {
        ...state,
        activeClue: {
          ...state.activeClue,
          mediaRevealed: false,
          mediaPlaying: false,
        },
      };
    }

    case 'SET_MEDIA_PLAYING': {
      if (!state.activeClue) return state;
      return {
        ...state,
        activeClue: {
          ...state.activeClue,
          mediaPlaying: action.payload.playing,
        },
      };
    }

    case 'ANSWER_CORRECT': {
      if (!state.config || !state.activeClue) return state;
      const { team } = action.payload;
      const points = state.activeClue.currentAvailablePoints;
      const isRebound = state.activeClue.reboundOpportunity;
      const awardResult = {
        winner: team,
        type: isRebound ? ('rebound' as const) : ('full' as const),
        pointsAwarded: points,
      };

      // Mark clue completed with result
      const { roundIndex, categoryIndex, clueIndex } = state.activeClue;
      const updatedRounds = state.config.rounds.map((r, rIdx) => {
        if (rIdx !== roundIndex) return r;
        return {
          ...r,
          categories: r.categories.map((c, cIdx) => {
            if (cIdx !== categoryIndex) return c;
            return {
              ...c,
              clues: c.clues.map((cl, clIdx) => {
                if (clIdx !== clueIndex) return cl;
                return {
                  ...cl,
                  state: 'completed' as const,
                  result: awardResult,
                };
              }),
            };
          }),
        };
      });

      return {
        ...state,
        team1Score: team === 1 ? state.team1Score + points : state.team1Score,
        team2Score: team === 2 ? state.team2Score + points : state.team2Score,
        config: {
          ...state.config,
          rounds: updatedRounds,
        },
        activeClue: {
          ...state.activeClue,
          answerRevealed: true,
          reboundAvailable: false,
          reboundOpportunity: false,
          lastJudgedResult: 'correct',
          correctTeam: team,
          awardResult,
          mediaRevealed: false,
          mediaPlaying: false,
        },
      };
    }

    case 'ANSWER_WRONG': {
      if (!state.activeClue) return state;
      const { team } = action.payload;
      const updatedIncorrect = Array.from(
        new Set([...(state.activeClue.incorrectTeams || []), team])
      );

      // No point deduction for wrong answers!
      // If this was a rebound attempt (second team answering), both missed
      if (state.activeClue.reboundOpportunity) {
        return {
          ...state,
          activeClue: {
            ...state.activeClue,
            reboundOpportunity: false,
            reboundAvailable: false,
            currentAvailablePoints: 0,
            lastJudgedResult: 'wrong',
            incorrectTeams: updatedIncorrect,
            mediaRevealed: false,
            mediaPlaying: false,
          },
        };
      }

      // First answering team got it wrong:
      // Record wrong answer and pause playback, but do NOT automatically
      // advance to rebound. Admin decides if the other team gets to answer.
      return {
        ...state,
        activeClue: {
          ...state.activeClue,
          lastJudgedResult: 'wrong',
          incorrectTeams: updatedIncorrect,
          reboundOpportunity: false,
          reboundAvailable: true,
          mediaPlaying: false,
        },
      };
    }

    case 'ADVANCE_REBOUND': {
      if (
        !state.activeClue ||
        !state.activeClue.reboundAvailable ||
        state.activeClue.reboundOpportunity
      ) {
        return state;
      }
      const otherTeam: 1 | 2 =
        state.activeClue.firstAnsweringTeam === 1 ? 2 : 1;
      const reboundPercent = state.config?.reboundPercentage ?? 50;
      const reboundPoints = Math.round(
        state.activeClue.currentAvailablePoints * (reboundPercent / 100)
      );

      return {
        ...state,
        activeClue: {
          ...state.activeClue,
          reboundOpportunity: true,
          reboundAvailable: false,
          currentAnsweringTeam: otherTeam,
          currentAvailablePoints: reboundPoints,
          lastJudgedResult: null,
          mediaPlaying: false,
        },
      };
    }

    case 'PASS_REBOUND': {
      if (!state.activeClue) return state;
      return {
        ...state,
        activeClue: {
          ...state.activeClue,
          reboundOpportunity: false,
          reboundAvailable: false,
          currentAvailablePoints: 0,
          lastJudgedResult: 'passed',
          mediaRevealed: false,
          mediaPlaying: false,
        },
      };
    }

    case 'REVEAL_ANSWER': {
      if (!state.activeClue) return state;
      return {
        ...state,
        activeClue: {
          ...state.activeClue,
          answerRevealed: true,
          mediaRevealed: false,
          mediaPlaying: false,
        },
      };
    }

    case 'CLOSE_CLUE': {
      if (!state.config || !state.activeClue) return state;
      const { roundIndex, categoryIndex, clueIndex } = state.activeClue;
      const finalAwardResult =
        state.activeClue.awardResult ||
        (state.activeClue.correctTeam
          ? {
              winner: state.activeClue.correctTeam,
              type: state.activeClue.reboundOpportunity
                ? ('rebound' as const)
                : ('full' as const),
              pointsAwarded: state.activeClue.currentAvailablePoints,
            }
          : undefined);

      const fallbackResult = {
        winner: 'none' as const,
        type: 'none' as const,
        pointsAwarded: 0,
      };
      const updatedRounds = state.config.rounds.map((r, rIdx) => {
        if (rIdx !== roundIndex) return r;
        return {
          ...r,
          categories: r.categories.map((c, cIdx) => {
            if (cIdx !== categoryIndex) return c;
            return {
              ...c,
              clues: c.clues.map((cl, clIdx) => {
                if (clIdx !== clueIndex) return cl;
                return {
                  ...cl,
                  state: 'completed' as const,
                  result: finalAwardResult || cl.result || fallbackResult,
                };
              }),
            };
          }),
        };
      });

      // Alternating turns rule:
      // Turn switches to the other team on alternate basis.
      // Rebound answers do NOT consume or steal that team's upcoming regular turn.
      const turnOrigin =
        state.activeClue.firstAnsweringTeam || state.controllingTeam || 1;
      const nextControllingTeam: 1 | 2 = turnOrigin === 1 ? 2 : 1;

      return {
        ...state,
        controllingTeam: nextControllingTeam,
        config: {
          ...state.config,
          rounds: updatedRounds,
        },
        activeClue: null,
      };
    }

    case 'OVERRIDE_SCORES': {
      return {
        ...state,
        team1Score: action.payload.team1Score,
        team2Score: action.payload.team2Score,
        coWinnersDeclared: false,
      };
    }

    case 'RESET_GAME': {
      if (!state.config) return state;
      const resetRounds = state.config.rounds.map((r) => ({
        ...r,
        categories: r.categories.map((c) => ({
          ...c,
          clues: c.clues.map((cl) => ({
            ...cl,
            state: 'unopened' as const,
            result: undefined,
          })),
        })),
      }));

      return {
        ...state,
        team1Score: 0,
        team2Score: 0,
        controllingTeam: 1,
        currentRoundIndex: 0,
        activeClue: null,
        coWinnersDeclared: false,
        config: {
          ...state.config,
          rounds: resetRounds,
          finalJeopardy: state.config.finalJeopardy
            ? {
                ...state.config.finalJeopardy,
                team1Wager: undefined,
                team2Wager: undefined,
                team1Correct: undefined,
                team2Correct: undefined,
                wagersLocked: false,
                questionRevealed: false,
                answersRevealed: false,
              }
            : undefined,
        },
      };
    }

    case 'RESET_CLUE_BOX': {
      if (!state.config) return state;
      const { roundIndex, categoryIndex, clueIndex } = action.payload;
      const targetRound = state.config.rounds[roundIndex];
      if (!targetRound) return state;
      const targetCategory = targetRound.categories[categoryIndex];
      if (!targetCategory) return state;
      const targetClue = targetCategory.clues[clueIndex];
      if (!targetClue) return state;

      // 1. If points were previously awarded to a team on this clue, deduct them
      let newTeam1Score = state.team1Score;
      let newTeam2Score = state.team2Score;

      const award = targetClue.result || (targetClue as any).completedResult;
      if (award && award.winner === 1 && award.pointsAwarded) {
        newTeam1Score = Math.max(0, state.team1Score - award.pointsAwarded);
      } else if (award && award.winner === 2 && award.pointsAwarded) {
        newTeam2Score = Math.max(0, state.team2Score - award.pointsAwarded);
      } else if (
        state.activeClue &&
        state.activeClue.roundIndex === roundIndex &&
        state.activeClue.categoryIndex === categoryIndex &&
        state.activeClue.clueIndex === clueIndex
      ) {
        // If active clue already awarded points before close
        if (state.activeClue.correctTeam === 1) {
          newTeam1Score = Math.max(
            0,
            state.team1Score - state.activeClue.currentAvailablePoints
          );
        } else if (state.activeClue.correctTeam === 2) {
          newTeam2Score = Math.max(
            0,
            state.team2Score - state.activeClue.currentAvailablePoints
          );
        }
      }

      // 2. Reset the target clue back to unopened
      const updatedRounds = state.config.rounds.map((r, rIdx) => {
        if (rIdx !== roundIndex) return r;
        return {
          ...r,
          categories: r.categories.map((c, cIdx) => {
            if (cIdx !== categoryIndex) return c;
            return {
              ...c,
              clues: c.clues.map((cl, clIdx) => {
                if (clIdx !== clueIndex) return cl;
                return {
                  ...cl,
                  state: 'unopened' as const,
                  result: undefined,
                  completedResult: undefined,
                };
              }),
            };
          }),
        };
      });

      // 3. If this clue was the currently active clue, close activeClue modal
      const isCurrentlyActive =
        state.activeClue &&
        state.activeClue.roundIndex === roundIndex &&
        state.activeClue.categoryIndex === categoryIndex &&
        state.activeClue.clueIndex === clueIndex;

      return {
        ...state,
        team1Score: newTeam1Score,
        team2Score: newTeam2Score,
        activeClue: isCurrentlyActive ? null : state.activeClue,
        coWinnersDeclared: false,
        config: {
          ...state.config,
          rounds: updatedRounds,
        },
      };
    }

    case 'FJ_SET_WAGERS': {
      if (!state.config || !state.config.finalJeopardy) return state;
      const { finalJeopardy } = state.config;
      return {
        ...state,
        config: {
          ...state.config,
          finalJeopardy: {
            ...finalJeopardy,
            team1Wager: action.payload.team1Wager,
            team2Wager: action.payload.team2Wager,
            wagersLocked: true,
          },
        },
      };
    }

    case 'FJ_REVEAL_QUESTION': {
      if (!state.config || !state.config.finalJeopardy) return state;
      const { finalJeopardy } = state.config;
      return {
        ...state,
        config: {
          ...state.config,
          finalJeopardy: {
            ...finalJeopardy,
            questionRevealed: true,
          },
        },
      };
    }

    case 'FJ_JUDGE': {
      if (!state.config || !state.config.finalJeopardy) return state;
      const { finalJeopardy } = state.config;
      const { team1Correct, team2Correct } = action.payload;
      const w1 = finalJeopardy.team1Wager ?? 0;
      const w2 = finalJeopardy.team2Wager ?? 0;

      const newT1 = team1Correct
        ? state.team1Score + w1
        : Math.max(0, state.team1Score - w1);
      const newT2 = team2Correct
        ? state.team2Score + w2
        : Math.max(0, state.team2Score - w2);

      return {
        ...state,
        team1Score: newT1,
        team2Score: newT2,
        config: {
          ...state.config,
          finalJeopardy: {
            ...finalJeopardy,
            team1Correct,
            team2Correct,
            answersRevealed: true,
          },
        },
      };
    }

    case 'DECLARE_CO_WINNERS': {
      return {
        ...state,
        coWinnersDeclared: true,
      };
    }

    case 'SYNC_STATE': {
      if (!action.payload) return state;
      return {
        ...action.payload,
        displayWindowOpen: state.displayWindowOpen,
      };
    }

    default:
      return state;
  }
}

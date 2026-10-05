import React, { useEffect, useState, useRef } from 'react';
import { GameState } from '../types/game';
import { MediaRenderer } from '../components/common/MediaRenderer';
import {
  Maximize,
  HelpCircle,
  Sparkles,
  XCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { getWinnerState, formatTimerMmSs } from '../utils/gameRules';
import { tracer } from '../utils/tracer';

interface PlayerDisplayProps {
  state: GameState;
  toMediaUrl: (path: string) => string;
  onToggleFullScreen: () => void;
}

const useAnimatedScore = (targetScore: number, msPerHundred = 500) => {
  const [displayScore, setDisplayScore] = useState(targetScore);
  const prevScoreRef = useRef(targetScore);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const startScore = prevScoreRef.current;
    const endScore = targetScore;
    prevScoreRef.current = targetScore;

    if (startScore === endScore) {
      setDisplayScore(endScore);
      return;
    }

    const diff = endScore - startScore;
    // Half a second (500ms) per 100 points
    const duration = Math.max(
      250,
      Math.round((Math.abs(diff) / 100) * msPerHundred)
    );
    const startTime = performance.now();
    let animationFrameId: number;
    setIsAnimating(true);

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startScore + diff * easeOut);
      setDisplayScore(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayScore(endScore);
        setIsAnimating(false);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [targetScore, msPerHundred]);

  return { displayScore, isAnimating };
};

interface TabularScoreProps {
  score: number;
  isAnimating: boolean;
  size?: 'normal' | 'large';
  className?: string;
}

const TabularScore: React.FC<TabularScoreProps> = ({
  score,
  isAnimating,
  size = 'normal',
  className = '',
}) => {
  const isNegative = score < 0;
  const absScore = Math.abs(score);
  const digits = String(absScore).split('');
  const sizeClasses =
    size === 'large'
      ? 'text-5xl sm:text-7xl md:text-8xl'
      : 'text-3xl md:text-4xl';

  return (
    <span
      className={
        'inline-flex items-center justify-end font-display font-black ' +
        'tabular-nums tracking-tight transition-colors duration-200 ' +
        `shrink-0 select-none ${sizeClasses} ` +
        (isAnimating
          ? 'text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]'
          : 'text-modern-gold') +
        (className ? ` ${className}` : '')
      }
      style={{
        fontVariantNumeric: 'tabular-nums',
        fontFeatureSettings: '"tnum" 1',
      }}
    >
      {isNegative && (
        <span className="inline-block text-center w-[0.45em]">-</span>
      )}
      <span className="inline-block text-center w-[0.65em]">$</span>
      {digits.map((digit, idx) => (
        <span key={idx} className="inline-block text-center w-[0.65em]">
          {digit}
        </span>
      ))}
    </span>
  );
};

// Official logo colors: gold, amber, blue, light blue, buzzer red, white
const LOGO_CONFETTI_COLORS = [
  '#FFCE2B',
  '#F59E0B',
  '#2563EB',
  '#3B82F6',
  '#FF1744',
  '#FFFFFF',
];

export interface QuestionTimerState {
  enabled: boolean;
  remaining: number;
  isWaitingForMedia: boolean;
}

export const useQuestionTimer = (
  timerSeconds?: number,
  timerStartedAt?: number | null,
  isClueResolved?: boolean
): QuestionTimerState => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timerSeconds || timerSeconds <= 0) return;
    if (timerStartedAt === null || timerStartedAt === undefined) return;
    if (isClueResolved) return;

    setNow(Date.now());
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => clearInterval(interval);
  }, [timerSeconds, timerStartedAt, isClueResolved]);

  if (!timerSeconds || timerSeconds <= 0) {
    return { enabled: false, remaining: 0, isWaitingForMedia: false };
  }

  if (timerStartedAt === null || timerStartedAt === undefined) {
    return {
      enabled: true,
      remaining: timerSeconds,
      isWaitingForMedia: true,
    };
  }

  const elapsed = Math.max(0, Math.floor((now - timerStartedAt) / 1000));
  const remaining = Math.max(0, timerSeconds - elapsed);

  return {
    enabled: true,
    remaining,
    isWaitingForMedia: false,
  };
};

export const QuestionTimerBadge: React.FC<{
  remaining: number;
  isWaitingForMedia: boolean;
}> = ({ remaining, isWaitingForMedia }) => {
  const formattedTime = formatTimerMmSs(remaining);

  if (isWaitingForMedia) {
    return (
      <div
        className={
          'flex items-center gap-1.5 px-3 py-1 rounded-full border ' +
          'bg-[#060e24]/80 border-blue-500/25 text-blue-300/70 ' +
          'font-mono font-bold text-xs sm:text-sm tracking-wider ' +
          'tabular-nums'
        }
        title="Timer starts when media is shown"
      >
        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400/60" />
        <span>{formattedTime}</span>
      </div>
    );
  }

  const isExpired = remaining === 0;
  const isUrgent = remaining > 0 && remaining <= 5;

  return (
    <div
      className={
        'flex items-center gap-1.5 px-3 py-1 rounded-full border ' +
        'font-mono font-bold text-xs sm:text-sm tracking-wider ' +
        'tabular-nums transition-colors duration-200 ' +
        (isExpired
          ? 'bg-rose-950/40 border-rose-500/50 text-rose-300'
          : isUrgent
            ? 'bg-amber-950/40 border-amber-500/50 text-amber-300 ' +
              'animate-pulse'
            : 'bg-[#060e24]/80 border-blue-400/30 text-modern-gold')
      }
    >
      <Clock
        className={
          'w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ' +
          (isExpired
            ? 'text-rose-400'
            : isUrgent
              ? 'text-amber-400'
              : 'text-modern-gold')
        }
      />
      <span>{formattedTime}</span>
    </div>
  );
};

export const PlayerDisplay: React.FC<PlayerDisplayProps> = ({
  state,
  toMediaUrl,
  onToggleFullScreen,
}) => {
  const { config, currentRoundIndex, team1Score, team2Score, activeClue } =
    state;

  const { displayScore: t1DisplayScore, isAnimating: t1Animating } =
    useAnimatedScore(team1Score);
  const { displayScore: t2DisplayScore, isAnimating: t2Animating } =
    useAnimatedScore(team2Score);

  const isClueResolved = Boolean(
    activeClue?.correctTeam ||
      activeClue?.answerRevealed ||
      (activeClue?.incorrectTeams && activeClue.incorrectTeams.length >= 2)
  );

  const timerState = useQuestionTimer(
    config?.questionTimerSeconds,
    activeClue?.timerStartedAt,
    isClueResolved
  );

  const winnerState = getWinnerState(state);
  const celebrationTriggerRef = useRef<string | null>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [awardedTeam, setAwardedTeam] = useState<1 | 2 | null>(null);
  const [lastJudgedTrigger, setLastJudgedTrigger] = useState<string | null>(
    null
  );

  const isFinalJeopardy = currentRoundIndex === -1 && !!config?.finalJeopardy;

  // Celebratory confetti sequence bursting directly out of the app logo
  useEffect(() => {
    if (!winnerState.isGameOver) {
      celebrationTriggerRef.current = null;
      return;
    }

    const triggerKey =
      `gameover-${winnerState.winner}-${winnerState.reason}-` +
      `${team1Score}-${team2Score}`;
    if (celebrationTriggerRef.current === triggerKey) return;
    celebrationTriggerRef.current = triggerKey;

    tracer.record(
      'WINNER_STATE',
      `PlayerDisplay rendered victory: winner=${winnerState.winner}`,
      {
        winner: winnerState.winner,
        reason: winnerState.reason,
        team1Score,
        team2Score,
      },
      undefined,
      'display'
    );

    const rect = logoRef.current?.getBoundingClientRect();
    const originX = rect
      ? (rect.left + rect.width / 2) / window.innerWidth
      : 0.5;
    const originY = rect
      ? (rect.top + rect.height / 2) / window.innerHeight
      : 0.28;

    // 1. Radial explosion bursting directly from the app logo
    confetti({
      particleCount: 100,
      spread: 360,
      startVelocity: 40,
      origin: { x: originX, y: originY },
      colors: LOGO_CONFETTI_COLORS,
    });

    // 2. Upward arching fountain from the app logo
    confetti({
      particleCount: 130,
      angle: 90,
      spread: 120,
      startVelocity: 50,
      origin: { x: originX, y: originY },
      colors: LOGO_CONFETTI_COLORS,
    });

    const timer1 = setTimeout(() => {
      confetti({
        particleCount: 140,
        spread: 110,
        startVelocity: 45,
        origin: { x: originX, y: originY },
        colors: LOGO_CONFETTI_COLORS,
      });
    }, 300);

    const timer2 = setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 140,
        startVelocity: 35,
        origin: { x: originX, y: originY },
        colors: LOGO_CONFETTI_COLORS,
      });
    }, 700);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [
    winnerState.isGameOver,
    winnerState.winner,
    winnerState.reason,
    team1Score,
    team2Score,
  ]);

  // Handle gameplay feedback: emerald surge on Correct, shake on Wrong
  useEffect(() => {
    if (!activeClue) {
      setLastJudgedTrigger(null);
      setIsShaking(false);
      setAwardedTeam(null);
      return;
    }

    if (activeClue.lastJudgedResult === 'wrong') {
      const triggerKey =
        `wrong-${activeClue.incorrectTeams?.length}-` +
        `${activeClue.currentAnsweringTeam}`;
      if (lastJudgedTrigger !== triggerKey) {
        setLastJudgedTrigger(triggerKey);
        setIsShaking(true);
        const timer = setTimeout(() => setIsShaking(false), 700);
        return () => clearTimeout(timer);
      }
    } else if (activeClue.lastJudgedResult === 'correct') {
      const triggerKey = `correct-${activeClue.correctTeam}`;
      if (lastJudgedTrigger !== triggerKey) {
        setLastJudgedTrigger(triggerKey);
        setAwardedTeam(activeClue.correctTeam ?? null);
        const timer = setTimeout(() => setAwardedTeam(null), 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [
    activeClue,
    activeClue?.lastJudgedResult,
    activeClue?.incorrectTeams?.length,
    activeClue?.correctTeam,
    activeClue?.currentAnsweringTeam,
    lastJudgedTrigger,
  ]);

  if (!config) {
    return (
      <div className="relative w-screen h-screen stage-ambient ambient-grid text-white flex flex-col items-center justify-center overflow-hidden select-none p-8">
        {/* Top Window Drag Strip */}
        <div
          className={
            'absolute top-0 left-0 right-0 h-11 titlebar-drag z-30 ' +
            'pointer-events-auto'
          }
        />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-blue-600/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-2xl">
          <img
            src="./logo.svg"
            alt="JeoPARTY!"
            className={
              'w-56 h-56 md:w-72 md:h-72 object-contain drop-shadow-2xl mb-4'
            }
          />

          <p
            className={
              'text-sm md:text-base uppercase tracking-widest ' +
              'text-amber-200/80 font-bold font-display mb-8'
            }
          >
            Trivia, Team Fights &amp; Petty Rivalries
          </p>

          <div
            className={
              'flex items-center gap-3 px-6 py-3 rounded-full ' +
              'bg-blue-950/60 border border-blue-400/20 text-blue-300 ' +
              'text-sm font-semibold tracking-wider backdrop-blur shadow-hud'
            }
          >
            <span
              className={'w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping'}
            />
            <span>Waiting for the host to start the game...</span>
          </div>
        </div>

        <button
          onClick={onToggleFullScreen}
          className="absolute bottom-6 right-6 p-3 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-gray-400 hover:text-white transition-all"
          title="Toggle Fullscreen (F)"
        >
          <Maximize className="w-5 h-5" />
        </button>
      </div>
    );
  }

  const currentRound = config.rounds[currentRoundIndex] || config.rounds[0];

  // Determine active clue details
  const activeClueData = activeClue
    ? config.rounds[activeClue.roundIndex]?.categories[activeClue.categoryIndex]
        ?.clues[activeClue.clueIndex]
    : null;

  const showActiveMedia = Boolean(
    activeClue?.mediaRevealed &&
    activeClueData?.media &&
    activeClueData.media.type !== 'none' &&
    !activeClue.answerRevealed &&
    !activeClue.correctTeam &&
    !(activeClue.incorrectTeams && activeClue.incorrectTeams.length >= 2)
  );

  const getTeamCardProps = (teamId: 1 | 2) => {
    // 1. During an active clue
    if (activeClue) {
      const isCorrect = activeClue.correctTeam === teamId;
      const isIncorrect = Boolean(activeClue.incorrectTeams?.includes(teamId));
      const originTurnTeam =
        activeClue.firstAnsweringTeam || state.controllingTeam || 1;
      const isOriginTurn = originTurnTeam === teamId;

      // Answering state: actively answering right now (before judgment)
      const isAnswering =
        !activeClue.correctTeam &&
        !isIncorrect &&
        !activeClue.answerRevealed &&
        activeClue.currentAnsweringTeam === teamId;

      let borderClass = 'border border-blue-900/50 bg-[#060d22]';
      if (isCorrect) {
        borderClass =
          'border-2 border-emerald-500 bg-emerald-950/30' +
          (awardedTeam === teamId ? ' animate-podium-award' : '');
      } else if (isIncorrect) {
        borderClass = 'border-2 border-rose-500/80 bg-rose-950/30';
      } else if (isAnswering) {
        borderClass =
          'border-2 bg-[#09173a] border-blue-400 animate-border-blink';
      }

      let badge = null;
      if (isCorrect) {
        badge = (
          <span
            className={
              'px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 ' +
              'text-[10px] font-bold uppercase tracking-wider flex ' +
              'items-center gap-1 font-display'
            }
          >
            <CheckCircle2 className="w-3 h-3" />
            {isOriginTurn ? <span>Turn</span> : <span>Rebound</span>}
          </span>
        );
      } else if (isIncorrect) {
        badge = (
          <span
            className={
              'px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 ' +
              'text-[10px] font-bold uppercase tracking-wider flex ' +
              'items-center gap-1 font-display'
            }
          >
            <XCircle className="w-3 h-3" />
            <span>Missed</span>
          </span>
        );
      } else if (
        activeClue.reboundOpportunity &&
        activeClue.currentAnsweringTeam === teamId
      ) {
        badge = (
          <span
            className={
              'px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 ' +
              'text-[10px] font-black uppercase tracking-wider font-display'
            }
          >
            Rebound
          </span>
        );
      } else if (isOriginTurn) {
        badge = (
          <span
            className={
              'px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 ' +
              'text-[10px] font-black uppercase tracking-wider font-display'
            }
          >
            Turn
          </span>
        );
      }

      return { borderClass, badge };
    }

    // 2. On the board (activeClue is null)
    const isTurn = state.controllingTeam === teamId;
    const borderClass = isTurn
      ? 'border-2 bg-[#09173a] border-blue-400/80 shadow-md'
      : 'border border-blue-900/50 bg-[#060d22]';
    const badge = isTurn ? (
      <span
        className={
          'px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 ' +
          'text-[10px] font-black uppercase tracking-wider font-display'
        }
      >
        Turn
      </span>
    ) : null;

    return { borderClass, badge };
  };

  return (
    <div
      className={
        'relative w-screen h-screen bg-[#040817] text-white flex flex-col ' +
        'justify-between overflow-hidden select-none'
      }
    >
      {/* Ambient Royal Blue Stage Wash */}
      <div
        className={
          'absolute inset-0 pointer-events-none ' +
          'bg-[radial-gradient(circle_at_50%_40%,' +
          'rgba(10,36,118,0.14)_0%,transparent_72%)]'
        }
      />

      {/* Top Header Bar (hidden on victory screen) */}
      {!winnerState.isGameOver && (
        <header
          className={
            'relative z-10 w-full bg-[#060e24]/90 ' +
            'border-b border-blue-900/60 ' +
            'px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between ' +
            'shrink-0 shadow-md titlebar-drag titlebar-pad backdrop-blur-sm'
          }
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <img
              src="./logo.svg"
              alt="JeoPARTY!"
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain shrink-0"
            />
            <h1
              className={
                'text-base md:text-lg font-black uppercase tracking-[0.2em] ' +
                'text-modern-gold font-display truncate'
              }
            >
              {config.title}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isFinalJeopardy && (
              <div
                className={
                  'px-4 py-1 rounded-full bg-amber-500/15 border ' +
                  'border-amber-400/30 text-amber-300 font-extrabold ' +
                  'uppercase tracking-widest text-xs flex items-center gap-2'
                }
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tie-Breaker Question</span>
              </div>
            )}
            <button
              onClick={onToggleFullScreen}
              title="Toggle Fullscreen (F)"
              className={
                'p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] border ' +
                'border-white/10 text-white/70 hover:text-white ' +
                'transition-all shadow-sm'
              }
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* MAIN CONTENT AREA */}
      <main
        className={
          'relative z-10 flex-1 flex flex-col overflow-hidden min-h-0 ' +
          (winnerState.isGameOver ? 'p-0' : 'p-3 md:p-5')
        }
      >
        {/* VIEW 0: GAME OVER WINNER SCREEN */}
        {winnerState.isGameOver ? (
          <div
            className={
              'flex-1 flex flex-col items-center justify-center ' +
              'py-[5vh] px-4 sm:px-8 md:px-12 animate-modern-enter relative ' +
              'overflow-hidden select-none h-full'
            }
          >
            {/* Ambient Royal Blue Victory Stage Wash */}
            <div
              className={
                'absolute inset-0 pointer-events-none ' +
                'bg-[radial-gradient(circle_at_50%_38%,' +
                'rgba(8,32,107,0.42)_0%,' +
                'rgba(5,19,61,0.22)_52%,transparent_78%)]'
              }
            />
            <div
              className={
                'absolute bottom-0 inset-x-0 h-1/2 pointer-events-none ' +
                'bg-gradient-to-t from-[#071c59]/25 via-transparent ' +
                'to-transparent'
              }
            />

            {/* JeoPARTY! official logo as victory centerpiece */}
            <img
              ref={logoRef}
              src="./logo.svg"
              alt="JeoPARTY!"
              className={
                'h-[13vh] max-h-40 min-h-20 w-auto object-contain ' +
                'drop-shadow-[0_16px_40px_rgba(0,0,0,0.85)] mb-[2.5vh] ' +
                'shrink-0'
              }
            />

            {/* <game name> champion pill */}
            <div
              className={
                'inline-flex items-center px-6 sm:px-8 py-[1vh] ' +
                'rounded-full bg-amber-500/15 border border-amber-400/30 ' +
                'text-amber-300 text-sm sm:text-base md:text-lg font-black ' +
                'uppercase tracking-wider mb-[3.5vh] shrink-0'
              }
            >
              <span>
                {winnerState.winner === 'tie'
                  ? `${config.title || 'JeoPARTY!'} Co-Champions`
                  : `${config.title || 'JeoPARTY!'} Champion`}
              </span>
            </div>

            {/* Winner Team Name (no "wins") */}
            {winnerState.winner === 'tie' ? (
              <h2
                className={
                  'flex flex-col items-center justify-center ' +
                  'text-center max-w-5xl font-display uppercase font-black ' +
                  'drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] shrink-0'
                }
              >
                <span
                  className={
                    'text-4xl sm:text-6xl md:text-7xl text-white ' +
                    'tracking-tight leading-tight'
                  }
                >
                  {config.team1Name}
                </span>
                <span
                  className={
                    'text-2xl sm:text-3xl md:text-4xl text-amber-300 ' +
                    'my-[1.2vh] font-black tracking-widest'
                  }
                >
                  &amp;
                </span>
                <span
                  className={
                    'text-4xl sm:text-6xl md:text-7xl text-white ' +
                    'tracking-tight leading-tight'
                  }
                >
                  {config.team2Name}
                </span>
              </h2>
            ) : (
              <h2
                className={
                  'text-5xl sm:text-7xl md:text-8xl font-black uppercase ' +
                  'tracking-tight text-white font-display leading-tight ' +
                  'drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] max-w-5xl ' +
                  'text-center shrink-0'
                }
              >
                {winnerState.winningTeamName}
              </h2>
            )}

            {/* Winner Final Score */}
            <div
              className={
                'mt-[4vh] sm:mt-[5vh] flex items-center justify-center ' +
                'shrink-0'
              }
            >
              <TabularScore
                score={
                  winnerState.winner === 'team1'
                    ? team1Score
                    : winnerState.winner === 'team2'
                      ? team2Score
                      : team1Score
                }
                isAnimating={false}
                size="large"
              />
            </div>

            {/* Muted losing team details separated by vertical gap */}
            {winnerState.winner !== 'tie' && (
              <div
                className={
                  'mt-[6vh] sm:mt-[7vh] flex items-center gap-3 ' +
                  'text-slate-400 text-sm sm:text-base md:text-lg ' +
                  'font-medium shrink-0'
                }
              >
                <span className="text-slate-400 font-bold font-display">
                  {winnerState.winner === 'team1'
                    ? config.team2Name
                    : config.team1Name}
                </span>
                <span className="text-slate-500 font-mono font-bold">
                  ${winnerState.winner === 'team1' ? team2Score : team1Score}
                </span>
              </div>
            )}
          </div>
        ) : isFinalJeopardy ? (
          <div
            className={
              'flex-1 flex flex-col items-center justify-center text-center ' +
              'p-8 md:p-12 rounded-2xl bg-gradient-to-b from-[#071c59] ' +
              'to-[#041038] border border-amber-500/40 shadow-2xl ' +
              'animate-modern-enter relative overflow-hidden'
            }
          >
            {/* Ambient Sapphire Radial Wash */}
            <div
              className={
                'absolute inset-0 bg-radial from-blue-500/10 ' +
                'via-transparent to-transparent pointer-events-none'
              }
            />

            <div
              className={
                'inline-flex items-center gap-2 px-4 py-1.5 rounded-full ' +
                'bg-amber-500/10 border border-amber-400/30 text-amber-300 ' +
                'font-black text-xs uppercase tracking-widest mb-4'
              }
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tie-Breaker Category</span>
            </div>

            <h2
              className={
                'text-4xl md:text-6xl lg:text-7xl font-black uppercase ' +
                'tracking-wider text-modern-gold mb-10 max-w-4xl ' +
                'font-display leading-tight'
              }
            >
              {config.finalJeopardy?.category}
            </h2>

            {config.finalJeopardy?.questionRevealed ? (
              <div
                className={
                  'flex flex-col items-center max-w-4xl animate-modern-enter'
                }
              >
                <div
                  className={
                    'p-8 md:p-10 rounded-2xl bg-gradient-to-b ' +
                    'from-[#08206b] to-[#05133d] border ' +
                    'border-blue-400/30 mb-8 shadow-xl'
                  }
                >
                  <p
                    className={
                      'text-3xl md:text-5xl font-display font-black ' +
                      'text-white leading-snug tracking-tight ' +
                      'drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)]'
                    }
                  >
                    {config.finalJeopardy.question}
                  </p>
                </div>

                {!config.finalJeopardy.answersRevealed &&
                  config.finalJeopardy.media &&
                  config.finalJeopardy.media.type !== 'none' && (
                    <div className="my-4">
                      <MediaRenderer
                        media={config.finalJeopardy.media}
                        resolvedUrl={toMediaUrl(
                          config.finalJeopardy.media.urlOrPath
                        )}
                        showControls={false}
                        fullScreen={true}
                      />
                    </div>
                  )}

                {config.finalJeopardy.answersRevealed && (
                  <div
                    className={
                      'mt-4 p-8 rounded-2xl bg-emerald-950/60 border ' +
                      'border-emerald-400/50 flex flex-col items-center ' +
                      'animate-modern-enter'
                    }
                  >
                    <span
                      className={
                        'text-xs uppercase tracking-widest ' +
                        'text-emerald-300 font-extrabold block mb-1'
                      }
                    >
                      Correct Response
                    </span>
                    <span
                      className={
                        'text-3xl md:text-5xl font-black uppercase ' +
                        'text-white font-display'
                      }
                    >
                      {config.finalJeopardy.answer}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div
                className={
                  'flex items-center gap-3 px-6 py-3 rounded-2xl ' +
                  'bg-[#060e24] border border-blue-900/60 text-slate-300 ' +
                  'text-sm font-semibold tracking-wider'
                }
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>
                  Teams are submitting secret wagers... Clue will appear shortly
                </span>
              </div>
            )}
          </div>
        ) : activeClue && activeClueData ? (
          /* Active Clue View */
          <div
            className={
              `flex-1 flex flex-col justify-between p-6 md:p-8 lg:p-10 ` +
              `rounded-2xl bg-gradient-to-b from-[#071c59] to-[#041038] ` +
              `shadow-2xl relative overflow-hidden transition-all ` +
              `duration-300 ` +
              (isShaking
                ? 'animate-shake !border-2 !border-rose-500 ' +
                  'shadow-[0_0_35px_rgba(244,63,94,0.45)] '
                : activeClue.incorrectTeams &&
                    activeClue.incorrectTeams.length > 0 &&
                    !activeClue.correctTeam
                  ? '!border-2 !border-rose-500 ' +
                    'shadow-[0_0_35px_rgba(244,63,94,0.45)] '
                  : 'border border-blue-400/35 ' +
                    'shadow-[0_0_40px_rgba(5,18,59,0.7)] ' +
                    'animate-modern-enter ')
            }
          >
            <div
              className={
                'absolute inset-0 bg-radial from-blue-600/10 via-transparent ' +
                'to-transparent pointer-events-none'
              }
            />

            {/* Header: Category Badge & Points */}
            <div
              className={
                'w-full flex items-center justify-between border-b ' +
                'border-white/[0.08] pb-3 mb-2 relative z-10'
              }
            >
              <span
                className={
                  'px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-100 ' +
                  'text-sm md:text-base font-extrabold uppercase ' +
                  'tracking-wide font-display'
                }
              >
                {currentRound?.categories[activeClue.categoryIndex]?.name}
              </span>

              <div className="flex items-center gap-3 sm:gap-4">
                {timerState.enabled && (
                  <QuestionTimerBadge
                    remaining={timerState.remaining}
                    isWaitingForMedia={timerState.isWaitingForMedia}
                  />
                )}
                {activeClue.reboundOpportunity && (
                  <span
                    className={
                      'px-3.5 py-1 bg-rose-500/20 border border-rose-500/40 ' +
                      'text-rose-300 font-bold text-xs uppercase ' +
                      'tracking-wider rounded-full'
                    }
                  >
                    Rebound (50%)
                  </span>
                )}
                <span
                  className={
                    'text-xl sm:text-2xl md:text-3xl font-black ' +
                    'tracking-tight text-modern-gold font-display leading-none'
                  }
                >
                  ${activeClue.currentAvailablePoints}
                </span>
              </div>
            </div>

            {/* Central Question & Media Presentation */}
            <div
              className={
                'flex-1 flex flex-col items-center relative z-10 ' +
                (showActiveMedia
                  ? 'justify-start pt-2 overflow-hidden '
                  : 'justify-center my-auto ') +
                'text-center max-w-5xl px-4 py-2 mx-auto w-full min-h-0'
              }
            >
              <h2
                className={
                  showActiveMedia
                    ? 'shrink-0 text-base sm:text-lg md:text-xl ' +
                      'font-display font-black text-slate-100 ' +
                      'tracking-tight leading-snug mb-2 ' +
                      'drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] line-clamp-3'
                    : 'text-3xl md:text-5xl lg:text-6xl font-display ' +
                      'font-black text-white tracking-tight leading-snug ' +
                      'md:leading-tight ' +
                      'drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)]'
                }
              >
                {activeClueData.question}
              </h2>

              {/* In-Card Media Display */}
              {showActiveMedia && activeClueData.media && (
                <div
                  className={
                    'flex-1 min-h-0 w-full flex items-center ' +
                    'justify-center overflow-hidden py-1'
                  }
                >
                  <MediaRenderer
                    media={activeClueData.media}
                    resolvedUrl={toMediaUrl(activeClueData.media.urlOrPath)}
                    isPlaying={activeClue.mediaPlaying}
                    showControls={false}
                    autoPlay={true}
                    fullScreen={false}
                    className="max-h-full max-w-full"
                  />
                </div>
              )}

              {/* Both Teams Answered Incorrectly */}
              {activeClue.incorrectTeams &&
                activeClue.incorrectTeams.length >= 2 &&
                !activeClue.answerRevealed && (
                  <div
                    className={
                      'mt-6 px-6 py-3 rounded-2xl bg-gray-900 border ' +
                      'border-rose-500/50 flex items-center justify-center ' +
                      'gap-3 max-w-2xl w-full'
                    }
                  >
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    <span
                      className={
                        'text-sm font-bold uppercase tracking-wide ' +
                        'text-rose-200 font-display'
                      }
                    >
                      Both teams missed! No points awarded.
                    </span>
                  </div>
                )}

              {/* Text Hint Card */}
              {activeClue.hintRevealed &&
                activeClueData.hint &&
                activeClueData.hint.trim() && (
                  <div
                    className={
                      'mt-6 px-6 py-4 rounded-2xl bg-amber-950/40 border ' +
                      'border-amber-500/30 flex items-center gap-4 ' +
                      'max-w-3xl animate-modern-enter'
                    }
                  >
                    <div
                      className={
                        'p-2 rounded-xl bg-amber-400/20 text-amber-300 shrink-0'
                      }
                    >
                      <HelpCircle className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <span
                        className={
                          'text-[11px] uppercase tracking-widest ' +
                          'text-amber-400 font-extrabold block'
                        }
                      >
                        Hint (-$
                        {activeClueData.hintDeduction ??
                          config.defaultHintDeduction ??
                          100}{' '}
                        pts)
                      </span>
                      <span
                        className={
                          'text-xl md:text-2xl font-editorial italic ' +
                          'text-amber-100 font-medium'
                        }
                      >
                        "{activeClueData.hint}"
                      </span>
                    </div>
                  </div>
                )}

              {/* Correct Answer Reveal Banner */}
              {activeClue.answerRevealed && (
                <div
                  className={
                    'mt-6 px-8 py-3.5 rounded-2xl bg-emerald-950/70 border ' +
                    'border-emerald-400/50 flex items-center justify-center ' +
                    'gap-3 animate-modern-enter shadow-tile ' +
                    (activeClue.correctTeam
                      ? 'shadow-[0_0_35px_rgba(16,185,129,0.35)] '
                      : '')
                  }
                >
                  <CheckCircle2
                    className={
                      'w-6 h-6 text-emerald-400 shrink-0 ' +
                      (activeClue.correctTeam ? 'animate-victory-burst' : '')
                    }
                  />
                  <span
                    className={
                      'text-2xl md:text-3xl lg:text-4xl font-black uppercase ' +
                      'tracking-wide text-white font-display ' +
                      'drop-shadow-[0_2px_12px_rgba(16,185,129,0.6)]'
                    }
                  >
                    {activeClueData.answer}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* VIEW 3: MODERN JEOPARDY BOARD GRID */
          <div className="flex-1 flex flex-col gap-2 md:gap-3 min-h-0">
            {/* Category Headers Row with Bigger Fonts and Distinct Color */}
            <div
              className="grid gap-2 md:gap-3 flex-none"
              style={{
                gridTemplateColumns:
                  `repeat(${currentRound?.categories.length || 5}, ` +
                  'minmax(0, 1fr))',
              }}
            >
              {currentRound?.categories.map((category) => (
                <div
                  key={category.id}
                  className={
                    'h-16 md:h-20 lg:h-24 rounded-xl p-2 md:p-3 flex ' +
                    'items-center justify-center text-center shadow-md ' +
                    'relative overflow-hidden bg-gradient-to-b ' +
                    'from-[#082470] to-[#051644] border border-blue-400/35 ' +
                    'border-b-2 border-b-blue-400/90 ' +
                    'shadow-[inset_0_1px_1px_rgba(255,255,255,0.18)]'
                  }
                >
                  <h3
                    className={
                      'text-xs sm:text-sm md:text-base lg:text-lg ' +
                      'font-black uppercase tracking-wide text-white ' +
                      'line-clamp-2 md:line-clamp-3 font-display ' +
                      'leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]'
                    }
                  >
                    {category.name}
                  </h3>
                </div>
              ))}
            </div>

            {/* Clue Point Value Rows */}
            {(() => {
              const cats = currentRound?.categories || [];
              const maxClues = Math.max(...cats.map((c) => c.clues.length), 5);
              const numCats = cats.length || 5;

              return (
                <div
                  className="flex-1 grid gap-2 md:gap-2.5 min-h-0"
                  style={{
                    gridTemplateRows: `repeat(${maxClues}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: maxClues }, (_, i) => i).map(
                    (clueIdx) => (
                      <div
                        key={clueIdx}
                        className="grid gap-2 md:gap-3 min-h-0 h-full"
                        style={{
                          gridTemplateColumns: `repeat(${numCats}, minmax(0, 1fr))`,
                        }}
                      >
                        {cats.map((category) => {
                          const clue = category.clues[clueIdx];
                          if (!clue) {
                            return (
                              <div
                                key={`${category.id}-${clueIdx}`}
                                className="bg-transparent"
                              />
                            );
                          }

                          const isCompleted = clue.state === 'completed';

                          if (isCompleted) {
                            return (
                              <div
                                key={clue.id}
                                className={
                                  'rounded-xl flex items-center ' +
                                  'justify-center p-1 select-none ' +
                                  'transition-all duration-300 ' +
                                  'bg-[#030718]/90 border ' +
                                  'border-slate-800/80 shadow-inner ' +
                                  'min-h-0 h-full'
                                }
                              >
                                <span
                                  className={
                                    'text-lg sm:text-xl md:text-2xl ' +
                                    'lg:text-3xl font-bold font-display ' +
                                    'text-slate-600/40 line-through ' +
                                    'decoration-slate-600/50 truncate'
                                  }
                                >
                                  ${clue.points}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={clue.id}
                              className={
                                'rounded-xl flex items-center ' +
                                'justify-center transition-all duration-300 ' +
                                'select-none relative overflow-hidden ' +
                                'bg-gradient-to-b from-[#08206b] ' +
                                'to-[#05133d] border border-blue-400/30 ' +
                                'shadow-[inset_0_1px_1px_' +
                                'rgba(255,255,255,0.18)] ' +
                                'shadow-md min-h-0 h-full p-1 cursor-default'
                              }
                            >
                              <span
                                className={
                                  'text-xl sm:text-2xl md:text-3xl ' +
                                  'lg:text-4xl font-black tracking-tight ' +
                                  'text-modern-gold font-display truncate'
                                }
                              >
                                ${clue.points}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </main>

      {/* Team Scoreboard HUD (hidden on game over podium view) */}
      {!winnerState.isGameOver && (
        <footer
          className={
            'relative z-10 w-full bg-[#060e24]/90 border-t ' +
            'border-blue-900/60 px-4 md:px-6 py-2.5 sm:py-3 grid ' +
            'grid-cols-2 gap-4 shrink-0 shadow-lg backdrop-blur-sm'
          }
        >
          {/* Team 1 Score Card */}
          {(() => {
            const t1 = getTeamCardProps(1);
            return (
              <div
                className={
                  'px-5 py-3 md:py-3.5 rounded-xl transition-all ' +
                  'duration-300 flex items-center justify-between ' +
                  t1.borderClass
                }
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={
                        'text-[10px] uppercase font-bold tracking-widest ' +
                        'text-slate-400 font-display'
                      }
                    >
                      Team 1
                    </span>
                    {t1.badge}
                  </div>
                  <span
                    className={
                      'text-base md:text-xl font-black uppercase ' +
                      'tracking-wider text-white font-display truncate ' +
                      'max-w-[180px] md:max-w-xs'
                    }
                  >
                    {config.team1Name}
                  </span>
                </div>
                <TabularScore
                  score={t1DisplayScore}
                  isAnimating={t1Animating}
                />
              </div>
            );
          })()}

          {/* Team 2 Score Card */}
          {(() => {
            const t2 = getTeamCardProps(2);
            return (
              <div
                className={
                  'px-5 py-3 md:py-3.5 rounded-xl transition-all ' +
                  'duration-300 flex items-center justify-between ' +
                  t2.borderClass
                }
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={
                        'text-[10px] uppercase font-bold tracking-widest ' +
                        'text-slate-400 font-display'
                      }
                    >
                      Team 2
                    </span>
                    {t2.badge}
                  </div>
                  <span
                    className={
                      'text-base md:text-xl font-black uppercase ' +
                      'tracking-wider text-white font-display truncate ' +
                      'max-w-[180px] md:max-w-xs'
                    }
                  >
                    {config.team2Name}
                  </span>
                </div>
                <TabularScore
                  score={t2DisplayScore}
                  isAnimating={t2Animating}
                />
              </div>
            );
          })()}
        </footer>
      )}
    </div>
  );
};

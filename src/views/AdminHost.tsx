import React, { useState, useEffect, useRef } from 'react';
import {
  GameState,
  GameAction,
  Clue,
  GameConfig,
  DEFAULT_PREFERENCES,
  createGameFromPreferences,
} from '../types/game';
import { defaultGame } from '../data/defaultGame';
import {
  Monitor,
  RotateCcw,
  Settings,
  Edit3,
  HelpCircle,
  Play,
  Pause,
  Eye,
  CheckCircle,
  XCircle,
  SkipForward,
  ExternalLink,
  Zap,
  Plus,
  FolderOpen,
  X,
  Sparkles,
  Clock,
  Trophy,
  CheckCircle2,
  QrCode,
  Smartphone,
} from 'lucide-react';
import { parseYouTubeUrl, formatSecondsToTime } from '../utils/youtube';
import { getWinnerState, formatTimerMmSs } from '../utils/gameRules';
import { tracer } from '../utils/tracer';
import { MobileConnectModal } from '../components/common/MobileConnectModal';
import { CompletedClueModal } from '../components/common/CompletedClueModal';

interface CreateGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (config: GameConfig) => void;
}

export const CreateGameModal: React.FC<CreateGameModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [team1Name, setTeam1Name] = useState('');
  const [team2Name, setTeam2Name] = useState('');
  const [numCategories, setNumCategories] = useState(
    DEFAULT_PREFERENCES.numCategories
  );
  const [numQuestionsPerCat, setNumQuestionsPerCat] = useState(
    DEFAULT_PREFERENCES.numQuestionsPerCategory
  );
  const [pointValues, setPointValues] = useState<number[]>([
    ...DEFAULT_PREFERENCES.cluePointValues,
  ]);
  const [customPointsInput, setCustomPointsInput] = useState(
    DEFAULT_PREFERENCES.cluePointValues.join(', ')
  );
  const [timerSeconds, setTimerSeconds] = useState<number | undefined>(
    120
  );
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => titleInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isFormValid = Boolean(
    title.trim() &&
    team1Name.trim() &&
    team2Name.trim() &&
    pointValues.length > 0
  );

  const handleApplyStepPreset = (step: number) => {
    const pts = Array.from(
      { length: numQuestionsPerCat },
      (_, i) => (i + 1) * step
    );
    setPointValues(pts);
    setCustomPointsInput(pts.join(', '));
  };

  const handleQuestionsPerCatChange = (qCount: number) => {
    setNumQuestionsPerCat(qCount);
    const step =
      pointValues.length > 1 ? pointValues[1] - pointValues[0] || 100 : 100;
    const start = pointValues[0] || step;
    const pts = Array.from({ length: qCount }, (_, i) => start + i * step);
    setPointValues(pts);
    setCustomPointsInput(pts.join(', '));
  };

  const handleCustomPointsChange = (val: string) => {
    setCustomPointsInput(val);
    const parsed = val
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
    if (parsed.length > 0) {
      setPointValues(parsed);
    }
  };

  const submit = () => {
    if (!isFormValid) return;
    const config = createGameFromPreferences({
      title: title.trim(),
      team1Name: team1Name.trim(),
      team2Name: team2Name.trim(),
      numCategories,
      numQuestionsPerCategory: numQuestionsPerCat,
      cluePointValues:
        pointValues.length > 0
          ? pointValues
          : DEFAULT_PREFERENCES.cluePointValues,
      includeFinalJeopardy: false,
      questionTimerSeconds: timerSeconds,
    });
    onCreate(config);
  };

  return (
    <div
      className={
        'fixed inset-0 z-50 flex items-center justify-center ' +
        'bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto'
      }
    >
      <div
        className={
          'bg-[#0b162c] border border-blue-800 rounded-2xl w-full ' +
          'max-w-2xl overflow-hidden shadow-2xl my-auto'
        }
      >
        <div
          className={
            'flex items-center justify-between px-4 sm:px-6 py-3 ' +
            'sm:py-4 border-b border-blue-900/60 bg-[#070e1c]'
          }
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <h2
              className={
                'text-base sm:text-lg font-black uppercase ' +
                'tracking-wider text-yellow-400'
              }
            >
              Create New Game
            </h2>
          </div>
          <button
            onClick={onClose}
            className={
              'p-1.5 rounded-lg text-gray-400 hover:text-white ' +
              'hover:bg-gray-800 transition-all'
            }
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          className={
            'p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[75vh] ' +
            'overflow-y-auto'
          }
        >
          {/* Game Title */}
          <div>
            <label className="text-xs font-bold uppercase text-gray-300 block mb-1.5">
              Game Title <span className="text-amber-400">*</span>
            </label>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 bg-black/50 border border-blue-800 rounded-xl text-white font-bold text-sm focus:border-yellow-400 focus:outline-none"
            />
          </div>

          {/* Teams */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase text-blue-300 block mb-1.5">
                Team 1 Name <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={team1Name}
                onChange={(e) => setTeam1Name(e.target.value)}
                className="w-full px-3.5 py-2 bg-black/50 border border-blue-800 rounded-xl text-white font-bold text-sm focus:border-yellow-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-emerald-300 block mb-1.5">
                Team 2 Name <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={team2Name}
                onChange={(e) => setTeam2Name(e.target.value)}
                className="w-full px-3.5 py-2 bg-black/50 border border-blue-800 rounded-xl text-white font-bold text-sm focus:border-yellow-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Categories & Questions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase text-gray-300">
                  Number of Categories
                </label>
                <span className="text-[11px] text-yellow-400 font-bold">
                  {numCategories} Categories
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {[3, 4, 5, 6, 7].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNumCategories(c)}
                    className={`py-2 text-xs font-black rounded-lg border transition-all ${
                      numCategories === c
                        ? 'bg-blue-600 border-blue-400 text-white shadow'
                        : 'bg-black/40 border-blue-900 text-gray-400 hover:text-white'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase text-gray-300">
                  Questions Per Category
                </label>
                <span className="text-[11px] text-yellow-400 font-bold">
                  {numQuestionsPerCat} Questions
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {[3, 4, 5, 6, 7, 8].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleQuestionsPerCatChange(q)}
                    className={`py-2 text-xs font-black rounded-lg border transition-all ${
                      numQuestionsPerCat === q
                        ? 'bg-blue-600 border-blue-400 text-white shadow'
                        : 'bg-black/40 border-blue-900 text-gray-400 hover:text-white'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Question Points */}
          <div>
            <div className="mb-1.5">
              <label className="text-xs font-bold uppercase text-gray-300">
                Question Points
              </label>
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                onClick={() => handleApplyStepPreset(100)}
                className="px-2.5 py-1 text-xs font-bold rounded bg-blue-950 hover:bg-blue-900 border border-blue-700 text-yellow-300"
              >
                +$100 Steps (Default)
              </button>
              <button
                type="button"
                onClick={() => handleApplyStepPreset(200)}
                className="px-2.5 py-1 text-xs font-bold rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300"
              >
                +$200 Steps
              </button>
              <button
                type="button"
                onClick={() => handleApplyStepPreset(50)}
                className="px-2.5 py-1 text-xs font-bold rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300"
              >
                +$50 Steps
              </button>
            </div>

            <input
              type="text"
              value={customPointsInput}
              onChange={(e) => handleCustomPointsChange(e.target.value)}
              className={
                'w-full px-3.5 py-2 bg-black/50 border border-blue-800 ' +
                'rounded-xl text-yellow-400 font-mono font-bold text-sm ' +
                'focus:border-yellow-400 focus:outline-none'
              }
            />
          </div>

          {/* Question Countdown Timer */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase text-gray-300">
                Question Countdown Timer
              </label>
              <span className="text-[11px] text-yellow-400 font-bold">
                {timerSeconds
                  ? `${formatTimerMmSs(timerSeconds)} per question`
                  : 'Disabled'}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              <button
                type="button"
                onClick={() => setTimerSeconds(undefined)}
                className={
                  'px-2.5 py-1 text-xs font-bold rounded border ' +
                  'transition-all ' +
                  (!timerSeconds
                    ? 'bg-blue-950 border-blue-700 text-yellow-300'
                    : 'bg-gray-800 border-gray-700 text-gray-300 ' +
                      'hover:bg-gray-700')
                }
              >
                Off
              </button>
              {[
                { label: '30s', sec: 30 },
                { label: '1m', sec: 60 },
                { label: '2m (Default)', sec: 120 },
                { label: '3m', sec: 180 },
              ].map(({ label, sec }) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setTimerSeconds(sec)}
                  className={
                    'px-2.5 py-1 text-xs font-bold rounded border ' +
                    'transition-all ' +
                    (timerSeconds === sec
                      ? 'bg-blue-950 border-blue-700 text-yellow-300'
                      : 'bg-gray-800 border-gray-700 text-gray-300 ' +
                        'hover:bg-gray-700')
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative flex items-center">
              <input
                type="number"
                min="0"
                placeholder="Off (no timer)"
                value={timerSeconds || ''}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setTimerSeconds(val > 0 ? val : undefined);
                }}
                className={
                  'w-full pl-3.5 pr-20 py-2 bg-black/50 border ' +
                  'border-blue-800 rounded-xl text-yellow-400 font-mono ' +
                  'font-bold text-sm focus:border-yellow-400 ' +
                  'focus:outline-none'
                }
              />
              <span
                className={
                  'absolute right-3.5 text-xs text-gray-400 font-bold ' +
                  'uppercase pointer-events-none'
                }
              >
                seconds
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-blue-900/60 bg-[#070e1c]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!isFormValid}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              isFormValid
                ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg hover:shadow-yellow-500/20 active:scale-95 cursor-pointer'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Create</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface InspectingCompletedClue {
  roundIndex: number;
  categoryIndex: number;
  clueIndex: number;
  clue: Clue;
}

interface AdminHostProps {
  state: GameState;
  dispatch: (action: GameAction) => void;
  openDisplayWindow: () => void;
  onOpenBuilder: () => void;
  openGameFile?: () => Promise<GameConfig | null>;
  toMediaUrl?: (path: string) => string;
  onGameCreated?: () => void;
}

export const AdminHost: React.FC<AdminHostProps> = ({
  state,
  dispatch,
  openDisplayWindow,
  onOpenBuilder,
  openGameFile,
  toMediaUrl,
  onGameCreated,
}) => {
  const {
    config,
    currentRoundIndex,
    team1Score,
    team2Score,
    activeClue,
    controllingTeam,
  } = state;

  // Local modals
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMobileConnectModal, setShowMobileConnectModal] = useState(false);
  const [inspectingCompletedClue, setInspectingCompletedClue] =
    useState<InspectingCompletedClue | null>(null);
  const [tempTeam1Score, setTempTeam1Score] = useState(team1Score);
  const [tempTeam2Score, setTempTeam2Score] = useState(team2Score);

  const scoreInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showScoreModal) {
      const timer = setTimeout(() => scoreInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [showScoreModal]);

  const [hostTimerNow, setHostTimerNow] = useState(() => Date.now());

  useEffect(() => {
    if (!config?.questionTimerSeconds || !activeClue?.timerStartedAt) return;
    setHostTimerNow(Date.now());
    const interval = setInterval(() => setHostTimerNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [config?.questionTimerSeconds, activeClue?.timerStartedAt]);

  const hostTimerRemaining = config?.questionTimerSeconds
    ? activeClue?.timerStartedAt
      ? Math.max(
          0,
          config.questionTimerSeconds -
            Math.max(
              0,
              Math.floor((hostTimerNow - activeClue.timerStartedAt) / 1000)
            )
        )
      : config.questionTimerSeconds
    : 0;

  const handleLoadGameFile = async () => {
    if (openGameFile) {
      const loaded = await openGameFile();
      if (loaded) {
        dispatch({ type: 'LOAD_GAME', payload: loaded });
      }
    }
  };

  // Final jeopardy local wager inputs
  const [t1Wager, setT1Wager] = useState(
    config?.finalJeopardy?.team1Wager ?? 0
  );
  const [t2Wager, setT2Wager] = useState(
    config?.finalJeopardy?.team2Wager ?? 0
  );
  const [t1Correct, setT1Correct] = useState(true);
  const [t2Correct, setT2Correct] = useState(true);

  const isFinalJeopardy = currentRoundIndex === -1 && !!config?.finalJeopardy;
  const winnerState = getWinnerState(state);
  const wagerInputRef = useRef<HTMLInputElement>(null);
  const prevIsFinalJeopardyRef = useRef(false);

  useEffect(() => {
    if (isFinalJeopardy && !prevIsFinalJeopardyRef.current) {
      const timer = setTimeout(() => wagerInputRef.current?.focus(), 50);
      prevIsFinalJeopardyRef.current = true;
      return () => clearTimeout(timer);
    }
    prevIsFinalJeopardyRef.current = isFinalJeopardy;
  }, [isFinalJeopardy]);

  if (!config) {
    return (
      <div
        className={
          'min-h-screen stage-ambient ambient-grid text-gray-100 ' +
          'flex items-center justify-center p-6 md:p-12 font-sans ' +
          'select-none relative overflow-hidden'
        }
      >
        {/* Top Window Drag Strip */}
        <div
          className={
            'absolute top-0 left-0 right-0 h-11 titlebar-drag z-30 ' +
            'pointer-events-auto'
          }
        />
        <div
          className={
            'absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 ' +
            'w-[700px] h-[350px] bg-blue-600/20 rounded-full blur-[140px] ' +
            'pointer-events-none'
          }
        />
        <div
          className={
            'absolute bottom-10 left-1/2 -translate-x-1/2 w-[500px] ' +
            'h-[200px] bg-amber-500/10 rounded-full blur-[120px] ' +
            'pointer-events-none'
          }
        />

        <div
          className={
            'w-full max-w-xl bg-[#0b162c]/90 backdrop-blur-md border ' +
            'border-blue-900/60 rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl ' +
            'flex flex-col items-center text-center relative z-10 ' +
            'overflow-hidden space-y-4 sm:space-y-6'
          }
        >
          <div className="flex flex-col items-center space-y-3">
            <img
              src="./logo.svg"
              alt="JeoPARTY!"
              className={
                'w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 ' +
                'object-contain drop-shadow-2xl'
              }
            />
            <p
              className={
                'text-xs uppercase tracking-widest ' +
                'text-blue-300/80 font-bold'
              }
            >
              Trivia, Team Fights &amp; Petty Rivalries
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full pt-2">
            {/* Option 1: Create New Game */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="group p-5 rounded-2xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-800/60 hover:border-yellow-400/60 transition-all flex items-center gap-4 text-left shadow-lg active:scale-95 cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0 group-hover:bg-yellow-500/20 group-hover:border-yellow-400/50 transition-all">
                <Plus className="w-5 h-5 text-yellow-400" />
              </div>
              <span className="text-sm font-bold text-white group-hover:text-yellow-300 transition-colors">
                Create New Game
              </span>
            </button>

            {/* Option 2: Load Game File */}
            <button
              onClick={handleLoadGameFile}
              className="group p-5 rounded-2xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-800/60 hover:border-blue-400/60 transition-all flex items-center gap-4 text-left shadow-lg active:scale-95 cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 group-hover:border-blue-400/50 transition-all">
                <FolderOpen className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-sm font-bold text-white group-hover:text-blue-300 transition-colors">
                Load Game File
              </span>
            </button>
          </div>

          {/* Quick Demo & Mobile Connect */}
          <div
            className={'pt-2 flex items-center justify-center gap-4 flex-wrap'}
          >
            <button
              onClick={() => {
                if (onGameCreated) onGameCreated();
                dispatch({ type: 'LOAD_GAME', payload: defaultGame });
              }}
              className={
                'text-xs text-gray-400 hover:text-yellow-400 ' +
                'transition-colors underline-offset-4 hover:underline ' +
                'cursor-pointer'
              }
            >
              Load Sample Game
            </button>
            <span className="text-gray-600 text-xs">•</span>
            <button
              onClick={() => setShowMobileConnectModal(true)}
              className={
                'text-xs text-gray-400 hover:text-blue-300 ' +
                'transition-colors flex items-center gap-1.5 cursor-pointer'
              }
              title="Connect mobile phone as host controller"
            >
              <QrCode className="w-3.5 h-3.5 text-blue-400" />
              <span>Connect Phone</span>
            </button>
          </div>
        </div>

        <CreateGameModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={(newConfig) => {
            if (onGameCreated) onGameCreated();
            dispatch({ type: 'LOAD_GAME', payload: newConfig });
            setShowCreateModal(false);
            onOpenBuilder();
          }}
        />

        <MobileConnectModal
          isOpen={showMobileConnectModal}
          onClose={() => setShowMobileConnectModal(false)}
        />
      </div>
    );
  }

  const currentRound = config.rounds[currentRoundIndex] || config.rounds[0];

  // Selected clue for control panel
  const activeClueData = activeClue
    ? config.rounds[activeClue.roundIndex]?.categories[activeClue.categoryIndex]
        ?.clues[activeClue.clueIndex]
    : null;

  // Open clue handler
  const handleSelectClue = (
    roundIndex: number,
    categoryIndex: number,
    clueIndex: number,
    clue: Clue
  ) => {
    if (clue.state === 'completed') {
      tracer.recordUiEvent('Inspected completed clue', {
        roundIndex,
        categoryIndex,
        clueIndex,
        points: clue.points,
      });
      setInspectingCompletedClue({
        roundIndex,
        categoryIndex,
        clueIndex,
        clue,
      });
      return;
    }
    tracer.recordUiEvent('Selected clue', {
      roundIndex,
      categoryIndex,
      clueIndex,
      points: clue.points,
      firstAnsweringTeam: controllingTeam,
    });
    dispatch({
      type: 'SELECT_CLUE',
      payload: {
        roundIndex,
        categoryIndex,
        clueIndex,
        firstAnsweringTeam: controllingTeam,
      },
    });
  };

  const handleScoreSave = () => {
    tracer.recordUiEvent('Saved score override', {
      team1: tempTeam1Score,
      team2: tempTeam2Score,
    });
    dispatch({
      type: 'OVERRIDE_SCORES',
      payload: {
        team1Score: Number(tempTeam1Score) || 0,
        team2Score: Number(tempTeam2Score) || 0,
      },
    });
    setShowScoreModal(false);
  };

  return (
    <div
      className={
        'h-screen h-[100dvh] max-h-screen max-h-[100dvh] bg-[#030712] ' +
        'text-slate-100 flex flex-col font-sans select-none overflow-hidden'
      }
    >
      {/* HOST TOP NAV BAR */}
      <header
        className={
          'bg-[#0b1426] border-b border-blue-900/60 px-3 sm:px-6 py-2.5 ' +
          'sm:py-3 flex flex-wrap items-center justify-between gap-2 ' +
          'sm:gap-4 shrink-0 shadow-md titlebar-drag titlebar-pad'
        }
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <img
            src="./logo.svg"
            alt="JeoPARTY!"
            className="w-7 h-7 sm:w-8 sm:h-8 object-contain shrink-0"
          />
          <h1
            className={
              'text-base sm:text-lg font-black uppercase tracking-wider ' +
              'text-yellow-400 shrink-0'
            }
          >
            Host Console
          </h1>
          <span
            className={
              'text-[10px] sm:text-xs px-2 sm:px-2.5 py-0.5 sm:py-1 rounded ' +
              'bg-blue-950 text-blue-300 font-semibold border ' +
              'border-blue-800 truncate max-w-[110px] sm:max-w-[200px]'
            }
            title={config.title}
          >
            {config.title}
          </span>
        </div>

        {/* Navigation Tabs (Shown when Final Jeopardy Tie-Breaker exists) */}
        {config.finalJeopardy && (
          <div
            className={
              'flex items-center gap-1 bg-[#050a14] p-1 rounded-xl ' +
              'border border-blue-900/50'
            }
          >
            <button
              onClick={() =>
                dispatch({ type: 'SET_ROUND', payload: { roundIndex: 0 } })
              }
              className={
                'px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg ' +
                'text-xs font-bold transition-all shrink-0 ' +
                (currentRoundIndex === 0
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-400 hover:text-white')
              }
            >
              Main Board
            </button>
            <button
              onClick={() =>
                dispatch({ type: 'SET_ROUND', payload: { roundIndex: -1 } })
              }
              className={
                'px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg ' +
                'text-xs font-bold transition-all shrink-0 ' +
                (isFinalJeopardy
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-gray-400 hover:text-white')
              }
              title="Tie-Breaker Question"
            >
              Tie-Breaker Question
            </button>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Display Window Launcher */}
          <button
            onClick={() => {
              if (state.displayWindowOpen) return;
              openDisplayWindow();
            }}
            disabled={state.displayWindowOpen}
            className={
              'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 ' +
              'rounded-lg text-xs font-bold shadow transition-all ' +
              (state.displayWindowOpen
                ? 'bg-emerald-950/70 border border-emerald-500/50 ' +
                  'text-emerald-300 cursor-default opacity-85'
                : 'bg-blue-700/80 hover:bg-blue-600 text-white ' +
                  'cursor-pointer active:scale-95')
            }
            title={
              state.displayWindowOpen
                ? 'Player presentation board is already open'
                : 'Open player presentation window'
            }
          >
            <Monitor
              className={`w-4 h-4 shrink-0 ${
                state.displayWindowOpen ? 'text-emerald-400' : 'text-yellow-300'
              }`}
            />
            <span className="hidden sm:inline">Player Board</span>
            {state.displayWindowOpen && (
              <span
                className={
                  'w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0'
                }
              />
            )}
          </button>

          {/* Mobile Host Pairing */}
          <button
            onClick={() => setShowMobileConnectModal(true)}
            className={
              'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 ' +
              'bg-blue-950/60 hover:bg-blue-900/80 border border-blue-700/60 ' +
              'hover:border-yellow-400/60 text-blue-200 hover:text-white ' +
              'rounded-lg text-xs font-bold transition-all cursor-pointer ' +
              'active:scale-95'
            }
            title="Scan QR code to host from your phone"
          >
            <QrCode className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span className="hidden sm:inline">Connect Phone</span>
          </button>

          {/* Score Override */}
          <button
            onClick={() => {
              setTempTeam1Score(team1Score);
              setTempTeam2Score(team2Score);
              setShowScoreModal(true);
            }}
            className={
              'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-gray-800 ' +
              'hover:bg-gray-700 text-yellow-400 rounded-lg text-xs ' +
              'font-bold transition-all'
            }
            title="Edit Scores"
          >
            <Edit3 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Edit Scores</span>
          </button>

          {/* Game Builder / Settings */}
          <button
            onClick={onOpenBuilder}
            className={
              'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 ' +
              'bg-indigo-900/60 hover:bg-indigo-800 border ' +
              'border-indigo-700/60 text-indigo-200 rounded-lg text-xs ' +
              'font-bold transition-all'
            }
            title="Game Builder"
          >
            <Settings className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Game Builder</span>
          </button>

          {/* Close Game */}
          <button
            onClick={() => {
              if (
                window.confirm(
                  'Close this game and return to the main setup screen? ' +
                    'All unsaved changes will be lost.'
                )
              ) {
                dispatch({ type: 'UNLOAD_GAME' });
              }
            }}
            className={
              'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 ' +
              'bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 ' +
              'text-rose-300 rounded-lg text-xs font-bold transition-all'
            }
            title="Close this game and return to setup"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" strokeWidth={2.5} />
            <span className="hidden sm:inline">Close Game</span>
          </button>
        </div>
      </header>

      {/* TEAM STATUS & CONTROL BAR */}
      <section
        className={
          'bg-[#091124] border-b border-blue-900/40 px-3 sm:px-6 ' +
          'py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 ' +
          'shrink-0'
        }
      >
        <div className="flex items-center gap-2 sm:gap-6 flex-wrap">
          <span className="text-xs uppercase font-bold text-gray-400 shrink-0">
            Board Turn:
          </span>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={() =>
                dispatch({ type: 'SET_CONTROLLING_TEAM', payload: { team: 1 } })
              }
              className={
                'px-2.5 sm:px-3 py-1 rounded-lg text-xs font-extrabold ' +
                'flex items-center gap-1.5 sm:gap-2 border transition-all ' +
                (controllingTeam === 1
                  ? 'bg-blue-600 border-yellow-400 text-white shadow-md ' +
                    'ring-2 ring-yellow-400/40'
                  : 'bg-black/30 border-blue-900/60 text-gray-400 ' +
                    'hover:text-white')
              }
              title="Click to give turn to Team 1"
            >
              <span className="truncate max-w-[85px] sm:max-w-none">
                {config.team1Name}
              </span>
              {controllingTeam === 1 && (
                <span
                  className={
                    'px-1.5 py-0.5 rounded bg-yellow-400 text-black ' +
                    'text-[9px] font-black uppercase tracking-wider shrink-0'
                  }
                >
                  Active Turn
                </span>
              )}
              <span className="text-yellow-300 font-mono shrink-0">
                ${team1Score}
              </span>
            </button>
            <button
              onClick={() =>
                dispatch({ type: 'SET_CONTROLLING_TEAM', payload: { team: 2 } })
              }
              className={
                'px-2.5 sm:px-3 py-1 rounded-lg text-xs font-extrabold ' +
                'flex items-center gap-1.5 sm:gap-2 border transition-all ' +
                (controllingTeam === 2
                  ? 'bg-blue-600 border-yellow-400 text-white shadow-md ' +
                    'ring-2 ring-yellow-400/40'
                  : 'bg-black/30 border-blue-900/60 text-gray-400 ' +
                    'hover:text-white')
              }
              title="Click to give turn to Team 2"
            >
              <span className="truncate max-w-[85px] sm:max-w-none">
                {config.team2Name}
              </span>
              {controllingTeam === 2 && (
                <span
                  className={
                    'px-1.5 py-0.5 rounded bg-yellow-400 text-black ' +
                    'text-[9px] font-black uppercase tracking-wider shrink-0'
                  }
                >
                  Active Turn
                </span>
              )}
              <span className="text-yellow-300 font-mono shrink-0">
                ${team2Score}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={() => setShowMobileConnectModal(true)}
            className={
              'hidden sm:flex items-center gap-1.5 px-2.5 py-1 ' +
              'bg-blue-900/40 hover:bg-blue-800/60 border ' +
              'border-blue-600/50 hover:border-yellow-400 text-blue-200 ' +
              'hover:text-white rounded-lg text-xs font-bold ' +
              'transition-all cursor-pointer active:scale-95'
            }
            title="Scan QR code to connect your phone as host controller"
          >
            <Smartphone className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span>Connect Phone</span>
          </button>

          <div
            className={
              'text-[11px] sm:text-xs text-gray-400 flex items-center ' +
              'gap-1 sm:gap-2 shrink-0'
            }
          >
            <span>Hint penalty:</span>
            <span className="font-bold text-yellow-400">
              -${config.defaultHintDeduction} pts
            </span>
          </div>
        </div>
      </section>

      {/* HOST BOARD VIEW */}
      <main
        className={
          'flex-1 p-2 sm:p-4 md:p-5 overflow-hidden min-h-0 ' +
          'flex flex-col'
        }
      >
        {/* Game Completed Banner */}
        {winnerState.isGameOver && (
          <div
            className={
              'mb-3 sm:mb-4 p-3 sm:p-4 rounded-xl bg-amber-950/40 ' +
              'border border-amber-500/50 flex flex-wrap items-center ' +
              'justify-between gap-3 sm:gap-4 shadow-lg shrink-0'
            }
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/20 text-yellow-400">
                <Trophy className="w-5 h-5" />
              </div>
              <div>
                <span
                  className={
                    'text-xs font-bold uppercase tracking-widest ' +
                    'text-amber-300 block'
                  }
                >
                  Game Completed
                </span>
                <span className="text-lg font-black text-white font-display">
                  {winnerState.winner === 'tie'
                    ? `Co-Winners: Both Teams Tied ` +
                      `($${team1Score} - $${team2Score})`
                    : `Winner: ${winnerState.winningTeamName} ` +
                      `($${Math.max(team1Score, team2Score)} vs ` +
                      `$${Math.min(team1Score, team2Score)})`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!state.displayWindowOpen && (
                <button
                  onClick={openDisplayWindow}
                  className={
                    'px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 ' +
                    'text-black text-xs font-bold rounded-lg shadow ' +
                    'transition-colors flex items-center gap-1.5'
                  }
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Open Player Board</span>
                </button>
              )}
              <span
                className={
                  'text-xs font-semibold text-amber-200/80 bg-amber-950/80 ' +
                  'px-3 py-1.5 rounded-md border border-amber-800/60'
                }
              >
                Winner screen active on player display
              </span>
            </div>
          </div>
        )}

        {/* Regulation Tied Decision Banner */}
        {winnerState.canProceedToTieBreaker && (
          <div
            className={
              'mb-3 sm:mb-4 p-3 sm:p-4 rounded-xl bg-blue-950/60 ' +
              'border border-blue-400/50 flex flex-wrap items-center ' +
              'justify-between gap-3 sm:gap-4 shadow-lg shrink-0'
            }
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/20 text-yellow-400">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <span
                  className={
                    'text-xs font-bold uppercase tracking-widest ' +
                    'text-blue-300 block'
                  }
                >
                  Regulation Tied (${team1Score} each)
                </span>
                <span className="text-sm font-semibold text-slate-200">
                  Select tie-breaker action:
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  tracer.recordUiEvent('Clicked Start Tie-Breaker');
                  dispatch({ type: 'SET_ROUND', payload: { roundIndex: -1 } });
                }}
                className={
                  'px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white ' +
                  'text-xs font-bold rounded-lg shadow transition-colors ' +
                  'flex items-center gap-1.5'
                }
              >
                <Sparkles className="w-4 h-4" />
                <span>Start Tie-Breaker</span>
              </button>
              <button
                onClick={() => {
                  tracer.recordUiEvent(
                    'Clicked Declare Co-Winners (Regulation)',
                    { team1Score, team2Score, winnerState }
                  );
                  dispatch({ type: 'DECLARE_CO_WINNERS' });
                }}
                className={
                  'px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 ' +
                  'text-white text-xs font-bold rounded-lg shadow ' +
                  'transition-colors flex items-center gap-1.5'
                }
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Declare Co-Winners</span>
              </button>
            </div>
          </div>
        )}

        {isFinalJeopardy ? (
          /* FINAL JEOPARDY CONTROLLER */
          <div
            className={
              'flex-1 min-h-0 overflow-y-auto ' +
              'overscroll-contain'
            }
          >
            <div
              className={
                'max-w-4xl mx-auto bg-[#0a152e] ' +
                'border-2 border-amber-500/60 ' +
                'rounded-2xl p-4 sm:p-6 shadow-2xl ' +
                'space-y-4 sm:space-y-6'
              }
            >
            <div
              className={
                'flex flex-wrap items-center justify-between gap-3 ' +
                'border-b border-blue-900/60 pb-3'
              }
            >
              <div>
                <span
                  className={
                    'text-xs uppercase tracking-widest text-amber-400 ' +
                    'font-black'
                  }
                >
                  Tie-Breaker Question
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                  Category: {config.finalJeopardy?.category}
                </h2>
              </div>
              {team1Score === team2Score &&
                !config.finalJeopardy?.answersRevealed && (
                  <button
                    onClick={() => {
                      tracer.recordUiEvent(
                        'Clicked Declare Co-Winners (Tie-Breaker)',
                        { team1Score, team2Score }
                      );
                      dispatch({ type: 'DECLARE_CO_WINNERS' });
                    }}
                    className={
                      'px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 ' +
                      'text-white text-xs font-bold rounded-lg shadow ' +
                      'transition-colors flex items-center gap-1.5'
                    }
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Declare Co-Winners</span>
                  </button>
                )}
            </div>

            {/* Question & Answer Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-black/40 rounded-xl border border-blue-900/60">
                <span className="text-xs font-bold text-blue-400 uppercase block mb-1">
                  Question
                </span>
                <p className="text-base font-medium text-gray-200">
                  {config.finalJeopardy?.question}
                </p>
              </div>
              <div className="p-4 bg-emerald-950/40 rounded-xl border border-emerald-700/50">
                <span className="text-xs font-bold text-emerald-400 uppercase block mb-1">
                  Correct Answer
                </span>
                <p className="text-lg font-bold text-white">
                  {config.finalJeopardy?.answer}
                </p>
              </div>
            </div>

            {/* Step 1: Wagers */}
            <div
              className={
                'p-3 sm:p-4 bg-blue-950/40 rounded-xl border ' +
                'border-blue-900/60 space-y-3'
              }
            >
              <span className="text-sm font-bold text-yellow-400 uppercase block">
                Step 1: Record Offline Wagers
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="text-xs text-gray-300 block mb-1">
                    {config.team1Name} Wager (Max ${Math.max(1000, team1Score)})
                  </label>
                  <input
                    ref={wagerInputRef}
                    type="number"
                    value={t1Wager}
                    onChange={(e) => setT1Wager(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-black/60 border border-blue-800 rounded-lg text-white font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300 block mb-1">
                    {config.team2Name} Wager (Max ${Math.max(1000, team2Score)})
                  </label>
                  <input
                    type="number"
                    value={t2Wager}
                    onChange={(e) => setT2Wager(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-black/60 border border-blue-800 rounded-lg text-white font-mono text-sm"
                  />
                </div>
              </div>
              <button
                onClick={() => {
                  dispatch({
                    type: 'FJ_SET_WAGERS',
                    payload: { team1Wager: t1Wager, team2Wager: t2Wager },
                  });
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-xs"
              >
                Lock Wagers
              </button>
            </div>

            {/* Step 2: Reveal Question */}
            <div
              className={
                'p-3 sm:p-4 bg-blue-950/40 rounded-xl border ' +
                'border-blue-900/60 flex flex-wrap items-center ' +
                'justify-between gap-3'
              }
            >
              <div>
                <span className="text-sm font-bold text-yellow-400 uppercase block">
                  Step 2: Reveal Clue to Players
                </span>
                <span className="text-xs text-gray-400">
                  {config.finalJeopardy?.questionRevealed
                    ? 'Clue is visible on player board'
                    : 'Players will see category only until revealed'}
                </span>
              </div>
              <button
                onClick={() => dispatch({ type: 'FJ_REVEAL_QUESTION' })}
                disabled={config.finalJeopardy?.questionRevealed}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                <span>Reveal Clue</span>
              </button>
            </div>

            {/* Step 3: Judge Responses */}
            <div
              className={
                'p-3 sm:p-4 bg-blue-950/40 rounded-xl border ' +
                'border-blue-900/60 space-y-3 sm:space-y-4'
              }
            >
              <span className="text-sm font-bold text-yellow-400 uppercase block">
                Step 3: Judge Teams & Finalize Scores
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-blue-900/40">
                  <span className="text-sm font-semibold">
                    {config.team1Name}
                  </span>
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={t1Correct}
                      onChange={(e) => setT1Correct(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>
                      {t1Correct ? 'Correct (+wager)' : 'Wrong (-wager)'}
                    </span>
                  </label>
                </div>
                <div className="flex items-center justify-between p-3 bg-black/30 rounded-lg border border-blue-900/40">
                  <span className="text-sm font-semibold">
                    {config.team2Name}
                  </span>
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={t2Correct}
                      onChange={(e) => setT2Correct(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600"
                    />
                    <span>
                      {t2Correct ? 'Correct (+wager)' : 'Wrong (-wager)'}
                    </span>
                  </label>
                </div>
              </div>
              <button
                onClick={() => {
                  dispatch({
                    type: 'FJ_JUDGE',
                    payload: {
                      team1Correct: t1Correct,
                      team2Correct: t2Correct,
                    },
                  });
                }}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-wider rounded-lg text-xs shadow-lg"
              >
                Finalize
              </button>

              {config.finalJeopardy?.answersRevealed && (
                <div
                  className={
                    'mt-3 p-3 sm:p-3.5 bg-emerald-950/60 rounded-xl border ' +
                    'border-emerald-500/50 flex flex-wrap items-center ' +
                    'justify-between gap-3'
                  }
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <span
                        className={
                          'text-xs uppercase font-extrabold text-emerald-300 ' +
                          'block'
                        }
                      >
                        Tie-Breaker Complete
                      </span>
                      <span className="text-sm font-bold text-white">
                        {winnerState.winner === 'tie'
                          ? 'Result: Co-Winners'
                          : `Winner: ${winnerState.winningTeamName}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => dispatch({ type: 'FJ_RESET' })}
                      className={
                        'px-3 py-1.5 bg-gray-800 hover:bg-gray-700 ' +
                        'text-gray-300 rounded-lg text-xs font-bold ' +
                        'transition-all'
                      }
                    >
                      Reset Tie-Breaker
                    </button>
                    <button
                      onClick={() =>
                        dispatch({
                          type: 'SET_ROUND',
                          payload: { roundIndex: 0 },
                        })
                      }
                      className={
                        'px-3 py-1.5 bg-blue-600 hover:bg-blue-500 ' +
                        'text-white rounded-lg text-xs font-bold'
                      }
                    >
                      Return to Main Board
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>
        ) : (
          /* STANDARD GRID HOST VIEW */
          <div
            className={
              'overflow-auto pb-20 sm:pb-4 -mx-1 sm:mx-0 ' +
              'flex-1 min-h-0 touch-pan-x touch-pan-y ' +
              'overscroll-contain'
            }
          >
            <div
              className="grid gap-2 sm:gap-3"
              style={{
                gridTemplateColumns:
                  `repeat(${currentRound?.categories.length || 5}, ` +
                  'minmax(135px, 1fr))',
                minWidth: `${(currentRound?.categories.length || 5) * 140}px`,
              }}
            >
              {currentRound?.categories.map((category, catIdx) => (
                <div
                  key={category.id}
                  className="flex flex-col gap-2 sm:gap-3 flex-1 min-w-0"
                >
                  {/* Category Header */}
                  <div
                    className={
                      'h-14 sm:h-16 bg-[#0c2356] border border-blue-500/60 ' +
                      'rounded-lg p-2 text-center flex items-center ' +
                      'justify-center shadow-sm shrink-0 sticky top-0 z-10'
                    }
                  >
                    <span
                      className={
                        'text-xs font-black uppercase text-white ' +
                        'tracking-wider line-clamp-2'
                      }
                    >
                      {category.name}
                    </span>
                  </div>

                  {/* Clues */}
                  {category.clues.map((clue, clueIdx) => {
                    const isCompleted = clue.state === 'completed';
                    const isActive = clue.state === 'active';

                    return (
                      <div
                        key={clue.id}
                        onClick={() => {
                          handleSelectClue(
                            currentRoundIndex,
                            catIdx,
                            clueIdx,
                            clue
                          );
                        }}
                        className={
                          'flex-1 min-h-[85px] sm:min-h-[95px] ' +
                          'p-2 sm:p-2.5 rounded-lg border text-left ' +
                          'flex flex-col justify-between ' +
                          'transition-all group ' +
                          (isCompleted
                            ? 'bg-[#0a101f] border-slate-800/90 shadow-none ' +
                              'hover:border-slate-700/80 cursor-pointer'
                            : isActive
                              ? 'bg-[#17306b] border-2 border-yellow-400 ' +
                                'shadow-lg ring-2 ring-yellow-400/40 ' +
                                'cursor-pointer'
                              : 'bg-[#0e1f42] hover:bg-[#132752] ' +
                                'border-blue-700/60 hover:border-blue-400 ' +
                                'shadow-sm cursor-pointer')
                        }
                      >
                        <div
                          className={
                            'flex items-center justify-between w-full mb-1'
                          }
                        >
                          <span
                            className={`text-sm font-black font-mono ${
                              isCompleted
                                ? 'line-through text-slate-500'
                                : 'text-amber-400'
                            }`}
                          >
                            ${clue.points}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isCompleted && clue.result ? (
                              clue.result.winner === 1 ? (
                                <span
                                  className={
                                    'text-[10px] uppercase font-black px-1.5 ' +
                                    'py-0.5 rounded bg-blue-900/80 border ' +
                                    'border-blue-500/60 text-blue-200 ' +
                                    'whitespace-nowrap shrink-0'
                                  }
                                >
                                  {clue.result.type === 'full'
                                    ? 'T1'
                                    : 'T1 50%'}
                                </span>
                              ) : clue.result.winner === 2 ? (
                                <span
                                  className={
                                    'text-[10px] uppercase font-black px-1.5 ' +
                                    'py-0.5 rounded bg-emerald-900/80 border ' +
                                    'border-emerald-500/60 text-emerald-200 ' +
                                    'whitespace-nowrap shrink-0'
                                  }
                                >
                                  {clue.result.type === 'full'
                                    ? 'T2'
                                    : 'T2 50%'}
                                </span>
                              ) : (
                                <span
                                  className={
                                    'text-[10px] uppercase font-black px-1.5 ' +
                                    'py-0.5 rounded bg-slate-800 border ' +
                                    'border-slate-700 text-slate-400 ' +
                                    'whitespace-nowrap shrink-0'
                                  }
                                >
                                  0 pts
                                </span>
                              )
                            ) : isCompleted ? (
                              <span
                                className={
                                  'text-[10px] uppercase font-bold px-1.5 ' +
                                  'py-0.5 rounded bg-slate-800 border ' +
                                  'border-slate-700 text-slate-400 ' +
                                  'whitespace-nowrap shrink-0'
                                }
                              >
                                Done
                              </span>
                            ) : clue.media && clue.media.type !== 'none' ? (
                              <span
                                className={
                                  'text-[10px] uppercase font-bold px-1.5 ' +
                                  'py-0.5 rounded bg-blue-950 text-blue-300 ' +
                                  'border border-blue-800 whitespace-nowrap ' +
                                  'shrink-0'
                                }
                              >
                                {clue.media.type}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Question Sneak Peek for Host */}
                        <p
                          className={`text-xs leading-snug line-clamp-3 ${
                            isCompleted
                              ? 'text-slate-500'
                              : 'text-slate-100 font-medium'
                          }`}
                        >
                          {clue.question}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* CLUE CONTROL MODAL / DRAWER */}
      {activeClue && activeClueData && (
        <div
          className={
            'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex ' +
            'items-center justify-center p-3 sm:p-4 overflow-y-auto'
          }
        >
          <div
            className={
              'bg-[#0b1631] border border-gray-700 rounded-2xl max-w-3xl ' +
              'w-full p-4 sm:p-6 shadow-2xl space-y-3 sm:space-y-4 ' +
              'animate-scaleUp max-h-[90vh] max-h-[90dvh] overflow-y-auto ' +
              'my-auto'
            }
          >
            {/* Modal Header */}
            <div
              className={
                'flex items-center justify-between border-b ' +
                'border-gray-800 pb-3'
              }
            >
              <div>
                <span
                  className={
                    'text-xs uppercase font-black tracking-widest ' +
                    'text-gray-400'
                  }
                >
                  {currentRound?.categories[activeClue.categoryIndex]?.name}
                </span>
                <div className="flex items-center gap-2 sm:gap-3 mt-0.5">
                  <span
                    className={
                      'text-xl sm:text-2xl font-black text-yellow-400 ' +
                      'font-mono'
                    }
                  >
                    ${activeClue.currentAvailablePoints}
                  </span>
                  {activeClue.reboundOpportunity && (
                    <span
                      className={
                        'px-2 py-0.5 bg-amber-600/80 text-white text-xs ' +
                        'font-bold uppercase rounded'
                      }
                    >
                      Rebound 50%
                    </span>
                  )}
                  {Boolean(
                    config?.questionTimerSeconds &&
                      config.questionTimerSeconds > 0
                  ) && (
                    <span
                      className={
                        'flex items-center gap-1 px-2 py-0.5 rounded ' +
                        'text-xs font-mono font-bold ' +
                        (!activeClue.timerStartedAt
                          ? 'bg-blue-950/60 text-blue-300 ' +
                            'border border-blue-800'
                          : hostTimerRemaining === 0
                            ? 'bg-rose-950/60 text-rose-300 ' +
                              'border border-rose-800'
                            : hostTimerRemaining <= 5
                              ? 'bg-amber-950/60 text-amber-300 ' +
                                'border border-amber-800'
                              : 'bg-blue-950/80 text-yellow-400 ' +
                                'border border-blue-700')
                      }
                    >
                      <Clock className="w-3 h-3" />
                      {formatTimerMmSs(hostTimerRemaining)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Reset this question? Any pending scoring will ` +
                          `be canceled and the question will return to ` +
                          `unopened on the board.`
                      )
                    ) {
                      dispatch({
                        type: 'RESET_CLUE_BOX',
                        payload: {
                          roundIndex: activeClue.roundIndex,
                          categoryIndex: activeClue.categoryIndex,
                          clueIndex: activeClue.clueIndex,
                        },
                      });
                    }
                  }}
                  className={
                    'flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 ' +
                    'py-1.5 text-gray-500 hover:text-rose-400 text-xs ' +
                    'font-bold transition-colors'
                  }
                  title="Reset question to unopened"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>

                <button
                  onClick={() => dispatch({ type: 'CLOSE_CLUE' })}
                  className={
                    'flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 ' +
                    'py-1.5 text-gray-500 hover:text-white text-xs ' +
                    'font-bold transition-colors'
                  }
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Close</span>
                </button>
              </div>
            </div>

            {/* Question Display */}
            <div className="p-4 bg-black/30 border border-gray-800 rounded-xl">
              <span className="text-xs uppercase font-bold text-gray-500 block mb-1">
                Question
              </span>
              <p className="text-lg font-serif font-bold text-white">
                {activeClueData.question}
              </p>
            </div>

            {/* Host Answer Preview Box */}
            <div className="p-4 bg-black/30 border border-gray-800 rounded-xl">
              <span className="text-xs uppercase font-bold text-emerald-500 block mb-0.5">
                Answer
              </span>
              <p className="text-xl font-bold text-white">
                {activeClueData.answer}
              </p>
            </div>

            {/* Media & Hint — compact inline rows, only shown when present */}
            <div className="space-y-3">
              {/* Media Controls */}
              {activeClueData.media && activeClueData.media.type !== 'none' && (
                <div
                  className={
                    'flex flex-wrap sm:flex-nowrap items-center gap-2 ' +
                    'sm:gap-3 p-2.5 sm:p-3 bg-black/30 border ' +
                    'border-gray-800 rounded-xl'
                  }
                >
                  {/* Image thumbnail */}
                  {activeClueData.media.type === 'image' && (
                    <img
                      src={
                        toMediaUrl
                          ? toMediaUrl(activeClueData.media.urlOrPath)
                          : activeClueData.media.urlOrPath.startsWith('/')
                            ? activeClueData.media.urlOrPath
                            : `/${activeClueData.media.urlOrPath}`
                      }
                      alt="Preview"
                      className="w-12 h-12 object-contain bg-black/70 rounded-md border border-white/10 shrink-0"
                    />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-bold text-gray-400 uppercase">
                      {activeClueData.media.type}
                    </span>
                    <span className="text-[11px] text-gray-500 truncate block">
                      {activeClueData.media.urlOrPath}
                    </span>
                    {/* YouTube timestamp badge */}
                    {activeClueData.media.type === 'youtube' &&
                      (() => {
                        const yt = parseYouTubeUrl(
                          activeClueData.media.urlOrPath
                        );
                        return yt.startTimestampSeconds !== null &&
                          yt.startTimestampSeconds > 0 ? (
                          <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {formatSecondsToTime(yt.startTimestampSeconds)}
                          </span>
                        ) : null;
                      })()}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Open URL for YouTube */}
                    {activeClueData.media.type === 'youtube' && (
                      <a
                        href={activeClueData.media.urlOrPath}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-gray-400 hover:text-white transition-colors"
                        title="Open in browser"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {!activeClue.mediaRevealed ? (
                      <button
                        onClick={() => dispatch({ type: 'REVEAL_MEDIA' })}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>
                          {activeClueData.media.type === 'image'
                            ? 'Show'
                            : 'Play'}
                        </span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => dispatch({ type: 'HIDE_MEDIA' })}
                          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-xs font-bold transition-all"
                        >
                          {activeClueData.media.type === 'image'
                            ? 'Hide'
                            : 'Stop'}
                        </button>

                        {(activeClueData.media.type === 'audio' ||
                          activeClueData.media.type === 'video') && (
                          <button
                            onClick={() =>
                              dispatch({
                                type: 'SET_MEDIA_PLAYING',
                                payload: { playing: !activeClue.mediaPlaying },
                              })
                            }
                            className="p-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
                            title={activeClue.mediaPlaying ? 'Pause' : 'Resume'}
                          >
                            {activeClue.mediaPlaying ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-white" />
                            )}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Hint Controls */}
              {(() => {
                const hasHint = Boolean(
                  activeClueData.hint && activeClueData.hint.trim().length > 0
                );
                return (
                  <div
                    className={
                      'flex flex-wrap sm:flex-nowrap items-center gap-2 ' +
                      'sm:gap-3 p-2.5 sm:p-3 bg-black/30 border ' +
                      'border-gray-800 rounded-xl'
                    }
                  >
                    <div className="flex-1 min-w-0">
                      <span
                        className="text-xs font-bold text-gray-400 uppercase"
                      >
                        Hint (-$
                        {activeClueData.hintDeduction ??
                          config.defaultHintDeduction ??
                          100}
                        )
                      </span>
                      <p className="text-xs text-gray-400 italic truncate">
                        {hasHint
                          ? `"${activeClueData.hint}"`
                          : 'No hint configured for this clue'}
                      </p>
                    </div>
                    <button
                      onClick={() => dispatch({ type: 'REVEAL_HINT' })}
                      disabled={!hasHint || activeClue.hintRevealed}
                      className={
                        'px-3 py-1.5 bg-amber-600 hover:bg-amber-500 ' +
                        'disabled:opacity-40 disabled:cursor-not-allowed ' +
                        'text-white rounded-lg text-xs font-bold flex ' +
                        'items-center gap-1.5 transition-all shrink-0'
                      }
                      title={
                        !hasHint
                          ? 'No hint configured for this clue'
                          : activeClue.hintRevealed
                            ? 'Hint already revealed'
                            : 'Reveal hint to players'
                      }
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>
                        {!hasHint
                          ? 'None'
                          : activeClue.hintRevealed
                            ? 'Revealed'
                            : 'Reveal'}
                      </span>
                    </button>
                  </div>
                );
              })()}
            </div>

            {/* Answer Judging Section */}
            <div className="pt-2 border-t border-gray-800 space-y-3">
              {/* STATE A: Incorrect -> Rebound decision */}
              {activeClue.incorrectTeams &&
              activeClue.incorrectTeams.length === 1 &&
              !activeClue.reboundOpportunity &&
              activeClue.reboundAvailable &&
              !activeClue.correctTeam ? (
                <div
                  className={
                    'p-3 sm:p-4 rounded-xl bg-black/30 border ' +
                    'border-gray-800 space-y-2.5 sm:space-y-3'
                  }
                >
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-bold text-gray-300">
                      {activeClue.firstAnsweringTeam === 1
                        ? config.team1Name
                        : config.team2Name}{' '}
                      incorrect
                    </span>
                    <span className="text-xs font-bold text-gray-500 ml-auto">
                      Rebound: $
                      {Math.round(activeClue.currentAvailablePoints / 2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => dispatch({ type: 'ADVANCE_REBOUND' })}
                      className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs uppercase rounded-lg flex items-center justify-center gap-2 transition-all"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>
                        Rebound ($
                        {Math.round(activeClue.currentAvailablePoints / 2)})
                      </span>
                    </button>
                    <button
                      onClick={() => dispatch({ type: 'CLOSE_CLUE' })}
                      className="py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs uppercase rounded-lg transition-all"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ) : activeClue.correctTeam ? (
                /* STATE B: Correct */
                <div
                  className={
                    'p-3 sm:p-4 rounded-xl bg-black/30 border ' +
                    'border-gray-800 flex flex-wrap items-center ' +
                    'justify-between gap-2.5 sm:gap-3'
                  }
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-bold text-white">
                      {activeClue.correctTeam === 1
                        ? config.team1Name
                        : config.team2Name}{' '}
                      +$
                      {activeClue.awardResult?.pointsAwarded ??
                        activeClue.currentAvailablePoints}
                    </span>
                  </div>
                  <button
                    onClick={() => dispatch({ type: 'CLOSE_CLUE' })}
                    className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500
                      text-white font-bold text-xs uppercase rounded-lg
                      transition-all"
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* STATE C: Standard judging */
                <>
                  {/* Answering team selector */}
                  <div
                    className={
                      'flex flex-wrap items-center justify-between gap-2'
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 uppercase">
                        Answering:
                      </span>
                      <div
                        className="flex items-center border border-gray-700
                          rounded-lg overflow-hidden bg-black/40"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            dispatch({
                              type: 'SET_CONTROLLING_TEAM',
                              payload: { team: 1 },
                            })
                          }
                          className={`px-3 py-1.5 text-xs font-bold uppercase
                            transition-all ${
                              activeClue.currentAnsweringTeam === 1
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white'
                            }`}
                        >
                          {config.team1Name || 'Team 1'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            dispatch({
                              type: 'SET_CONTROLLING_TEAM',
                              payload: { team: 2 },
                            })
                          }
                          className={`px-3 py-1.5 text-xs font-bold uppercase
                            transition-all ${
                              activeClue.currentAnsweringTeam === 2
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white'
                            }`}
                        >
                          {config.team2Name || 'Team 2'}
                        </button>
                      </div>
                    </div>
                    {activeClue.reboundOpportunity && (
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold
                          text-amber-300 bg-amber-950/60 border
                          border-amber-500/40 uppercase"
                      >
                        Rebound 50%
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      onClick={() =>
                        dispatch({
                          type: 'ANSWER_CORRECT',
                          payload: { team: activeClue.currentAnsweringTeam },
                        })
                      }
                      className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded-lg flex items-center justify-center gap-1.5 transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>+${activeClue.currentAvailablePoints}</span>
                    </button>

                    <button
                      onClick={() =>
                        dispatch({
                          type: 'ANSWER_WRONG',
                          payload: { team: activeClue.currentAnsweringTeam },
                        })
                      }
                      className="py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase rounded-lg flex items-center justify-center gap-1.5 transition-all"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Wrong</span>
                    </button>

                    {activeClue.reboundOpportunity ? (
                      <button
                        onClick={() => dispatch({ type: 'PASS_REBOUND' })}
                        className="py-2.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs uppercase rounded-lg flex items-center justify-center gap-1.5 transition-all"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                        <span>Pass</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => dispatch({ type: 'REVEAL_ANSWER' })}
                        className="py-2.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs uppercase rounded-lg flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Reveal</span>
                      </button>
                    )}

                    <button
                      onClick={() => dispatch({ type: 'CLOSE_CLUE' })}
                      className="py-2.5 px-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs uppercase rounded-lg flex items-center justify-center gap-1.5 transition-all"
                    >
                      <span>Finish</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SCORE ADJUSTMENT MODAL */}
      {showScoreModal && (
        <div
          className={
            'fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex ' +
            'items-center justify-center p-3 sm:p-4 overflow-y-auto'
          }
        >
          <div
            className={
              'bg-[#0c1630] border-2 border-blue-700 rounded-2xl max-w-md ' +
              'w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] ' +
              'overflow-y-auto my-auto'
            }
          >
            <h3 className="text-lg font-bold text-yellow-400">
              Manual Score Adjustment
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-300 font-bold block mb-1">
                  {config.team1Name} Score
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={scoreInputRef}
                    type="number"
                    value={tempTeam1Score}
                    onChange={(e) => setTempTeam1Score(Number(e.target.value))}
                    className={
                      'flex-1 min-w-0 px-3 py-2 bg-black/60 border ' +
                      'border-blue-800 rounded-lg text-white font-mono ' +
                      'text-base font-bold'
                    }
                  />
                  <button
                    onClick={() => setTempTeam1Score((s) => s + 100)}
                    className={
                      'p-2 bg-blue-900 hover:bg-blue-800 rounded-lg ' +
                      'text-xs font-bold shrink-0'
                    }
                  >
                    +100
                  </button>
                  <button
                    onClick={() => setTempTeam1Score((s) => s - 100)}
                    className={
                      'p-2 bg-blue-900 hover:bg-blue-800 rounded-lg ' +
                      'text-xs font-bold shrink-0'
                    }
                  >
                    -100
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-300 font-bold block mb-1">
                  {config.team2Name} Score
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={tempTeam2Score}
                    onChange={(e) => setTempTeam2Score(Number(e.target.value))}
                    className={
                      'flex-1 min-w-0 px-3 py-2 bg-black/60 border ' +
                      'border-blue-800 rounded-lg text-white font-mono ' +
                      'text-base font-bold'
                    }
                  />
                  <button
                    onClick={() => setTempTeam2Score((s) => s + 100)}
                    className={
                      'p-2 bg-blue-900 hover:bg-blue-800 rounded-lg ' +
                      'text-xs font-bold shrink-0'
                    }
                  >
                    +100
                  </button>
                  <button
                    onClick={() => setTempTeam2Score((s) => s - 100)}
                    className={
                      'p-2 bg-blue-900 hover:bg-blue-800 rounded-lg ' +
                      'text-xs font-bold shrink-0'
                    }
                  >
                    -100
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-blue-900">
              <button
                onClick={() => setShowScoreModal(false)}
                className={
                  'px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg ' +
                  'text-xs font-bold text-gray-300'
                }
              >
                Cancel
              </button>
              <button
                onClick={handleScoreSave}
                className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 rounded-lg text-xs font-black text-black"
              >
                Save Scores
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileConnectModal
        isOpen={showMobileConnectModal}
        onClose={() => setShowMobileConnectModal(false)}
      />

      {inspectingCompletedClue && (
        <CompletedClueModal
          isOpen={true}
          onClose={() => setInspectingCompletedClue(null)}
          categoryName={
            config.rounds[inspectingCompletedClue.roundIndex]?.categories[
              inspectingCompletedClue.categoryIndex
            ]?.name || ''
          }
          clue={inspectingCompletedClue.clue}
          team1Name={config.team1Name || 'Champions'}
          team2Name={config.team2Name || 'Challengers'}
          onReset={() => {
            dispatch({
              type: 'RESET_CLUE_BOX',
              payload: {
                roundIndex: inspectingCompletedClue.roundIndex,
                categoryIndex: inspectingCompletedClue.categoryIndex,
                clueIndex: inspectingCompletedClue.clueIndex,
              },
            });
          }}
        />
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  GameConfig,
  Category,
  Clue,
  MediaType,
  createGameFromPreferences,
} from '../../types/game';
import { serializeGameConfigToYaml } from '../../utils/gameYaml';
import {
  Save,
  Plus,
  Trash2,
  Edit2,
  X,
  FileUp,
  Video,
  Sparkles,
  ExternalLink,
  Clock,
} from 'lucide-react';
import { parseYouTubeUrl, formatSecondsToTime } from '../../utils/youtube';

export interface GameBuilderProps {
  currentConfig: GameConfig | null;
  lastSavedYaml?: string | null;
  onSaveSuccess?: (savedYaml: string) => void;
  onSaveAndPlay: (config: GameConfig) => void;
  onCloseGame: () => void;
  saveGameFile: (config: GameConfig) => Promise<boolean>;
  selectMediaFile: (
    type: 'image' | 'audio' | 'video'
  ) => Promise<string | null>;
}

export const GameBuilder: React.FC<GameBuilderProps> = ({
  currentConfig,
  lastSavedYaml,
  onSaveSuccess,
  onSaveAndPlay,
  onCloseGame,
  saveGameFile,
  selectMediaFile,
}) => {
  const [config, setConfig] = useState<GameConfig>(() =>
    currentConfig
      ? JSON.parse(JSON.stringify(currentConfig))
      : createGameFromPreferences()
  );

  const [savedYaml, setSavedYaml] = useState<string | null>(
    () => lastSavedYaml ?? null
  );
  const [activeTab, setActiveTab] = useState<'board' | 'tiebreaker'>('board');
  const [selectedRoundIdx, setSelectedRoundIdx] = useState(0);
  const [selectedCatIdx, setSelectedCatIdx] = useState(0);
  const [selectedClueIdx, setSelectedClueIdx] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Synchronize when parent passes a new lastSavedYaml
  useEffect(() => {
    if (lastSavedYaml !== undefined) {
      setSavedYaml(lastSavedYaml);
    }
  }, [lastSavedYaml]);

  // Synchronize when currentConfig updates (e.g. loaded game file)
  useEffect(() => {
    if (currentConfig) {
      setConfig(JSON.parse(JSON.stringify(currentConfig)));
      setSelectedRoundIdx(0);
      setSelectedCatIdx(0);
      setSelectedClueIdx(null);
    }
  }, [currentConfig]);

  // Clean / Dirty save tracking
  const isSaved =
    savedYaml !== null && serializeGameConfigToYaml(config) === savedYaml;

  // Active round and category for main board
  const activeRound = config.rounds[selectedRoundIdx] || config.rounds[0];
  const activeCategory = activeRound?.categories[selectedCatIdx];
  const activeClue =
    selectedClueIdx !== null && activeCategory
      ? activeCategory.clues[selectedClueIdx]
      : null;

  const firstCategoryRef = useRef<HTMLInputElement>(null);
  const tieBreakerCategoryRef = useRef<HTMLInputElement>(null);
  const questionInputRef = useRef<HTMLTextAreaElement>(null);
  const prevClueIdxRef = useRef<number | null>(null);
  const prevTabRef = useRef<string | null>(null);

  // Focus Question Text ONLY when opening the clue editor modal (never on keystrokes)
  useEffect(() => {
    if (selectedClueIdx !== null && prevClueIdxRef.current === null) {
      const timer = setTimeout(() => questionInputRef.current?.focus(), 50);
      prevClueIdxRef.current = selectedClueIdx;
      return () => clearTimeout(timer);
    }
    prevClueIdxRef.current = selectedClueIdx;
  }, [selectedClueIdx]);

  // Focus top text input ONLY on initial mount or when switching tabs
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      const timer = setTimeout(() => {
        if (activeTab === 'board') {
          firstCategoryRef.current?.focus();
        } else if (activeTab === 'tiebreaker' && config.finalJeopardy) {
          tieBreakerCategoryRef.current?.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [activeTab, config.finalJeopardy]);

  // Save changes to active clue
  const handleUpdateActiveClue = (updated: Partial<Clue>) => {
    if (selectedClueIdx === null || !activeCategory) return;
    const newRounds = [...config.rounds];
    const clues = [
      ...newRounds[selectedRoundIdx].categories[selectedCatIdx].clues,
    ];
    clues[selectedClueIdx] = { ...clues[selectedClueIdx], ...updated };
    newRounds[selectedRoundIdx].categories[selectedCatIdx].clues = clues;
    setConfig({ ...config, rounds: newRounds });
  };

  // Add Category
  const handleAddCategory = () => {
    if (!activeRound) return;
    // Derive point values from game config or first existing category
    const pointValues =
      config.pointProgression && config.pointProgression.length > 0
        ? [...config.pointProgression]
        : activeRound.categories[0]?.clues.map((c) => c.points) || [
            100, 200, 300, 400, 500,
          ];

    const newCategory: Category = {
      id: `cat-${Date.now()}`,
      name: '',
      clues: pointValues.map((pts, i) => ({
        id: `c-${Date.now()}-${i}`,
        points: pts,
        question: '',
        answer: '',
        hint: '',
        state: 'unopened',
      })),
    };

    const newRounds = [...config.rounds];
    newRounds[selectedRoundIdx].categories.push(newCategory);
    setConfig({ ...config, rounds: newRounds });
    setSelectedCatIdx(newRounds[selectedRoundIdx].categories.length - 1);
  };

  // Delete Category
  const handleDeleteCategory = (catIdx: number) => {
    if (!activeRound || activeRound.categories.length <= 1) return;
    const newRounds = [...config.rounds];
    newRounds[selectedRoundIdx].categories.splice(catIdx, 1);
    setConfig({ ...config, rounds: newRounds });
    setSelectedCatIdx(Math.max(0, catIdx - 1));
  };

  // Handle local media selection for active clue
  const handleBrowseMedia = async (type: 'image' | 'audio' | 'video') => {
    const selectedPath = await selectMediaFile(type);
    if (selectedPath) {
      handleUpdateActiveClue({
        media: {
          type,
          urlOrPath: selectedPath,
        },
      });
    }
  };

  // Handle local media selection for tie-breaker
  const handleBrowseTieBreakerMedia = async (
    type: 'image' | 'audio' | 'video'
  ) => {
    const selectedPath = await selectMediaFile(type);
    if (selectedPath && config.finalJeopardy) {
      setConfig({
        ...config,
        finalJeopardy: {
          ...config.finalJeopardy,
          media: {
            type,
            urlOrPath: selectedPath,
          },
        },
      });
    }
  };

  // Save game to disk
  const handleSaveGame = async () => {
    setIsSaving(true);
    try {
      const success = await saveGameFile(config);
      if (success) {
        const currentYaml = serializeGameConfigToYaml(config);
        setSavedYaml(currentYaml);
        if (onSaveSuccess) {
          onSaveSuccess(currentYaml);
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Count incomplete questions remaining for Play Game validation
  const remainingQuestionsCount = useMemo(() => {
    let count = 0;
    config.rounds.forEach((round) => {
      round.categories.forEach((cat) => {
        cat.clues.forEach((clue) => {
          if (!clue.question.trim() || !clue.answer.trim()) {
            count++;
          }
        });
      });
    });

    if (config.finalJeopardy) {
      if (
        !config.finalJeopardy.question.trim() ||
        !config.finalJeopardy.answer.trim()
      ) {
        count++;
      }
    }

    return count;
  }, [config]);

  const hasIncompleteCategories = useMemo(() => {
    for (const round of config.rounds) {
      for (const cat of round.categories) {
        if (!cat.name.trim()) return true;
      }
    }
    if (config.finalJeopardy && !config.finalJeopardy.category.trim()) {
      return true;
    }
    return false;
  }, [config]);

  const isGameValid =
    remainingQuestionsCount === 0 &&
    !hasIncompleteCategories &&
    Boolean(
      config.title.trim() && config.team1Name.trim() && config.team2Name.trim()
    );

  const playGameTooltip = isGameValid
    ? 'Start playing with current configuration'
    : remainingQuestionsCount > 0
      ? `${remainingQuestionsCount} question${remainingQuestionsCount === 1 ? '' : 's'} remaining`
      : 'Category name is required';

  // Close game handler
  const handleClose = () => {
    const confirmMsg = isSaved
      ? 'Close this game and return to the main setup screen?'
      : 'You have unsaved changes. Are you sure you want to close this game and return to setup? All unsaved changes will be lost.';
    if (window.confirm(confirmMsg)) {
      onCloseGame();
    }
  };

  return (
    <div className="min-h-screen bg-[#070e1c] text-white flex flex-col font-sans select-none">
      {/* BUILDER HEADER */}
      <header className="bg-[#0b172e] border-b border-blue-900/60 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <img
            src="./logo.svg"
            alt="JeoPARTY!"
            className="w-9 h-9 object-contain shrink-0"
          />
          <div>
            <h1 className="text-xl font-black uppercase text-yellow-400 tracking-wider">
              Game Builder & Editor
            </h1>
            <p className="text-xs text-gray-400">
              Customize categories, questions, multimedia, and game rules
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Save Game Button (with indicator if unsaved or changed) */}
          <button
            onClick={handleSaveGame}
            disabled={isSaving}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow ${
              isSaved
                ? 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                : 'bg-amber-950/50 hover:bg-amber-900/60 border border-amber-500/60 text-amber-200 shadow-amber-950/40'
            }`}
            title={
              isSaved
                ? 'Game is saved to disk'
                : 'You have unsaved changes. Click to save to YAML file.'
            }
          >
            {!isSaved && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
              </span>
            )}
            <Save
              className={`w-4 h-4 ${isSaved ? 'text-emerald-400' : 'text-amber-400'}`}
            />
            <span>{isSaving ? 'Saving...' : 'Save Game'}</span>
          </button>

          {/* Play Game Button */}
          <button
            onClick={() => isGameValid && onSaveAndPlay(config)}
            disabled={!isGameValid}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-wider shadow-lg transition-all ${
              isGameValid
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 cursor-pointer shadow-emerald-900/30'
                : 'bg-gray-700/80 text-gray-400 cursor-not-allowed opacity-60'
            }`}
            title={playGameTooltip}
          >
            <Sparkles className="w-4 h-4" />
            <span>Play Game</span>
          </button>

          {/* Close Game Button */}
          <button
            onClick={handleClose}
            className={
              'flex items-center gap-1.5 px-3 py-2 bg-rose-950/40 ' +
              'hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 ' +
              'rounded-lg text-xs font-bold transition-all'
            }
            title="Close this game and return to main setup"
          >
            <X className="w-5 h-5" strokeWidth={2.5} />
            <span>Close Game</span>
          </button>
        </div>
      </header>

      {/* GLOBAL SETTINGS (Game title and team names read-only; hint penalty & rebound scoring editable) */}
      <section className="bg-[#091326] border-b border-blue-900/40 px-6 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="flex flex-col justify-center">
            <span className="text-[11px] font-bold uppercase text-gray-400 block tracking-wider">
              Game Title
            </span>
            <span
              className="text-sm font-black text-yellow-400 truncate"
              title={config.title}
            >
              {config.title}
            </span>
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-[11px] font-bold uppercase text-gray-400 block tracking-wider">
              Team 1 Name
            </span>
            <span
              className="text-sm font-bold text-white truncate"
              title={config.team1Name}
            >
              {config.team1Name}
            </span>
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-[11px] font-bold uppercase text-gray-400 block tracking-wider">
              Team 2 Name
            </span>
            <span
              className="text-sm font-bold text-white truncate"
              title={config.team2Name}
            >
              {config.team2Name}
            </span>
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-gray-400 block mb-1">
              Hint Penalty
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-yellow-400">$</span>
              <input
                type="number"
                value={config.defaultHintDeduction}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    defaultHintDeduction: Number(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-1.5 bg-black/60 border border-blue-800 rounded-lg text-white font-bold text-sm focus:border-yellow-400 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-gray-400 block mb-1">
              Rebound Scoring
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                value={config.reboundPercentage ?? 50}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    reboundPercentage: Number(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-1.5 bg-black/60 border border-blue-800 rounded-lg text-white font-bold text-sm focus:border-yellow-400 focus:outline-none"
              />
              <span className="text-sm font-bold text-yellow-400">%</span>
            </div>
          </div>
        </div>
      </section>

      {/* NAVIGATION TABS: Categories & Questions vs Tie-Breaker Question */}
      <section className="bg-[#0c1933] border-b border-blue-900/50 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('board')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'board'
                ? 'bg-blue-600 text-white shadow'
                : 'bg-black/30 text-gray-400 hover:text-white'
            }`}
          >
            Categories & Questions
          </button>

          <button
            onClick={() => setActiveTab('tiebreaker')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'tiebreaker'
                ? 'bg-amber-600 text-white shadow'
                : 'bg-black/30 text-gray-400 hover:text-white'
            }`}
          >
            <span>Tie-Breaker Question</span>
            {config.finalJeopardy && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          {/* Multi-round support for legacy files */}
          {config.rounds.length > 1 &&
            config.rounds.map((round, rIdx) => (
              <button
                key={round.id}
                onClick={() => {
                  setSelectedRoundIdx(rIdx);
                  setSelectedCatIdx(0);
                  setSelectedClueIdx(null);
                  setActiveTab('board');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  selectedRoundIdx === rIdx && activeTab === 'board'
                    ? 'border border-blue-400 text-blue-200'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {round.name}
              </button>
            ))}
        </div>
      </section>

      {/* WORKSPACE */}
      <main className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'board' && activeRound && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-extrabold text-blue-300 tracking-wider">
                Categories ({activeRound.categories.length})
              </span>
              <button
                onClick={handleAddCategory}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow"
              >
                <Plus className="w-4 h-4" />
                <span>Add Category</span>
              </button>
            </div>

            {/* Category Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {activeRound.categories.map((category, catIdx) => (
                <div
                  key={category.id}
                  className="bg-[#0b162f] border border-blue-900/80 rounded-xl p-3 flex flex-col justify-between shadow space-y-3"
                >
                  <div className="space-y-1 border-b border-blue-900/50 pb-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase text-gray-400">
                        Category Name <span className="text-amber-400">*</span>
                      </label>
                      {activeRound.categories.length > 1 && (
                        <button
                          onClick={() => handleDeleteCategory(catIdx)}
                          className="text-red-400 hover:text-red-300 p-0.5"
                          title="Delete category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <input
                      ref={catIdx === 0 ? firstCategoryRef : undefined}
                      type="text"
                      value={category.name}
                      onChange={(e) => {
                        const newRounds = [...config.rounds];
                        newRounds[selectedRoundIdx].categories[catIdx].name =
                          e.target.value;
                        setConfig({ ...config, rounds: newRounds });
                      }}
                      className={`w-full font-black uppercase text-xs text-yellow-300 focus:outline-none px-2 py-1 rounded border transition-all ${
                        !category.name.trim()
                          ? 'bg-amber-950/40 border-amber-500/80 focus:border-yellow-400'
                          : 'bg-black/40 border-blue-900 focus:border-yellow-400 focus:bg-blue-950'
                      }`}
                    />
                  </div>

                  {/* Questions List */}
                  <div className="space-y-2">
                    {category.clues.map((clue, cIdx) => {
                      const isMissing =
                        !clue.question.trim() || !clue.answer.trim();
                      return (
                        <button
                          key={clue.id}
                          onClick={() => {
                            setSelectedCatIdx(catIdx);
                            setSelectedClueIdx(cIdx);
                          }}
                          className={`w-full p-2 rounded-lg text-left flex items-center justify-between transition-all ${
                            isMissing
                              ? 'bg-amber-950/20 hover:bg-amber-950/40 border-2 border-amber-500/80 shadow-sm shadow-amber-950/40'
                              : 'bg-[#060c1d] hover:bg-[#122144] border border-blue-950 hover:border-blue-700'
                          }`}
                        >
                          <div className="flex flex-col truncate pr-2">
                            <span className="text-xs font-bold text-yellow-400 font-mono">
                              ${clue.points}
                            </span>
                            <span
                              className={`text-[11px] truncate ${
                                isMissing
                                  ? 'text-amber-400 font-medium italic'
                                  : 'text-gray-300'
                              }`}
                            >
                              {!clue.question.trim()
                                ? 'Missing Question *'
                                : !clue.answer.trim()
                                  ? `${clue.question} (Missing Answer *)`
                                  : clue.question}
                            </span>
                          </div>
                          <Edit2
                            className={`w-3 h-3 shrink-0 ${isMissing ? 'text-amber-400' : 'text-blue-400'}`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TIE-BREAKER WORKSPACE */}
        {activeTab === 'tiebreaker' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between p-4 bg-[#0b162f] border border-blue-900 rounded-xl">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Tie-Breaker Question
                </h3>
                <p className="text-xs text-gray-400">
                  Optional tie-breaker question played at the end of the game
                </p>
              </div>
              <button
                onClick={() => {
                  if (config.finalJeopardy) {
                    setConfig({ ...config, finalJeopardy: undefined });
                  } else {
                    setConfig({
                      ...config,
                      finalJeopardy: {
                        category: '',
                        question: '',
                        answer: '',
                        hint: '',
                      },
                    });
                    setTimeout(
                      () => tieBreakerCategoryRef.current?.focus(),
                      50
                    );
                  }
                }}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  config.finalJeopardy
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-gray-800 text-gray-300 hover:text-white'
                }`}
              >
                {config.finalJeopardy ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {config.finalJeopardy && (
              <div className="bg-[#0b162f] border border-amber-600/50 rounded-2xl p-6 shadow-xl space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    Tie-Breaker Category Name{' '}
                    <span className="text-amber-400">*</span>
                  </label>
                  <input
                    ref={tieBreakerCategoryRef}
                    type="text"
                    value={config.finalJeopardy.category}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        finalJeopardy: {
                          ...config.finalJeopardy!,
                          category: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-black/60 border border-blue-800 rounded-lg text-white font-bold text-sm focus:border-yellow-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-300 block mb-1">
                    Question Text <span className="text-amber-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={config.finalJeopardy.question}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        finalJeopardy: {
                          ...config.finalJeopardy!,
                          question: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-black/60 border border-blue-800 rounded-lg text-white text-sm focus:border-yellow-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-emerald-400 block mb-1">
                    Answer <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={config.finalJeopardy.answer}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        finalJeopardy: {
                          ...config.finalJeopardy!,
                          answer: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-black/60 border border-emerald-700 rounded-lg text-white text-sm focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-amber-400 block mb-1">
                    Hint (Optional)
                  </label>
                  <input
                    type="text"
                    value={config.finalJeopardy.hint || ''}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        finalJeopardy: {
                          ...config.finalJeopardy!,
                          hint: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 bg-black/60 border border-amber-800 rounded-lg text-white text-sm focus:border-amber-400 focus:outline-none"
                  />
                </div>

                {/* Multimedia Attachment for Tie-Breaker */}
                <div className="p-3 bg-black/40 border border-blue-900 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-blue-300 uppercase block">
                    Media Attachment (Optional)
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      [
                        'none',
                        'image',
                        'audio',
                        'video',
                        'youtube',
                      ] as MediaType[]
                    ).map((mType) => (
                      <button
                        key={mType}
                        onClick={() =>
                          setConfig({
                            ...config,
                            finalJeopardy: {
                              ...config.finalJeopardy!,
                              media: {
                                type: mType,
                                urlOrPath:
                                  config.finalJeopardy?.media?.urlOrPath || '',
                              },
                            },
                          })
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                          (config.finalJeopardy?.media?.type || 'none') ===
                          mType
                            ? 'bg-yellow-500 text-black shadow'
                            : 'bg-blue-950 text-gray-300 hover:text-white'
                        }`}
                      >
                        {mType}
                      </button>
                    ))}
                  </div>

                  {config.finalJeopardy.media &&
                    config.finalJeopardy.media.type !== 'none' && (
                      <div className="pt-2 flex flex-col gap-2">
                        {config.finalJeopardy.media.type === 'youtube' ? (
                          (() => {
                            const ytInfo = parseYouTubeUrl(
                              config.finalJeopardy.media.urlOrPath
                            );
                            return (
                              <div className="flex flex-col gap-1.5 bg-black/40 border border-blue-900/60 rounded-xl p-3">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                    <Video className="w-4 h-4 text-red-500" />
                                    <span>YouTube Link</span>
                                  </label>
                                  {ytInfo.startTimestampSeconds !== null &&
                                    ytInfo.startTimestampSeconds > 0 && (
                                      <span className="text-[11px] font-bold text-amber-300 bg-amber-950/70 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-amber-400" />
                                        Starts at{' '}
                                        {formatSecondsToTime(
                                          ytInfo.startTimestampSeconds
                                        )}{' '}
                                        ({ytInfo.startTimestampSeconds}s)
                                      </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    placeholder="https://www.youtube.com/watch?v=... (e.g. ?t=1m30s)"
                                    value={config.finalJeopardy.media.urlOrPath}
                                    onChange={(e) =>
                                      setConfig({
                                        ...config,
                                        finalJeopardy: {
                                          ...config.finalJeopardy!,
                                          media: {
                                            type: 'youtube',
                                            urlOrPath: e.target.value,
                                          },
                                        },
                                      })
                                    }
                                    className="flex-1 px-3 py-2 bg-black/70 border border-blue-800 rounded-lg text-xs text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                                  />
                                  {config.finalJeopardy.media.urlOrPath.trim() && (
                                    <a
                                      href={config.finalJeopardy.media.urlOrPath.trim()}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
                                      title="Open video in new tab"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-yellow-400" />
                                      <span>Test Link</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Local file path or URL"
                              value={config.finalJeopardy.media.urlOrPath}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  finalJeopardy: {
                                    ...config.finalJeopardy!,
                                    media: {
                                      type:
                                        config.finalJeopardy?.media?.type ||
                                        'none',
                                      urlOrPath: e.target.value,
                                    },
                                  },
                                })
                              }
                              className="flex-1 px-3 py-1.5 bg-black/70 border border-blue-800 rounded-lg text-xs text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                            />
                            <button
                              onClick={() =>
                                handleBrowseTieBreakerMedia(
                                  config.finalJeopardy?.media?.type as
                                    'image' | 'audio' | 'video'
                                )
                              }
                              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0"
                            >
                              <FileUp className="w-3.5 h-3.5" />
                              <span>Browse</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* CLUE / QUESTION EDITOR MODAL */}
      {activeClue && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1733] border-2 border-yellow-500 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-blue-900 pb-3">
              <h3 className="text-base font-bold text-yellow-400">
                Edit Question ({activeCategory?.name} - ${activeClue.points})
              </h3>
              <button
                onClick={() => setSelectedClueIdx(null)}
                className="p-1 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-300 block mb-1">
                  Question Text <span className="text-amber-400">*</span>
                </label>
                <textarea
                  ref={questionInputRef}
                  rows={3}
                  value={activeClue.question}
                  onChange={(e) =>
                    handleUpdateActiveClue({ question: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-black/60 border border-blue-800 rounded-lg text-white text-sm focus:border-yellow-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-400 block mb-1">
                  Answer <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={activeClue.answer}
                  onChange={(e) =>
                    handleUpdateActiveClue({ answer: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-black/60 border border-emerald-700 rounded-lg text-white text-sm focus:border-emerald-400 focus:outline-none"
                />
              </div>

              {/* Multimedia Attachment */}
              <div className="p-3 bg-black/40 border border-blue-900 rounded-xl space-y-2">
                <span className="text-xs font-bold text-blue-300 uppercase block">
                  Media Attachment (Optional)
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      'none',
                      'image',
                      'audio',
                      'video',
                      'youtube',
                    ] as MediaType[]
                  ).map((mType) => (
                    <button
                      key={mType}
                      onClick={() =>
                        handleUpdateActiveClue({
                          media: {
                            type: mType,
                            urlOrPath: activeClue.media?.urlOrPath || '',
                          },
                        })
                      }
                      className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all ${
                        (activeClue.media?.type || 'none') === mType
                          ? 'bg-yellow-500 text-black shadow'
                          : 'bg-blue-950 text-gray-300 hover:text-white'
                      }`}
                    >
                      {mType}
                    </button>
                  ))}
                </div>

                {activeClue.media && activeClue.media.type !== 'none' && (
                  <div className="pt-2 flex flex-col gap-2">
                    {activeClue.media.type === 'youtube' ? (
                      (() => {
                        const ytInfo = parseYouTubeUrl(
                          activeClue.media.urlOrPath
                        );
                        return (
                          <div className="flex flex-col gap-1.5 bg-black/40 border border-blue-900/60 rounded-xl p-3">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                <Video className="w-4 h-4 text-red-500" />
                                <span>YouTube Link</span>
                              </label>
                              {ytInfo.startTimestampSeconds !== null &&
                                ytInfo.startTimestampSeconds > 0 && (
                                  <span className="text-[11px] font-bold text-amber-300 bg-amber-950/70 border border-amber-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-amber-400" />
                                    Starts at{' '}
                                    {formatSecondsToTime(
                                      ytInfo.startTimestampSeconds
                                    )}{' '}
                                    ({ytInfo.startTimestampSeconds}s)
                                  </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="https://www.youtube.com/watch?v=... (e.g. ?t=1m30s)"
                                value={activeClue.media.urlOrPath}
                                onChange={(e) =>
                                  handleUpdateActiveClue({
                                    media: {
                                      type: 'youtube',
                                      urlOrPath: e.target.value,
                                    },
                                  })
                                }
                                className="flex-1 px-3 py-2 bg-black/70 border border-blue-800 rounded-lg text-xs text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                              />
                              {activeClue.media.urlOrPath.trim() && (
                                <a
                                  href={activeClue.media.urlOrPath.trim()}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors"
                                  title="Open video in new tab"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-yellow-400" />
                                  <span>Test Link</span>
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Local file path or URL"
                          value={activeClue.media.urlOrPath}
                          onChange={(e) =>
                            handleUpdateActiveClue({
                              media: {
                                type: activeClue.media?.type || 'none',
                                urlOrPath: e.target.value,
                              },
                            })
                          }
                          className="flex-1 px-3 py-1.5 bg-black/70 border border-blue-800 rounded-lg text-xs text-white placeholder-gray-500 focus:border-yellow-400 focus:outline-none"
                        />
                        <button
                          onClick={() =>
                            handleBrowseMedia(
                              activeClue.media?.type as
                                'image' | 'audio' | 'video'
                            )
                          }
                          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0"
                        >
                          <FileUp className="w-3.5 h-3.5" />
                          <span>Browse</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-amber-400 block mb-1">
                  Hint
                </label>
                <input
                  type="text"
                  value={activeClue.hint || ''}
                  onChange={(e) =>
                    handleUpdateActiveClue({ hint: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-black/60 border border-amber-800 rounded-lg text-white text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-blue-900">
              <button
                onClick={() => setSelectedClueIdx(null)}
                className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs uppercase rounded-lg shadow"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

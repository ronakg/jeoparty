import React, { useEffect } from 'react';
import { X, RotateCcw, CheckCircle, HelpCircle } from 'lucide-react';
import { Clue } from '../../types/game';

interface CompletedClueModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryName: string;
  clue: Clue;
  team1Name: string;
  team2Name: string;
  onReset: () => void;
}

export const CompletedClueModal: React.FC<CompletedClueModalProps> = ({
  isOpen,
  onClose,
  categoryName,
  clue,
  team1Name,
  team2Name,
  onReset,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const winner = clue.result?.winner ?? 0;
  const resultType = clue.result?.type;
  const isFull = resultType === 'full';
  const reboundPts = Math.round(clue.points * 0.5);

  const getWinnerSummary = () => {
    if (winner === 1) {
      const pts = isFull ? clue.points : reboundPts;
      const typeLabel = isFull ? 'Full Value' : '50% Rebound';
      return `Awarded to ${team1Name} (+${pts} pts, ${typeLabel})`;
    }
    if (winner === 2) {
      const pts = isFull ? clue.points : reboundPts;
      const typeLabel = isFull ? 'Full Value' : '50% Rebound';
      return `Awarded to ${team2Name} (+${pts} pts, ${typeLabel})`;
    }
    return 'No points awarded (Passed / 0 pts)';
  };

  const handleReset = () => {
    if (
      window.confirm(
        `Reset "${categoryName}" $${clue.points} box? Any awarded ` +
          `points will be deducted and this box will return to unopened.`
      )
    ) {
      onReset();
      onClose();
    }
  };

  return (
    <div
      className={
        'fixed inset-0 z-50 flex items-center justify-center ' +
        'bg-black/85 backdrop-blur-md p-3 sm:p-4 select-none'
      }
      onClick={onClose}
    >
      <div
        className={
          'bg-[#060c18] border border-blue-900/80 rounded-2xl w-full ' +
          'max-w-lg flex flex-col shadow-2xl overflow-hidden'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header
          className={
            'px-5 py-3.5 border-b border-blue-900/60 bg-[#091224] flex ' +
            'items-center justify-between'
          }
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-600/20 text-yellow-400">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400">
                {categoryName}
              </span>
              <h2
                className={
                  'text-base font-black uppercase tracking-wider ' +
                  'text-amber-400 font-mono'
                }
              >
                ${clue.points}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className={
              'p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 ' +
              'hover:text-white transition-colors cursor-pointer'
            }
            title="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4 text-left">
          {/* Outcome Summary Pill */}
          <div
            className={
              'p-3 rounded-xl border flex items-center gap-2.5 ' +
              (winner === 1
                ? 'bg-blue-950/50 border-blue-600/50 text-blue-200'
                : winner === 2
                  ? 'bg-emerald-950/50 border-emerald-600/50 text-emerald-200'
                  : 'bg-slate-900/60 border-slate-700/60 text-slate-300')
            }
          >
            <span
              className={
                'text-xs font-black uppercase px-2 py-0.5 rounded ' +
                (winner === 1
                  ? 'bg-blue-800 text-white'
                  : winner === 2
                    ? 'bg-emerald-800 text-white'
                    : 'bg-slate-800 text-slate-400')
              }
            >
              {winner === 1
                ? isFull
                  ? 'T1'
                  : 'T1 50%'
                : winner === 2
                  ? isFull
                    ? 'T2'
                    : 'T2 50%'
                  : '0 PTS'}
            </span>
            <span className="text-xs font-semibold">{getWinnerSummary()}</span>
          </div>

          {/* Clue Details */}
          <div
            className={
              'p-4 bg-black/40 rounded-xl border border-blue-900/40 ' +
              'flex flex-col gap-3'
            }
          >
            <div>
              <span
                className={
                  'text-[10px] uppercase font-bold text-gray-400 ' +
                  'tracking-wider'
                }
              >
                Question
              </span>
              <p
                className={
                  'text-sm text-slate-100 font-medium mt-1 leading-relaxed'
                }
              >
                {clue.question}
              </p>
            </div>

            <div className="pt-2 border-t border-blue-900/40">
              <span
                className={
                  'text-[10px] uppercase font-bold text-yellow-400 ' +
                  'tracking-wider'
                }
              >
                Correct Answer
              </span>
              <p className="text-sm font-bold text-yellow-300 mt-1">
                {clue.answer}
              </p>
            </div>

            {clue.hint && (
              <div className="pt-2 border-t border-blue-900/40">
                <span
                  className={
                    'text-[10px] uppercase font-bold text-sky-400 ' +
                    'tracking-wider flex items-center gap-1'
                  }
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Hint</span>
                </span>
                <p className="text-xs text-slate-300 mt-0.5">{clue.hint}</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleReset}
              className={
                'px-3.5 py-2 rounded-lg bg-rose-950/80 hover:bg-rose-900 ' +
                'border border-rose-700/70 text-rose-300 hover:text-white ' +
                'text-xs font-black uppercase tracking-wider flex ' +
                'items-center gap-1.5 transition-all shadow cursor-pointer'
              }
              title="Reset this box back to unopened and deduct any points"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Question</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className={
                'px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 ' +
                'hover:text-white rounded-lg text-xs font-bold ' +
                'transition-all cursor-pointer'
              }
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

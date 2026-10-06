import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, Trash2, Terminal, Activity } from 'lucide-react';
import { tracer, TraceEvent } from '../../utils/tracer';

interface DebugTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DebugTraceModal: React.FC<DebugTraceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setEvents(tracer.getEvents());
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

  const handleCopy = async () => {
    try {
      const summary = tracer.formatMarkdownSummary();
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      setCopied(false);
    }
  };

  const handleClear = () => {
    tracer.clear();
    setEvents(tracer.getEvents());
  };

  const getTypeBadgeClass = (type: TraceEvent['type']) => {
    switch (type) {
      case 'UI_EVENT':
        return 'bg-sky-950/80 text-sky-300 border-sky-600/40';
      case 'DISPATCH':
        return 'bg-purple-950/80 text-purple-300 border-purple-600/40';
      case 'STATE_CHANGE':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-600/40';
      case 'WINNER_STATE':
        return 'bg-amber-950/80 text-amber-300 border-amber-600/40';
      case 'IPC_DISPATCH':
      case 'IPC_RECEIVE':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-600/40';
      case 'SYNC_CHANNEL':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-600/40';
      default:
        return 'bg-slate-900 text-slate-300 border-slate-700';
    }
  };

  return (
    <div
      className={
        'fixed inset-0 z-50 flex items-center justify-center ' +
        'bg-black/85 backdrop-blur-md p-4 select-none'
      }
      onClick={onClose}
    >
      <div
        className={
          'bg-[#060c18] border border-blue-900/80 rounded-2xl w-full ' +
          'max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header
          className={
            'px-6 py-3.5 border-b border-blue-900/60 bg-[#091224] flex ' +
            'items-center justify-between'
          }
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-600/20 text-yellow-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2
                className={
                  'text-sm font-black uppercase tracking-wider text-white ' +
                  'flex items-center gap-2'
                }
              >
                <span>JeoPARTY! Diagnostic Trace</span>
                <span
                  className={
                    'text-[10px] px-2 py-0.5 rounded-full bg-blue-950 ' +
                    'border border-blue-700/60 text-blue-300 font-sans ' +
                    'font-bold'
                  }
                >
                  {events.length} events
                </span>
              </h2>
              <span className="text-[11px] text-slate-400">
                Triggered via Ctrl/Cmd+Shift+D • In-Memory Ring Buffer
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={
                'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs ' +
                'font-bold transition-all border ' +
                (copied
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500')
              }
              title="Copy formatted trace report to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Trace</span>
                </>
              )}
            </button>
            <button
              onClick={handleClear}
              className={
                'p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 ' +
                'text-slate-300 border border-slate-700 transition-colors'
              }
              title="Clear event history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className={
                'p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 ' +
                'text-slate-300 border border-slate-700 transition-colors'
              }
              title="Close modal (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Event List */}
        <div
          ref={scrollRef}
          className={
            'flex-1 p-4 overflow-y-auto space-y-2 font-sans text-xs ' +
            'bg-[#030712] border-b border-blue-900/40 select-text'
          }
        >
          {events.length === 0 ? (
            <div className="py-12 text-center text-slate-500 select-none">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <span>No trace events recorded yet</span>
            </div>
          ) : (
            events.map((e) => (
              <div
                key={e.id}
                className={
                  'p-2.5 rounded-lg bg-[#081020]/90 border ' +
                  'border-blue-900/40 hover:border-blue-700/60 ' +
                  'transition-colors space-y-1.5'
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-500 text-[11px] font-bold">
                    #{e.id}
                  </span>
                  <span className="text-slate-400 text-[11px]">{e.time}</span>
                  <span
                    className={
                      'text-[10px] px-1.5 py-0.5 rounded uppercase font-bold ' +
                      'bg-slate-800 text-slate-300 border border-slate-700'
                    }
                  >
                    {e.source}
                  </span>
                  <span
                    className={
                      'text-[10px] px-1.5 py-0.5 rounded font-black border ' +
                      getTypeBadgeClass(e.type)
                    }
                  >
                    {e.type}
                  </span>
                  <span className="text-white font-bold text-xs">
                    {e.label}
                  </span>
                </div>

                {e.payload !== undefined && (
                  <div className="pl-6 text-[11px] text-slate-300">
                    <span className="text-purple-400 font-bold">Payload: </span>
                    <span className="text-slate-300 break-all">
                      {JSON.stringify(e.payload)}
                    </span>
                  </div>
                )}

                {e.stateDelta && (
                  <div className="pl-6 text-[11px] text-emerald-400">
                    <span className="font-bold">Delta: </span>
                    <span className="text-emerald-300 break-all">
                      {JSON.stringify(e.stateDelta)}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <footer
          className={
            'px-6 py-2.5 bg-[#070e1c] flex items-center justify-between ' +
            'text-[11px] text-slate-400'
          }
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Logging active</span>
            </span>
            <span>•</span>
            <span>Capacity: 500 events</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Press Esc to close</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

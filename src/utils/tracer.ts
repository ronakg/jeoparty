import { GameAction, GameState } from '../types/game';
import { getWinnerState, WinnerState } from './gameRules';

export type TraceEventType =
  | 'UI_EVENT'
  | 'DISPATCH'
  | 'STATE_CHANGE'
  | 'IPC_DISPATCH'
  | 'IPC_RECEIVE'
  | 'SYNC_CHANNEL'
  | 'WINNER_STATE'
  | 'SYSTEM';

export interface TraceEvent {
  id: number;
  time: string;
  source: 'admin' | 'display' | 'main' | 'system';
  type: TraceEventType;
  label: string;
  payload?: unknown;
  stateDelta?: Record<string, unknown>;
}

export interface StateSummary {
  team1Score: number;
  team2Score: number;
  controllingTeam: 1 | 2;
  currentRoundIndex: number;
  hasActiveClue: boolean;
  activeClueCoords?: string;
  coWinnersDeclared?: boolean;
  winnerState: WinnerState;
}

export function summarizeState(state: GameState): StateSummary {
  const winner = getWinnerState(state);
  return {
    team1Score: state.team1Score,
    team2Score: state.team2Score,
    controllingTeam: state.controllingTeam,
    currentRoundIndex: state.currentRoundIndex,
    hasActiveClue: state.activeClue !== null,
    activeClueCoords: state.activeClue
      ? `R${state.activeClue.roundIndex}:C${state.activeClue.categoryIndex}` +
        `:Q${state.activeClue.clueIndex}`
      : undefined,
    coWinnersDeclared: state.coWinnersDeclared,
    winnerState: winner,
  };
}

export function computeStateDelta(
  prev: GameState,
  next: GameState
): Record<string, unknown> {
  const delta: Record<string, unknown> = {};

  if (prev.team1Score !== next.team1Score) {
    delta.team1Score = `${prev.team1Score} -> ${next.team1Score}`;
  }
  if (prev.team2Score !== next.team2Score) {
    delta.team2Score = `${prev.team2Score} -> ${next.team2Score}`;
  }
  if (prev.controllingTeam !== next.controllingTeam) {
    delta.controllingTeam = `${prev.controllingTeam} -> ${next.controllingTeam}`;
  }
  if (prev.currentRoundIndex !== next.currentRoundIndex) {
    delta.roundIndex = `${prev.currentRoundIndex} -> ${next.currentRoundIndex}`;
  }
  if (prev.coWinnersDeclared !== next.coWinnersDeclared) {
    delta.coWinnersDeclared = `${prev.coWinnersDeclared} -> ${next.coWinnersDeclared}`;
  }

  const prevActive = prev.activeClue
    ? `R${prev.activeClue.roundIndex}:C${prev.activeClue.categoryIndex}` +
      `:Q${prev.activeClue.clueIndex}` +
      `(state=${prev.activeClue.lastJudgedResult || 'open'})`
    : 'none';
  const nextActive = next.activeClue
    ? `R${next.activeClue.roundIndex}:C${next.activeClue.categoryIndex}` +
      `:Q${next.activeClue.clueIndex}` +
      `(state=${next.activeClue.lastJudgedResult || 'open'})`
    : 'none';

  if (prevActive !== nextActive) {
    delta.activeClue = `${prevActive} -> ${nextActive}`;
  }

  const prevWinner = getWinnerState(prev);
  const nextWinner = getWinnerState(next);
  if (
    prevWinner.isGameOver !== nextWinner.isGameOver ||
    prevWinner.winner !== nextWinner.winner ||
    prevWinner.canProceedToTieBreaker !== nextWinner.canProceedToTieBreaker
  ) {
    delta.winnerState = {
      from: {
        isGameOver: prevWinner.isGameOver,
        winner: prevWinner.winner,
        canProceedToTieBreaker: prevWinner.canProceedToTieBreaker,
      },
      to: {
        isGameOver: nextWinner.isGameOver,
        winner: nextWinner.winner,
        canProceedToTieBreaker: nextWinner.canProceedToTieBreaker,
      },
    };
  }

  return delta;
}

class AppTracer {
  private events: TraceEvent[] = [];
  private maxEvents = 500;
  private nextId = 1;
  private currentSource: 'admin' | 'display' | 'main' | 'system' = 'system';

  constructor() {
    if (typeof window !== 'undefined') {
      const isDisplay = window.location.search.includes('view=display');
      this.currentSource = isDisplay ? 'display' : 'admin';
    }
  }

  public setSource(source: 'admin' | 'display' | 'main' | 'system'): void {
    this.currentSource = source;
  }

  public getSource(): 'admin' | 'display' | 'main' | 'system' {
    return this.currentSource;
  }

  public record(
    type: TraceEventType,
    label: string,
    payload?: unknown,
    stateDelta?: Record<string, unknown>,
    sourceOverride?: 'admin' | 'display' | 'main' | 'system'
  ): TraceEvent {
    const time = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
    const hasDelta = stateDelta && Object.keys(stateDelta).length > 0;
    const event: TraceEvent = {
      id: this.nextId++,
      time,
      source: sourceOverride || this.currentSource,
      type,
      label,
      payload: payload !== undefined ? payload : undefined,
      stateDelta: hasDelta ? stateDelta : undefined,
    };

    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Forward to electron logger if available
    if (
      typeof window !== 'undefined' &&
      window.electronAPI &&
      typeof window.electronAPI.writeTraceLog === 'function'
    ) {
      const pStr = event.payload
        ? ` | payload: ${JSON.stringify(event.payload)}`
        : '';
      const dStr = event.stateDelta
        ? ` | delta: ${JSON.stringify(event.stateDelta)}`
        : '';
      const line =
        `[${event.time}] [${event.source.toUpperCase()}] ` +
        `[${event.type}] ${event.label}${pStr}${dStr}`;
      window.electronAPI.writeTraceLog(line).catch(() => {});
    }

    return event;
  }

  public recordUiEvent(label: string, payload?: unknown): TraceEvent {
    return this.record('UI_EVENT', label, payload);
  }

  public recordDispatch(
    action: GameAction,
    prev: GameState,
    next: GameState
  ): void {
    const delta = computeStateDelta(prev, next);
    this.record('DISPATCH', `Action: ${action.type}`, action, delta);

    const winner = getWinnerState(next);
    if (winner.isGameOver || winner.canProceedToTieBreaker) {
      const statusLabel =
        `Winner status: gameOver=${winner.isGameOver}, ` +
        `winner=${winner.winner}, tieBreaker=${winner.canProceedToTieBreaker}`;
      this.record('WINNER_STATE', statusLabel, {
        reason: winner.reason,
        team: winner.winningTeamName,
      });
    }
  }

  public getEvents(): TraceEvent[] {
    return [...this.events];
  }

  public clear(): void {
    this.events = [];
    this.record('SYSTEM', 'Trace buffer cleared');
  }

  public formatMarkdownSummary(): string {
    const now = new Date().toISOString();
    const env =
      typeof window !== 'undefined' && window.electronAPI
        ? 'Electron'
        : 'Web Browser';
    const source = this.currentSource;

    let text = `### JeoPARTY! Diagnostic Trace Export\n`;
    text += `- Generated: ${now}\n`;
    text += `- Runtime: ${env} (${source})\n`;
    text += `- Event Count: ${this.events.length}\n\n`;
    text += `#### Event Timeline (Chronological)\n\`\`\`\n`;

    for (const e of this.events) {
      const sourceTag = `[${e.source.toUpperCase()}]`.padEnd(9, ' ');
      const typeTag = `[${e.type}]`.padEnd(14, ' ');
      text += `${e.time} ${sourceTag} ${typeTag} ${e.label}\n`;
      if (e.payload) {
        text += `   Payload: ${JSON.stringify(e.payload)}\n`;
      }
      if (e.stateDelta) {
        text += `   Delta:   ${JSON.stringify(e.stateDelta)}\n`;
      }
    }

    text += `\`\`\`\n\n`;
    text += `#### Raw JSON Trace\n\`\`\`json\n`;
    text += JSON.stringify(this.events, null, 2);
    text += `\n\`\`\`\n`;

    return text;
  }
}

export const tracer = new AppTracer();

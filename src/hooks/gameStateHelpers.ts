import { GameState } from '../types/game';

/**
 * URL normalization for browser (non-Electron) mode.
 * Passthrough for absolute URLs and data URIs;
 * prepends '/' to bare relative paths.
 */
export function toMediaUrlBrowser(filePath: string): string {
  if (!filePath) return '';
  if (
    filePath.startsWith('http://') ||
    filePath.startsWith('https://') ||
    filePath.startsWith('data:')
  ) {
    return filePath;
  }
  return filePath.startsWith('/') ? filePath : `/${filePath}`;
}

/**
 * Derives a filesystem-safe package filename from a game
 * title. Falls back to 'jeopardy' when title is empty
 * or contains only non-alphanumeric characters.
 */
export function sanitizeGameFileName(title?: string): string {
  const rawTitle = title?.trim();
  const safeTitle = rawTitle
    ? rawTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    : 'jeopardy';
  return `${safeTitle || 'jeopardy'}.jeopardy`;
}

/**
 * Generates a unique action ID from timestamp + random
 * suffix. Format: `<epoch>-<base36_random>`.
 */
export function createActionId(): string {
  return `${Date.now()}-` + `${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Creates a bounded deduplication tracker. Returns a
 * closure that accepts an ID string and returns true on
 * first encounter, false on duplicates. Evicts the
 * oldest entry when the set exceeds maxSize.
 */
export function createSeenActionIdTracker(
  maxSize: number
): (id: string) => boolean {
  const seen = new Set<string>();

  return (id: string): boolean => {
    if (seen.has(id)) return false;
    seen.add(id);
    if (seen.size > maxSize) {
      const first = seen.values().next().value;
      if (first) seen.delete(first);
    }
    return true;
  };
}

/**
 * Merges incoming remote state with local state,
 * preserving displayWindowOpen from prev when the
 * incoming value is undefined.
 */
export function mergeIncomingState(
  prev: GameState,
  incoming: GameState
): GameState {
  return {
    ...incoming,
    displayWindowOpen:
      incoming.displayWindowOpen !== undefined
        ? incoming.displayWindowOpen
        : prev.displayWindowOpen,
  };
}

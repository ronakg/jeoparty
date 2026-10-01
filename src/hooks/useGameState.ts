import { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, GameAction, GameConfig } from '../types/game';
import { initialGameState, gameReducer } from '../utils/gameReducer';
import {
  serializeGameConfigToYaml,
  parseGameConfigFromYaml,
} from '../utils/gameYaml';
import { tracer, computeStateDelta } from '../utils/tracer';

// Wipe any lingering localStorage keys from older versions to prevent restoring past games
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('jeopardy_game_state_v4');
    localStorage.removeItem('jeopardy_game_state_v3');
    localStorage.removeItem('jeopardy_game_state_v2');
    localStorage.removeItem('jeopardy_game_state');
  } catch {
    // Ignore storage access errors
  }
}

export function useGameState() {
  // Always initialize fresh with initialGameState (config: null, displayWindowOpen: false)
  const [state, setState] = useState<GameState>(initialGameState);

  const isElectron = typeof window !== 'undefined' && !!window.electronAPI;
  const stateRef = useRef(state);
  const displayWindowRef = useRef<Window | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Initialize and subscribe
  useEffect(() => {
    if (isElectron && window.electronAPI) {
      window.electronAPI.getState().then((serverState) => {
        setState(serverState);
        stateRef.current = serverState;
      });

      const unsubscribe = window.electronAPI.onStateUpdate((updatedState) => {
        const delta = computeStateDelta(stateRef.current, updatedState);
        tracer.record(
          'IPC_RECEIVE',
          'State updated from Electron main',
          undefined,
          delta
        );
        setState(updatedState);
        stateRef.current = updatedState;
      });

      return unsubscribe;
    } else {
      // Browser BroadcastChannel sync for active tabs during live session
      const channel = new BroadcastChannel('jeopardy_broadcast_channel');
      let lastDisplayHeartbeat = 0;

      channel.onmessage = (event) => {
        if (!event.data) return;
        if (event.data.type === 'STATE_SYNC') {
          const delta = computeStateDelta(stateRef.current, event.data.state);
          tracer.record(
            'SYNC_CHANNEL',
            'State sync received via BroadcastChannel',
            undefined,
            delta
          );
          setState((prev) => ({
            ...event.data.state,
            displayWindowOpen:
              event.data.state.displayWindowOpen !== undefined
                ? event.data.state.displayWindowOpen
                : prev.displayWindowOpen,
          }));
          stateRef.current = event.data.state;
        } else if (event.data.type === 'REQUEST_STATE') {
          tracer.record(
            'SYNC_CHANNEL',
            'Display tab requested current live state'
          );
          channel.postMessage({ type: 'STATE_SYNC', state: stateRef.current });
        } else if (event.data.type === 'DISPLAY_STATUS') {
          const isOpen = Boolean(event.data.isOpen);
          tracer.record(
            'SYNC_CHANNEL',
            `Display presence status: isOpen=${isOpen}`
          );
          if (isOpen) {
            lastDisplayHeartbeat = Date.now();
          }
          setState((prev) => {
            if (prev.displayWindowOpen === isOpen) return prev;
            const updated = { ...prev, displayWindowOpen: isOpen };
            stateRef.current = updated;
            return updated;
          });
        }
      };

      // Query if a display window is already open in another tab
      channel.postMessage({ type: 'PING_DISPLAY' });

      // If this tab was specifically opened as a display window, request live state from admin tab
      if (
        typeof window !== 'undefined' &&
        window.location.search.includes('view=display')
      ) {
        channel.postMessage({ type: 'REQUEST_STATE' });
      }

      // Periodically check if local displayWindowRef was closed or if remote display timed out
      const watchdog = setInterval(() => {
        if (displayWindowRef.current && displayWindowRef.current.closed) {
          displayWindowRef.current = null;
          setState((prev) => {
            if (!prev.displayWindowOpen) return prev;
            const updated = { ...prev, displayWindowOpen: false };
            stateRef.current = updated;
            return updated;
          });
        } else if (
          stateRef.current.displayWindowOpen &&
          !displayWindowRef.current
        ) {
          // If remote display hasn't sent a heartbeat in over 6 seconds, assume closed
          if (
            lastDisplayHeartbeat > 0 &&
            Date.now() - lastDisplayHeartbeat > 6000
          ) {
            setState((prev) => {
              if (!prev.displayWindowOpen) return prev;
              const updated = { ...prev, displayWindowOpen: false };
              stateRef.current = updated;
              return updated;
            });
          }
        }
      }, 2000);

      return () => {
        clearInterval(watchdog);
        channel.close();
      };
    }
  }, [isElectron]);

  const dispatch = useCallback(
    (action: GameAction) => {
      // Optimistically update local state synchronously so re-renders
      // and inter-tab broadcasts always transmit fresh state.
      const prevState = stateRef.current;
      const nextState = gameReducer(prevState, action);
      tracer.recordDispatch(action, prevState, nextState);
      stateRef.current = nextState;
      setState(nextState);

      if (isElectron && window.electronAPI) {
        tracer.record(
          'IPC_DISPATCH',
          `Invoking IPC dispatch-action: ${action.type}`
        );
        window.electronAPI.dispatchAction(action);
      } else {
        // Fallback for browser mode: in-memory sync across active tabs
        try {
          tracer.record(
            'SYNC_CHANNEL',
            `Broadcasting STATE_SYNC via channel: ${action.type}`
          );
          const channel = new BroadcastChannel('jeopardy_broadcast_channel');
          channel.postMessage({ type: 'STATE_SYNC', state: nextState });
          channel.close();
        } catch (e) {
          console.error('Failed to sync in browser mode:', e);
        }
      }
    },
    [isElectron]
  );

  const openDisplayWindow = useCallback(async () => {
    // If a display board is already open, do not open another board (strict no-op)
    if (stateRef.current.displayWindowOpen) {
      if (
        !isElectron &&
        displayWindowRef.current &&
        !displayWindowRef.current.closed
      ) {
        displayWindowRef.current.focus();
      }
      return;
    }

    if (isElectron && window.electronAPI) {
      await window.electronAPI.openDisplayWindow();
    } else {
      // In web browser: check if window ref exists and is still open
      if (displayWindowRef.current && !displayWindowRef.current.closed) {
        displayWindowRef.current.focus();
        setState((prev) => {
          const updated = { ...prev, displayWindowOpen: true };
          stateRef.current = updated;
          return updated;
        });
        return;
      }

      const url = `${window.location.origin}${window.location.pathname}?view=display`;
      const width =
        typeof window !== 'undefined' ? window.screen.availWidth : 1280;
      const height =
        typeof window !== 'undefined' ? window.screen.availHeight : 720;
      const win = window.open(
        url,
        'JeopardyDisplay',
        `width=${width},height=${height},top=0,left=0,menubar=no,toolbar=no`
      );
      if (win) {
        displayWindowRef.current = win;
        setState((prev) => {
          const updated = { ...prev, displayWindowOpen: true };
          stateRef.current = updated;
          return updated;
        });

        const timer = setInterval(() => {
          if (win.closed) {
            clearInterval(timer);
            if (displayWindowRef.current === win) {
              displayWindowRef.current = null;
            }
            setState((prev) => {
              const updated = { ...prev, displayWindowOpen: false };
              stateRef.current = updated;
              return updated;
            });
          }
        }, 1000);
      }
    }
  }, [isElectron]);

  const toggleDisplayFullScreen = useCallback(async () => {
    if (isElectron && window.electronAPI) {
      await window.electronAPI.toggleDisplayFullScreen();
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    }
  }, [isElectron]);

  const openGameFile = useCallback(async (): Promise<GameConfig | null> => {
    if (isElectron && window.electronAPI) {
      return await window.electronAPI.openGameFile();
    }

    // Modern browser File System Access API
    if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
      try {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: 'Jeopardy Game YAML (*.yaml, *.yml)',
              accept: { 'text/yaml': ['.yaml', '.yml'] },
            },
          ],
          multiple: false,
        });
        const file = await fileHandle.getFile();
        const text = await file.text();
        return parseGameConfigFromYaml(text);
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return null;
        }
        console.error('Failed to open file via showOpenFilePicker:', err);
        return null;
      }
    }

    // Browser file input fallback
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.yaml,.yml';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const parsed = parseGameConfigFromYaml(
              evt.target?.result as string
            );
            resolve(parsed);
          } catch {
            resolve(null);
          }
        };
        reader.readAsText(file);
      };
      input.oncancel = () => {
        resolve(null);
      };
      input.click();
    });
  }, [isElectron]);

  const saveGameFile = useCallback(
    async (config: GameConfig): Promise<boolean> => {
      if (isElectron && window.electronAPI) {
        return await window.electronAPI.saveGameFile(config);
      }

      const yamlContent = serializeGameConfigToYaml(config);
      const rawTitle = config.title?.trim();
      const safeTitle = rawTitle
        ? rawTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
        : 'jeopardy';
      const fileName = `${safeTitle || 'jeopardy'}_game.yaml`;

      // Modern browser File System Access API
      if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [
              {
                description: 'Jeopardy Game YAML (*.yaml, *.yml)',
                accept: {
                  'application/yaml': ['.yaml', '.yml'],
                  'text/yaml': ['.yaml', '.yml'],
                  'application/x-yaml': ['.yaml', '.yml'],
                  'text/plain': ['.yaml', '.yml'],
                },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(yamlContent);
          await writable.close();
          return true;
        } catch (err: any) {
          // If the user cancelled the dialog, return false so state stays unsaved
          if (err?.name === 'AbortError') {
            return false;
          }
          console.warn(
            'showSaveFilePicker failed, falling back to download:',
            err
          );
          // Fall through to download fallback
        }
      }

      // Browser download fallback
      try {
        const blob = new Blob([yamlContent], {
          type: 'application/yaml;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Delay revoke so browser can begin reading the blob
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
      } catch (err) {
        console.error('Download fallback error:', err);
        return false;
      }
    },
    [isElectron]
  );

  const selectMediaFile = useCallback(
    async (type: 'image' | 'audio' | 'video'): Promise<string | null> => {
      if (isElectron && window.electronAPI) {
        return await window.electronAPI.selectMediaFile(type);
      } else {
        // Browser file to data URL fallback
        return new Promise((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept =
            type === 'image'
              ? 'image/*'
              : type === 'audio'
                ? 'audio/*'
                : 'video/*';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return resolve(null);
            const reader = new FileReader();
            reader.onload = (evt) => {
              resolve(evt.target?.result as string);
            };
            reader.readAsDataURL(file);
          };
          input.click();
        });
      }
    },
    [isElectron]
  );

  const toMediaUrl = useCallback(
    (filePath: string): string => {
      if (!filePath) return '';
      if (isElectron && window.electronAPI) {
        return window.electronAPI.toMediaUrl(filePath);
      }
      if (
        filePath.startsWith('http://') ||
        filePath.startsWith('https://') ||
        filePath.startsWith('data:')
      ) {
        return filePath;
      }
      // Web browser mode: normalize relative path for static serving from public/
      return filePath.startsWith('/') ? filePath : `/${filePath}`;
    },
    [isElectron]
  );

  return {
    state,
    dispatch,
    openDisplayWindow,
    toggleDisplayFullScreen,
    openGameFile,
    saveGameFile,
    selectMediaFile,
    toMediaUrl,
    isElectron,
  };
}

import { contextBridge, ipcRenderer } from 'electron';
import {
  GameAction,
  GameConfig,
  GameState,
  ServerInfo,
} from '../src/types/game';

const api = {
  getServerInfo: (): Promise<ServerInfo> =>
    ipcRenderer.invoke('get-server-info'),
  getState: (): Promise<GameState> => ipcRenderer.invoke('get-game-state'),
  dispatchAction: (action: GameAction): Promise<void> =>
    ipcRenderer.invoke('dispatch-action', action),
  onStateUpdate: (callback: (state: GameState) => void) => {
    const handler = (_event: unknown, state: GameState) => callback(state);
    ipcRenderer.on('state-updated', handler);
    return () => {
      ipcRenderer.removeListener('state-updated', handler);
    };
  },
  openDisplayWindow: (): Promise<void> =>
    ipcRenderer.invoke('open-display-window'),
  toggleDisplayFullScreen: (): Promise<void> =>
    ipcRenderer.invoke('toggle-display-fullscreen'),
  openGameFile: (): Promise<GameConfig | null> =>
    ipcRenderer.invoke('open-game-file'),
  saveGameFile: (config: GameConfig): Promise<boolean> =>
    ipcRenderer.invoke('save-game-file', config),
  selectMediaFile: (
    type: 'image' | 'audio' | 'video'
  ): Promise<string | null> => ipcRenderer.invoke('select-media-file', type),
  toMediaUrl: (filePath: string): string => {
    if (!filePath) return '';
    if (
      filePath.startsWith('http://') ||
      filePath.startsWith('https://') ||
      filePath.startsWith('data:')
    ) {
      return filePath;
    }
    // Encode for custom protocol: media://local-file/<path>
    const normalized = filePath.replace(/\\/g, '/');
    return `media://local-file/${encodeURI(normalized.startsWith('/') ? normalized.slice(1) : normalized)}`;
  },
  writeTraceLog: (entry: string): Promise<void> =>
    ipcRenderer.invoke('write-trace-log', entry),
};

contextBridge.exposeInMainWorld('electronAPI', api);

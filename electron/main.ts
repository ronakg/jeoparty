import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  net,
  nativeImage,
} from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initialGameState, gameReducer } from '../src/utils/gameReducer';
import { GameAction, GameConfig, GameState } from '../src/types/game';
import {
  serializeGameConfigToYaml,
  parseGameConfigFromYaml,
} from '../src/utils/gameYaml';

app.name = 'JeoPARTY!';
if (typeof app.setName === 'function') {
  app.setName('JeoPARTY!');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let adminWindow: BrowserWindow | null = null;
let displayWindow: BrowserWindow | null = null;

let currentState: GameState = { ...initialGameState };

function appendTraceLog(line: string) {
  try {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, 'jeoparty-trace.log');
    fs.appendFileSync(logFile, line + '\n', 'utf8');
  } catch {
    // Ignore logging failures to avoid impacting app execution
  }
}

function broadcastState() {
  const payload: GameState = {
    ...currentState,
    displayWindowOpen: displayWindow !== null && !displayWindow.isDestroyed(),
  };

  const time = new Date().toISOString().slice(11, 23);
  const status =
    `t1=${currentState.team1Score}, t2=${currentState.team2Score}, ` +
    `coWin=${Boolean(currentState.coWinnersDeclared)}, ` +
    `displayOpen=${payload.displayWindowOpen}`;
  appendTraceLog(`[${time}] [MAIN] [STATE_BROADCAST] ${status}`);

  if (adminWindow && !adminWindow.isDestroyed()) {
    adminWindow.webContents.send('state-updated', payload);
  }
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.webContents.send('state-updated', payload);
  }
}

function createAdminWindow() {
  adminWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1080,
    minHeight: 700,
    title: 'JeoPARTY! - Host Admin Console',
    icon: path.join(__dirname, '../build/icon.png'),
    backgroundColor: '#050b14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  adminWindow.maximize();

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  if (isDev) {
    adminWindow.loadURL('http://localhost:5173/?view=admin');
  } else {
    adminWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { view: 'admin' },
    });
  }

  adminWindow.on('closed', () => {
    adminWindow = null;
    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.close();
    }
  });
}

function createDisplayWindow() {
  if (displayWindow && !displayWindow.isDestroyed()) {
    if (displayWindow.isMinimized()) {
      displayWindow.restore();
    }
    displayWindow.maximize();
    displayWindow.show();
    displayWindow.focus();
    return;
  }

  displayWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 1024,
    minHeight: 680,
    title: 'JeoPARTY! - Player Display Board',
    icon: path.join(__dirname, '../build/icon.png'),
    backgroundColor: '#060ce9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  displayWindow.maximize();

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;
  if (isDev) {
    displayWindow.loadURL('http://localhost:5173/?view=display');
  } else {
    displayWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { view: 'display' },
    });
  }

  displayWindow.on('closed', () => {
    displayWindow = null;
    broadcastState();
  });

  displayWindow.webContents.on('did-finish-load', () => {
    broadcastState();
  });
}

// Register media:// custom protocol for local media streaming
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) {
    const candidates = [
      path.join(__dirname, '../build/icon.icns'),
      path.join(__dirname, '../build/icon.png'),
      path.join(app.getAppPath(), 'build/icon.icns'),
      path.join(app.getAppPath(), 'build/icon.png'),
      path.join(__dirname, '../public/app-icon.png'),
      path.join(app.getAppPath(), 'public/app-icon.png'),
    ];
    for (const iconPath of candidates) {
      if (fs.existsSync(iconPath)) {
        const icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty()) {
          app.dock.setIcon(icon);
          break;
        }
      }
    }
  }

  // Protocol handler for media://local-file/<path>
  protocol.handle('media', (request) => {
    try {
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname);
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }

      // If not directly on disk, search relative to project root or resources
      if (!fs.existsSync(filePath)) {
        const cleanPath = filePath.replace(/^\/+/, '');
        const candidate1 = path.join(app.getAppPath(), cleanPath);
        const candidate2 = path.join(process.cwd(), cleanPath);
        const candidate3 = path.join(app.getAppPath(), 'resources', cleanPath);
        const candidate4 = path.join(process.cwd(), 'resources', cleanPath);

        if (fs.existsSync(candidate1)) {
          filePath = candidate1;
        } else if (fs.existsSync(candidate2)) {
          filePath = candidate2;
        } else if (fs.existsSync(candidate3)) {
          filePath = candidate3;
        } else if (fs.existsSync(candidate4)) {
          filePath = candidate4;
        }
      }

      const fileUrl = new URL(`file://${filePath}`).toString();
      return net.fetch(fileUrl);
    } catch {
      return new Response('Media file not found', { status: 404 });
    }
  });

  createDisplayWindow();
  createAdminWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDisplayWindow();
      createAdminWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const processedActionIds = new Set<string>();
const actionIdQueue: string[] = [];

// IPC Handlers
ipcMain.handle('get-game-state', () => {
  return {
    ...currentState,
    displayWindowOpen: displayWindow !== null && !displayWindow.isDestroyed(),
  };
});

ipcMain.handle('dispatch-action', (_event, action: GameAction) => {
  const actionId = action._actionId;
  if (actionId) {
    if (processedActionIds.has(actionId)) {
      const time = new Date().toISOString().slice(11, 23);
      appendTraceLog(
        `[${time}] [MAIN] [DROP_DUPLICATE] Action: ${action.type} | ` +
          `id: ${actionId}`
      );
      return;
    }
    processedActionIds.add(actionId);
    actionIdQueue.push(actionId);
    if (actionIdQueue.length > 200) {
      const oldest = actionIdQueue.shift();
      if (oldest) processedActionIds.delete(oldest);
    }
  }

  const time = new Date().toISOString().slice(11, 23);
  appendTraceLog(
    `[${time}] [MAIN] [IPC_DISPATCH] Action: ${action.type} | ` +
      `payload: ${JSON.stringify(action)}`
  );
  currentState = gameReducer(currentState, action);
  broadcastState();
});

ipcMain.handle('write-trace-log', (_event, entry: string) => {
  appendTraceLog(entry);
});

ipcMain.handle('open-display-window', () => {
  createDisplayWindow();
});

ipcMain.handle('toggle-display-fullscreen', () => {
  if (displayWindow && !displayWindow.isDestroyed()) {
    const isFullScreen = displayWindow.isFullScreen();
    displayWindow.setFullScreen(!isFullScreen);
  }
});

ipcMain.handle('open-game-file', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || adminWindow;
  if (!win) return null;
  const result = await dialog.showOpenDialog(win, {
    title: 'Open Jeopardy Game File',
    filters: [{ name: 'Jeopardy Game YAML', extensions: ['yaml', 'yml'] }],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  try {
    const content = fs.readFileSync(result.filePaths[0], 'utf-8');
    const parsed = parseGameConfigFromYaml(content);
    return parsed;
  } catch (err) {
    console.error('Failed to parse game YAML:', err);
    return null;
  }
});

ipcMain.handle('save-game-file', async (event, config: GameConfig) => {
  const win = BrowserWindow.fromWebContents(event.sender) || adminWindow;
  if (!win) return false;
  const rawTitle = config.title?.trim();
  const safeTitle = rawTitle
    ? rawTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    : 'jeopardy';
  const defaultPath = `${safeTitle || 'jeopardy'}_game.yaml`;

  const result = await dialog.showSaveDialog(win, {
    title: 'Save Jeopardy Game File',
    defaultPath,
    filters: [{ name: 'Jeopardy Game YAML', extensions: ['yaml', 'yml'] }],
  });

  if (result.canceled || !result.filePath) {
    return false;
  }

  let filePath = result.filePath;
  if (!filePath.endsWith('.yaml') && !filePath.endsWith('.yml')) {
    filePath += '.yaml';
  }

  try {
    fs.writeFileSync(filePath, serializeGameConfigToYaml(config), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save game YAML:', err);
    return false;
  }
});

ipcMain.handle(
  'select-media-file',
  async (event, type: 'image' | 'audio' | 'video') => {
    const win = BrowserWindow.fromWebContents(event.sender) || adminWindow;
    if (!win) return null;

    let filters: { name: string; extensions: string[] }[] = [];
    if (type === 'image') {
      filters = [
        {
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'],
        },
      ];
    } else if (type === 'audio') {
      filters = [
        {
          name: 'Audio Files',
          extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'],
        },
      ];
    } else if (type === 'video') {
      filters = [
        { name: 'Video Files', extensions: ['mp4', 'webm', 'mov', 'mkv'] },
      ];
    }

    const result = await dialog.showOpenDialog(win, {
      title: `Select ${type.toUpperCase()} File`,
      filters,
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  }
);

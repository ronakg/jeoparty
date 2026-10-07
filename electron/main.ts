import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  nativeImage,
  session,
  shell,
  net,
} from 'electron';
import http from 'http';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { initialGameState, gameReducer } from '../src/utils/gameReducer';
import {
  GameAction,
  GameConfig,
  GameState,
  ServerInfo,
} from '../src/types/game';
import {
  serializeGameConfigToYaml,
  parseGameConfigFromYaml,
} from '../src/utils/gameYaml';
import {
  createGameArchive,
  extractGameArchive,
  cleanupActiveTempDirs,
} from './archive';

app.name = 'JeoPARTY!';
if (typeof app.setName === 'function') {
  app.setName('JeoPARTY!');
}
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let adminWindow: BrowserWindow | null = null;
let displayWindow: BrowserWindow | null = null;
let activeGameDirectory: string | null = null;

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

const sseClients = new Set<http.ServerResponse>();

function broadcastSse(data: unknown) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
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
  broadcastSse({ type: 'state', state: payload });
}

function getWindowIconPath(): string {
  const candidates = [
    path.join(__dirname, '../build/icon.png'),
    path.join(app.getAppPath(), 'build/icon.png'),
    path.join(process.resourcesPath, 'icon.png'),
    path.join(__dirname, '../public/app-icon.png'),
    path.join(app.getAppPath(), 'public/app-icon.png'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || '';
}

function getTitleBarConfig() {
  if (process.platform === 'darwin') {
    return {
      titleBarStyle: 'hidden' as const,
      trafficLightPosition: { x: 16, y: 16 },
    };
  }
  if (process.platform === 'win32' || process.platform === 'linux') {
    return {
      titleBarStyle: 'hidden' as const,
      titleBarOverlay: {
        color: '#0b1426',
        symbolColor: '#cbd5e1',
        height: 48,
      },
    };
  }
  return {};
}

function createAdminWindow() {
  adminWindow = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 720,
    minHeight: 500,
    title: 'JeoPARTY! - Host Admin Console',
    icon: getWindowIconPath(),
    backgroundColor: '#050b14',
    ...getTitleBarConfig(),
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
  } else if (currentServerPort > 0) {
    adminWindow.loadURL(`http://127.0.0.1:${currentServerPort}/?view=admin`);
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
    minWidth: 720,
    minHeight: 500,
    title: 'JeoPARTY! - Player Display Board',
    icon: getWindowIconPath(),
    backgroundColor: '#070d1e',
    ...getTitleBarConfig(),
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
  } else if (currentServerPort > 0) {
    displayWindow.loadURL(
      `http://127.0.0.1:${currentServerPort}/?view=display`
    );
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

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.wasm': 'application/wasm',
};

// Register media:// custom protocol for local media streaming
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
      bypassCSP: true,
    },
  },
]);

app.whenReady().then(async () => {
  if (process.platform === 'darwin' && app.dock) {
    const candidates = [
      path.join(process.resourcesPath, 'icon.icns'),
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
  protocol.handle('media', async (request) => {
    try {
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname);
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }

      // If not on disk, search relative to active game, project, or resources
      if (!fs.existsSync(filePath)) {
        const cleanPath = filePath.replace(/^\/+/, '');
        const candidateActive =
          activeGameDirectory && path.join(activeGameDirectory, cleanPath);
        const candidate1 = path.join(app.getAppPath(), cleanPath);
        const candidate2 = path.join(process.cwd(), cleanPath);
        const candidate3 = path.join(app.getAppPath(), 'resources', cleanPath);
        const candidate4 = path.join(process.cwd(), 'resources', cleanPath);

        if (candidateActive && fs.existsSync(candidateActive)) {
          filePath = candidateActive;
        } else if (fs.existsSync(candidate1)) {
          filePath = candidate1;
        } else if (fs.existsSync(candidate2)) {
          filePath = candidate2;
        } else if (fs.existsSync(candidate3)) {
          filePath = candidate3;
        } else if (fs.existsSync(candidate4)) {
          filePath = candidate4;
        }
      }

      appendTraceLog(
        `[PROTOCOL] URL: ${request.url} | ` +
          `range: ${request.headers.get('range') || 'none'}`
      );

      if (!fs.existsSync(filePath)) {
        appendTraceLog(`[PROTOCOL] File not found: ${filePath}`);
        return new Response('Media file not found', { status: 404 });
      }

      const stat = fs.statSync(filePath);
      appendTraceLog(
        `[PROTOCOL] Serving via net.fetch: ${filePath} (${stat.size} bytes)`
      );
      const fileUrl = pathToFileURL(filePath).toString();

      try {
        return await net.fetch(fileUrl, {
          bypassCustomProtocolHandlers: true,
        });
      } catch (fetchErr) {
        const errMsg =
          fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        appendTraceLog(`[PROTOCOL] net.fetch failed: ${errMsg}`);
        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        return new Response(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(fileBuffer.byteLength),
            'Accept-Ranges': 'bytes',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      appendTraceLog(`[PROTOCOL] Handler error: ${errMsg}`);
      return new Response('Media file not found', { status: 404 });
    }
  });

  await startHttpServer();
  setupWebRequestInterceptors();
  createDisplayWindow();
  createAdminWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createDisplayWindow();
      createAdminWindow();
    }
  });
});

app.on('before-quit', () => {
  cleanupActiveTempDirs();
  if (httpServer) {
    httpServer.close();
    httpServer = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function getLanIp(): string {
  const ifaces = os.networkInterfaces();
  const candidates: { address: string; score: number }[] = [];

  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const addr = iface.address;
        const isPhysical = /^(en|eth|wlan)/i.test(name);
        let score = 0;
        if (isPhysical) score += 10;
        if (addr.startsWith('192.168.')) score += 5;
        else if (addr.startsWith('10.')) score += 4;
        else if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(addr)) score += 3;
        if (addr.startsWith('169.254.') || addr.startsWith('100.')) {
          score -= 10;
        }
        candidates.push({ address: addr, score });
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].address;
  }
  return '127.0.0.1';
}

let httpServer: http.Server | null = null;
let currentServerPort = 5173;

function getServerInfo(): ServerInfo {
  const lanIp = getLanIp();
  return {
    lanIp,
    port: currentServerPort,
    hostUrl: `http://${lanIp}:${currentServerPort}/?view=admin`,
    displayUrl: `http://${lanIp}:${currentServerPort}/?view=display`,
  };
}

function findDistDir(): string {
  const candidateDirs = [
    path.join(__dirname, '../dist'),
    path.join(__dirname, 'dist'),
    path.join(app.getAppPath(), 'dist'),
  ];
  for (const dir of candidateDirs) {
    if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'index.html'))) {
      return dir;
    }
  }
  return path.join(__dirname, '../dist');
}

function readJsonBody<T = unknown>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function serveStaticFile(
  res: http.ServerResponse,
  distDir: string,
  urlPath: string
) {
  let relativePath = urlPath;
  try {
    relativePath = decodeURIComponent(urlPath);
  } catch {
    // Keep unencoded
  }

  if (relativePath === '/' || relativePath === '') {
    relativePath = '/index.html';
  }

  const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(distDir, safePath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Server error');
    }
  });
}

function startHttpServer(preferredPort = 5173): Promise<number> {
  return new Promise((resolve) => {
    const distDir = findDistDir();

    const tryListen = (port: number) => {
      const server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Cache-Control, Accept'
        );

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        const hostHeader = req.headers.host || `127.0.0.1:${currentServerPort}`;
        const parsedUrl = new URL(req.url || '/', `http://${hostHeader}`);
        const pathname = parsedUrl.pathname;

        if (pathname === '/api/server-info') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(getServerInfo()));
          return;
        }

        if (pathname === '/api/events') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          });
          res.write(
            `data: ${JSON.stringify({
              type: 'state',
              state: {
                ...currentState,
                displayWindowOpen:
                  displayWindow !== null && !displayWindow.isDestroyed(),
              },
            })}\n\n`
          );
          sseClients.add(res);
          req.on('close', () => {
            sseClients.delete(res);
          });
          return;
        }

        if (pathname === '/api/state') {
          if (req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: true,
                state: {
                  ...currentState,
                  displayWindowOpen:
                    displayWindow !== null && !displayWindow.isDestroyed(),
                },
              })
            );
            return;
          }
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        if (pathname === '/api/action') {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method not allowed');
            return;
          }
          try {
            const body = await readJsonBody<{
              action?: GameAction;
            }>(req);
            if (body?.action) {
              applyAction(body.action, 'HTTP');
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, state: currentState }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: String(err) }));
          }
          return;
        }

        serveStaticFile(res, distDir, pathname);
      });

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          appendTraceLog(`[MAIN] Port ${port} in use, trying next port`);
          if (port > 0 && port < 5180) {
            tryListen(port + 1);
          } else if (port > 0) {
            tryListen(0);
          } else {
            resolve(0);
          }
        } else {
          appendTraceLog(`[MAIN] HTTP server error: ${err.message}`);
          resolve(0);
        }
      });

      server.listen(port, '0.0.0.0', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          currentServerPort = address.port;
        }
        httpServer = server;
        appendTraceLog(
          `[MAIN] HTTP server listening on 0.0.0.0:${currentServerPort}`
        );
        resolve(currentServerPort);
      });
    };

    tryListen(preferredPort);
  });
}

function setupWebRequestInterceptors() {
  session.defaultSession.webRequest.onBeforeSendHeaders(
    {
      urls: [
        '*://*.youtube.com/*',
        '*://*.youtube-nocookie.com/*',
        '*://*.googlevideo.com/*',
      ],
    },
    (details, callback) => {
      const headers = { ...details.requestHeaders };
      const fallbackOrigin =
        currentServerPort > 0
          ? `http://127.0.0.1:${currentServerPort}`
          : 'https://www.youtube.com';

      if (!headers['Referer'] || headers['Referer'].startsWith('file://')) {
        headers['Referer'] = `${fallbackOrigin}/`;
      }
      if (
        !headers['Origin'] ||
        headers['Origin'] === 'file://' ||
        headers['Origin'] === 'null'
      ) {
        headers['Origin'] = fallbackOrigin;
      }
      callback({ requestHeaders: headers });
    }
  );
}

const processedActionIds = new Set<string>();
const actionIdQueue: string[] = [];

function applyAction(action: GameAction, source = 'IPC') {
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
    `[${time}] [MAIN] [${source}_DISPATCH] Action: ${action.type} | ` +
      `payload: ${JSON.stringify(action)}`
  );
  currentState = gameReducer(currentState, action);
  broadcastState();
}

// IPC Handlers
ipcMain.handle('get-server-info', () => {
  return getServerInfo();
});

ipcMain.handle('get-game-state', () => {
  return {
    ...currentState,
    displayWindowOpen: displayWindow !== null && !displayWindow.isDestroyed(),
  };
});

ipcMain.handle('dispatch-action', (_event, action: GameAction) => {
  applyAction(action, 'IPC');
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
    title: 'Open Jeopardy Game Package',
    filters: [{ name: 'Jeopardy Game Package', extensions: ['jeopardy'] }],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  try {
    const archiveResult = await extractGameArchive(result.filePaths[0]);
    activeGameDirectory = archiveResult.extractedDir;
    const content = fs.readFileSync(archiveResult.yamlPath, 'utf-8');
    const parsed = parseGameConfigFromYaml(content);
    return parsed;
  } catch (err) {
    console.error('Failed to open game package:', err);
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
  const defaultPath = `${safeTitle || 'jeopardy'}.jeopardy`;

  const result = await dialog.showSaveDialog(win, {
    title: 'Save Jeopardy Game Package',
    defaultPath,
    filters: [{ name: 'Jeopardy Game Package', extensions: ['jeopardy'] }],
  });

  if (result.canceled || !result.filePath) {
    return false;
  }

  let filePath = result.filePath;
  if (!filePath.endsWith('.jeopardy')) {
    filePath += '.jeopardy';
  }

  try {
    const mediaFiles = new Map<string, string>();
    const clonedConfig: GameConfig = JSON.parse(JSON.stringify(config));

    let mediaCounter = 1;
    const processClueMedia = (media?: { type: string; urlOrPath: string }) => {
      if (!media || media.type === 'none' || !media.urlOrPath) {
        return;
      }
      const rawUrl = media.urlOrPath.trim();
      if (
        rawUrl.startsWith('http://') ||
        rawUrl.startsWith('https://') ||
        rawUrl.startsWith('data:')
      ) {
        return;
      }

      let sourceDiskPath = rawUrl;
      if (
        !fs.existsSync(sourceDiskPath) &&
        activeGameDirectory &&
        fs.existsSync(path.join(activeGameDirectory, rawUrl))
      ) {
        sourceDiskPath = path.join(activeGameDirectory, rawUrl);
      }

      if (fs.existsSync(sourceDiskPath)) {
        const ext = path.extname(sourceDiskPath) || '';
        const base = path.basename(sourceDiskPath, ext);
        const cleanBase = base.replace(/[^a-zA-Z0-9_-]+/g, '_');
        const safeBase = `${cleanBase}_${mediaCounter++}${ext}`;
        const archiveRelPath = `media/${safeBase}`;
        mediaFiles.set(archiveRelPath, sourceDiskPath);
        media.urlOrPath = archiveRelPath;
      }
    };

    if (clonedConfig.rounds) {
      for (const round of clonedConfig.rounds) {
        if (round.categories) {
          for (const cat of round.categories) {
            if (cat.clues) {
              for (const clue of cat.clues) {
                if (clue.media) {
                  processClueMedia(clue.media);
                }
              }
            }
          }
        }
      }
    }

    if (clonedConfig.finalJeopardy?.media) {
      processClueMedia(clonedConfig.finalJeopardy.media);
    }

    const serializedYaml = serializeGameConfigToYaml(clonedConfig);
    await createGameArchive(filePath, serializedYaml, mediaFiles);

    const reloaded = await extractGameArchive(filePath);
    activeGameDirectory = reloaded.extractedDir;

    return true;
  } catch (err) {
    console.error('Failed to save game package:', err);
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

ipcMain.handle('open-external-url', async (_event, url: string) => {
  if (
    typeof url === 'string' &&
    (url.startsWith('http://') || url.startsWith('https://'))
  ) {
    await shell.openExternal(url);
  }
});

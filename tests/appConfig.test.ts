import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { patchPlistContent } from '../scripts/patchElectronDevApp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

test('App Config: package.json specifies JeoPARTY! branding', () => {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

  assert.equal(pkg.productName, 'JeoPARTY!');
  assert.equal(pkg.build?.productName, 'JeoPARTY!');
  assert.equal(pkg.build?.appId, 'com.jeoparty.desktop');
  assert.equal(pkg.build?.mac?.icon, 'build/icon.icns');
  assert.equal(pkg.build?.win?.icon, 'build/icon.ico');
  assert.equal(pkg.build?.executableName, 'JeoPARTY');
  assert.equal(pkg.build?.afterPack, 'scripts/afterPack.cjs');
  assert.ok(
    fs.existsSync(path.join(rootDir, 'scripts/afterPack.cjs')),
    'scripts/afterPack.cjs must exist'
  );
});

test('App Config: main.ts configures JeoPARTY! app name and dock', () => {
  const mainTsPath = path.join(rootDir, 'electron/main.ts');
  const mainTs = fs.readFileSync(mainTsPath, 'utf-8');

  assert.ok(
    mainTs.includes("app.name = 'JeoPARTY!'"),
    'main.ts must set app.name to JeoPARTY!'
  );
  assert.ok(
    mainTs.includes("app.setName('JeoPARTY!')"),
    'main.ts must call app.setName'
  );
  assert.ok(
    mainTs.includes('app.dock.setIcon'),
    'main.ts must configure macOS dock icon'
  );
});

test('App Config: patchPlistContent updates display & bundle name', () => {
  const samplePlist = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<dict>',
    '\t<key>CFBundleDisplayName</key>',
    '\t<string>Electron</string>',
    '\t<key>CFBundleExecutable</key>',
    '\t<string>Electron</string>',
    '\t<key>CFBundleName</key>',
    '\t<string>Electron</string>',
    '</dict>',
  ].join('\n');

  const patched = patchPlistContent(samplePlist, 'JeoPARTY!');
  const expectedDisplay =
    '<key>CFBundleDisplayName</key>\n\t<string>JeoPARTY!</string>';
  const expectedName = '<key>CFBundleName</key>\n\t<string>JeoPARTY!</string>';
  const expectedExec =
    '<key>CFBundleExecutable</key>\n\t<string>Electron</string>';

  assert.ok(patched.includes(expectedDisplay));
  assert.ok(patched.includes(expectedName));
  assert.ok(patched.includes(expectedExec));
});

test('App Assets: Required icons and vector assets exist', () => {
  const assets = [
    'public/logo.svg',
    'public/app-icon.png',
    'public/favicon.png',
    'build/icon.icns',
    'build/icon.png',
    'build/icon.ico',
  ];

  for (const asset of assets) {
    const fullPath = path.join(rootDir, asset);
    assert.ok(fs.existsSync(fullPath), `Asset ${asset} must exist`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 0, `Asset ${asset} must not be empty`);
  }
});

test('App Startup: main.ts launches player display and admin windows', () => {
  const mainTsPath = path.join(rootDir, 'electron/main.ts');
  const mainTs = fs.readFileSync(mainTsPath, 'utf-8');

  const readyIdx = mainTs.indexOf('app.whenReady()');
  assert.ok(readyIdx !== -1, 'app.whenReady block must exist');

  const afterReady = mainTs.slice(readyIdx);
  const displayIdx = afterReady.indexOf('createDisplayWindow();');
  const adminIdx = afterReady.indexOf('createAdminWindow();');

  assert.ok(displayIdx !== -1, 'createDisplayWindow must be called on launch');
  assert.ok(adminIdx !== -1, 'createAdminWindow must be called on launch');
  assert.ok(
    displayIdx < adminIdx,
    'createDisplayWindow must precede createAdminWindow so admin stays focused'
  );
});

test('App Assets: build/icon.icns and build/icon.png have HIG framing', () => {
  const icnsPath = path.join(rootDir, 'build/icon.icns');
  const pngPath = path.join(rootDir, 'build/icon.png');
  const mainTsPath = path.join(rootDir, 'electron/main.ts');

  assert.ok(fs.existsSync(icnsPath), 'build/icon.icns must exist');
  assert.ok(fs.existsSync(pngPath), 'build/icon.png must exist');

  const icnsStat = fs.statSync(icnsPath);
  const pngStat = fs.statSync(pngPath);

  // Multi-resolution icns and framed 1024x1024 png must be non-empty
  assert.ok(icnsStat.size > 500000, 'icon.icns should be complete multi-res');
  assert.ok(pngStat.size > 500000, 'icon.png should be high-res');

  const mainTs = fs.readFileSync(mainTsPath, 'utf-8');
  const framedIdx = mainTs.indexOf('build/icon.png');
  const rawIdx = mainTs.indexOf('public/app-icon.png');

  assert.ok(
    framedIdx !== -1 && framedIdx < rawIdx,
    'main.ts must prioritize framed HIG icon over raw full-bleed icon'
  );
});

test('App Config: main.ts configures cross-platform title bar options', () => {
  const mainTsPath = path.join(rootDir, 'electron/main.ts');
  const mainTs = fs.readFileSync(mainTsPath, 'utf-8');

  assert.ok(
    mainTs.includes('function getTitleBarConfig()'),
    'main.ts must define getTitleBarConfig'
  );
  assert.ok(
    mainTs.includes("titleBarStyle: 'hidden'"),
    'main.ts must set hidden titleBarStyle'
  );
  assert.ok(
    mainTs.includes('trafficLightPosition: { x: 16, y: 16 }'),
    'main.ts must configure macOS trafficLightPosition'
  );
  assert.ok(
    mainTs.includes('titleBarOverlay:'),
    'main.ts must configure Windows/Linux titleBarOverlay'
  );
  assert.ok(
    mainTs.includes("color: '#0b1426'"),
    'titleBarOverlay must match header theme background'
  );

  const adminBlock = mainTs.slice(mainTs.indexOf('function createAdminWindow'));
  assert.ok(
    adminBlock.includes('...getTitleBarConfig()'),
    'adminWindow must apply custom title bar'
  );

  const displayBlock = mainTs.slice(
    mainTs.indexOf('function createDisplayWindow')
  );
  assert.ok(
    displayBlock.includes('...getTitleBarConfig()'),
    'displayWindow must apply custom title bar'
  );
});

test('App Config: preload.ts exposes process.platform on electronAPI', () => {
  const preloadPath = path.join(rootDir, 'electron/preload.ts');
  const preloadTs = fs.readFileSync(preloadPath, 'utf-8');

  assert.ok(
    preloadTs.includes('platform: process.platform'),
    'preload.ts must expose platform property'
  );
});

test(
  'App Config: index.css defines drag regions and platform clearance',
  () => {
  const cssPath = path.join(rootDir, 'src/index.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  assert.ok(
    css.includes('.titlebar-drag'),
    'index.css must define .titlebar-drag'
  );
  assert.ok(
    css.includes('-webkit-app-region: drag'),
    'titlebar-drag must set -webkit-app-region: drag'
  );
  assert.ok(
    css.includes('-webkit-app-region: no-drag'),
    'interactive elements must set -webkit-app-region: no-drag'
  );
  assert.ok(
    css.includes("[data-platform='darwin'] .titlebar-pad"),
    'index.css must define macOS left padding clearance'
  );
  assert.ok(
    css.includes("[data-platform='win32'] .titlebar-pad"),
    'index.css must define Windows right padding clearance'
  );
});

test('App Typography: index.html loads modern font suites and weights', () => {
  const htmlPath = path.join(rootDir, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');

  assert.ok(
    html.includes('family=Space+Mono'),
    'index.html must load Space Mono for fixed-pitch elements'
  );
  assert.ok(
    !html.includes('Space+Grotesk'),
    'index.html must not load proportional Space Grotesk'
  );
  assert.ok(
    html.includes('Plus+Jakarta+Sans:wght@400'),
    'index.html must load base weight 400 for Plus Jakarta Sans'
  );
  assert.ok(
    html.includes('family=Fraunces'),
    'index.html must load Fraunces variable serif'
  );
});

test('App Typography: tailwind config defines robust font stacks', () => {
  const tailwindPath = path.join(rootDir, 'tailwind.config.js');
  const tailwind = fs.readFileSync(tailwindPath, 'utf-8');

  assert.ok(
    tailwind.includes('"Space Mono"') && tailwind.includes('"SF Mono"'),
    'mono stack must use Space Mono with native SF Mono fallback'
  );
  assert.ok(
    tailwind.includes('"New York"') && tailwind.includes('"Fraunces"'),
    'serif stack must include Fraunces and New York'
  );
  assert.ok(
    tailwind.includes('"SF Pro Display"') && tailwind.includes('"Outfit"'),
    'display stack must include Outfit and SF Pro Display'
  );
});

test('App Typography: index.css sets optical sizing and cleans CSS', () => {
  const cssPath = path.join(rootDir, 'src/index.css');
  const css = fs.readFileSync(cssPath, 'utf-8');

  assert.ok(
    css.includes('.font-serif') && css.includes('font-optical-sizing: auto'),
    'index.css must configure optical sizing for serif typography'
  );
  assert.ok(
    !css.includes('.font-num'),
    'index.css must not retain unused .font-num class'
  );
});

test('App Typography: source files contain zero fixed-width font-mono', () => {
  const srcDir = path.join(rootDir, 'src');
  const getSourceFiles = (dir: string): string[] => {
    let files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(getSourceFiles(fullPath));
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        files.push(fullPath);
      }
    }
    return files;
  };

  const sourceFiles = getSourceFiles(srcDir);
  assert.ok(sourceFiles.length > 0, 'Must find source files in src/');
  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(rootDir, filePath);
    assert.ok(
      !content.includes('font-mono'),
      `File ${relativePath} must not contain font-mono`
    );
  }
});

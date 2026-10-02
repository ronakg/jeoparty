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

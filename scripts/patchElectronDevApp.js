import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function patchPlistContent(content, appName = 'JeoPARTY!') {
  let updated = content;
  // Replace CFBundleDisplayName
  updated = updated.replace(
    /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]+(<\/string>)/,
    `$1${appName}$2`
  );
  // Replace CFBundleName
  updated = updated.replace(
    /(<key>CFBundleName<\/key>\s*<string>)[^<]+(<\/string>)/,
    `$1${appName}$2`
  );
  return updated;
}

// Renders an 824x824 squircle centered on a 1024x1024 transparent canvas
// with subtle drop shadow adhering to macOS Big Sur+ HIG icon metrics.
export function frameMacIcon(srcPng, destPng) {
  if (process.platform !== 'darwin' || !fs.existsSync(srcPng)) {
    return false;
  }

  const script = `
ObjC.import('AppKit');
ObjC.import('Foundation');

var srcPath = '${srcPng}';
var outPath = '${destPng}';

var srcImage = $.NSImage.alloc.initWithContentsOfFile(srcPath);
if (!srcImage) $.exit(1);

var canvasSize = $.NSMakeSize(1024, 1024);
var targetSize = $.NSMakeSize(824, 824);
var origin = $.NSMakePoint(100, 100);

var newImage = $.NSImage.alloc.initWithSize(canvasSize);
newImage.lockFocus;

var shadow = $.NSShadow.alloc.init;
shadow.shadowColor = $.NSColor.colorWithCalibratedRedGreenBlueAlpha(
  0, 0, 0, 0.28
);
shadow.shadowOffset = $.NSMakeSize(0, -6);
shadow.shadowBlurRadius = 14;
shadow.set;

var destRect = $.NSMakeRect(
  origin.x, origin.y, targetSize.width, targetSize.height
);
var srcRect = $.NSMakeRect(
  0, 0, srcImage.size.width, srcImage.size.height
);

srcImage.drawInRectFromRectOperationFraction(
  destRect,
  srcRect,
  $.NSCompositingOperationSourceOver,
  1.0
);

newImage.unlockFocus;

var tiffData = newImage.TIFFRepresentation;
var bitmap = $.NSBitmapImageRep.alloc.initWithData(tiffData);
var pngData = bitmap.representationUsingTypeProperties(
  $.NSBitmapImageFileTypePNG,
  $.NSDictionary.dictionary
);

pngData.writeToFileAtomically(outPath, true);
`;

  try {
    execFileSync('osascript', ['-l', 'JavaScript', '-e', script], {
      stdio: 'pipe',
    });
    return true;
  } catch (err) {
    console.warn('Failed to frame macOS app icon:', err);
    return false;
  }
}

// Compiles a multi-resolution Apple .icns bundle from a 1024x1024 source PNG
export function buildIcns(sourcePng, outIcns) {
  if (process.platform !== 'darwin' || !fs.existsSync(sourcePng)) {
    return false;
  }

  const iconsetDir = path.join(path.dirname(outIcns), 'icon.iconset');
  try {
    fs.mkdirSync(iconsetDir, { recursive: true });
    const sizes = [
      { name: 'icon_16x16.png', size: 16 },
      { name: 'icon_16x16@2x.png', size: 32 },
      { name: 'icon_32x32.png', size: 32 },
      { name: 'icon_32x32@2x.png', size: 64 },
      { name: 'icon_128x128.png', size: 128 },
      { name: 'icon_128x128@2x.png', size: 256 },
      { name: 'icon_256x256.png', size: 256 },
      { name: 'icon_256x256@2x.png', size: 512 },
      { name: 'icon_512x512.png', size: 512 },
      { name: 'icon_512x512@2x.png', size: 1024 },
    ];
    for (const item of sizes) {
      const outPath = path.join(iconsetDir, item.name);
      execFileSync(
        'sips',
        [
          '-z',
          String(item.size),
          String(item.size),
          sourcePng,
          '--out',
          outPath,
        ],
        { stdio: 'pipe' }
      );
    }
    execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', outIcns], {
      stdio: 'pipe',
    });
    fs.rmSync(iconsetDir, { recursive: true, force: true });
    return true;
  } catch (err) {
    console.warn('Failed to compile icns:', err);
    if (fs.existsSync(iconsetDir)) {
      fs.rmSync(iconsetDir, { recursive: true, force: true });
    }
    return false;
  }
}

export function patchElectronDevApp(projectRoot = path.join(__dirname, '..')) {
  if (process.platform !== 'darwin') {
    return false;
  }

  const electronAppDir = path.join(
    projectRoot,
    'node_modules/electron/dist/Electron.app'
  );
  const infoPlistPath = path.join(electronAppDir, 'Contents/Info.plist');
  const resourcesDir = path.join(electronAppDir, 'Contents/Resources');
  const targetIcnsPath = path.join(resourcesDir, 'electron.icns');
  const sourceIcnsPath = path.join(projectRoot, 'build/icon.icns');

  let patched = false;

  if (fs.existsSync(infoPlistPath)) {
    try {
      const original = fs.readFileSync(infoPlistPath, 'utf-8');
      const updated = patchPlistContent(original, 'JeoPARTY!');
      if (updated !== original) {
        fs.writeFileSync(infoPlistPath, updated, 'utf-8');
        patched = true;
      }
    } catch (err) {
      console.warn('Failed to update Electron.app Info.plist:', err);
    }
  }

  if (fs.existsSync(sourceIcnsPath) && fs.existsSync(resourcesDir)) {
    try {
      fs.copyFileSync(sourceIcnsPath, targetIcnsPath);
      patched = true;
    } catch (err) {
      console.warn('Failed to copy dev icon to Electron.app:', err);
    }
  }

  return patched;
}

// Auto-run if executed directly as a script
if (process.argv[1] === __filename) {
  patchElectronDevApp();
}

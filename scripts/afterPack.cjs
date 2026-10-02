const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Ad-hoc codesign macOS application bundle after packaging.
 * Satisfies Apple Silicon integrity checks when no Developer ID certificate
 * is configured.
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appEntries = fs
    .readdirSync(context.appOutDir)
    .filter((file) => file.endsWith('.app'));

  for (const appName of appEntries) {
    const appPath = path.join(context.appOutDir, appName);
    console.log(`[afterPack] Ad-hoc signing: ${appPath}`);
    execSync(`codesign --force --deep -s - "${appPath}"`, {
      stdio: 'inherit',
    });
  }
};

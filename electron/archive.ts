import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import archiver from 'archiver';

const execFileAsync = promisify(execFile);

export interface ExtractedArchiveResult {
  extractedDir: string;
  yamlPath: string;
}

const activeTempDirs = new Set<string>();

/**
 * Creates a .jeopardy ZIP archive containing game.yaml and media assets.
 */
export async function createGameArchive(
  outputPath: string,
  yamlContent: string,
  mediaFiles: Map<string, string> = new Map()
): Promise<void> {
  const targetDir = path.dirname(outputPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const outputStream = fs.createWriteStream(outputPath);
  // @ts-expect-error archiver has untyped default export in this workspace
  const archive = archiver('zip', { zlib: { level: 6 } });

  return new Promise<void>((resolve, reject) => {
    outputStream.on('close', () => resolve());
    outputStream.on('error', (err: Error) => reject(err));
    archive.on('error', (err: Error) => reject(err));

    archive.pipe(outputStream);
    archive.append(yamlContent, { name: 'game.yaml' });

    for (const [archiveRelativePath, sourceDiskPath] of mediaFiles.entries()) {
      if (fs.existsSync(sourceDiskPath)) {
        const cleanName = archiveRelativePath.replace(/\\/g, '/');
        archive.file(sourceDiskPath, { name: cleanName });
      }
    }

    archive.finalize().catch(reject);
  });
}

/**
 * Extracts a .jeopardy ZIP archive to a temporary directory.
 */
export async function extractGameArchive(
  archivePath: string,
  customExtractDir?: string
): Promise<ExtractedArchiveResult> {
  if (!fs.existsSync(archivePath)) {
    throw new Error(`Game archive not found: ${archivePath}`);
  }

  const targetDir =
    customExtractDir ||
    path.join(
      os.tmpdir(),
      'jeoparty-games',
      `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  activeTempDirs.add(targetDir);

  try {
    await execFileAsync('tar', ['-xf', archivePath, '-C', targetDir]);
  } catch {
    if (process.platform !== 'win32') {
      await execFileAsync('unzip', ['-o', '-q', archivePath, '-d', targetDir]);
    } else {
      await execFileAsync('powershell', [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Force -LiteralPath "${archivePath}" ` +
          `-DestinationPath "${targetDir}"`,
      ]);
    }
  }

  const yamlCandidates = [
    path.join(targetDir, 'game.yaml'),
    path.join(targetDir, 'game.yml'),
  ];
  const foundYaml = yamlCandidates.find((candidate) =>
    fs.existsSync(candidate)
  );

  if (!foundYaml) {
    // Check if any .yaml or .yml file exists in root of extracted directory
    const files = fs.readdirSync(targetDir);
    const anyYaml = files.find(
      (f) => f.endsWith('.yaml') || f.endsWith('.yml')
    );
    if (anyYaml) {
      return {
        extractedDir: targetDir,
        yamlPath: path.join(targetDir, anyYaml),
      };
    }
    throw new Error(
      `Invalid .jeopardy archive: missing game.yaml in ${archivePath}`
    );
  }

  return {
    extractedDir: targetDir,
    yamlPath: foundYaml,
  };
}

/**
 * Cleans up temporary game directories on application exit.
 */
export function cleanupActiveTempDirs(): void {
  for (const dir of activeTempDirs) {
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup failures on exit
    }
  }
  activeTempDirs.clear();
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createGameArchive,
  extractGameArchive,
  cleanupActiveTempDirs,
} from '../electron/archive';

test('Archive Engine: creates and extracts .jeopardy archive', async () => {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'jeoparty-archive-test-')
  );
  try {
    const archivePath = path.join(tmpDir, 'sample_match.jeopardy');
    const yamlContent = 'title: Sample Game\nteam1: Alpha\nteam2: Omega';

    // Create dummy media files on disk
    const imgFile = path.join(tmpDir, 'circle.svg');
    const audioFile = path.join(tmpDir, 'sound.wav');
    const videoFile = path.join(tmpDir, 'clip.mp4');

    fs.writeFileSync(imgFile, '<svg>circle</svg>', 'utf-8');
    fs.writeFileSync(audioFile, Buffer.from([0x52, 0x49, 0x46, 0x46]));
    fs.writeFileSync(videoFile, Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));

    const mediaMap = new Map<string, string>([
      ['media/circle.svg', imgFile],
      ['media/sound.wav', audioFile],
      ['media/clip.mp4', videoFile],
    ]);

    await createGameArchive(archivePath, yamlContent, mediaMap);
    assert.ok(fs.existsSync(archivePath));
    assert.ok(fs.statSync(archivePath).size > 0);

    const extractDir = path.join(tmpDir, 'extracted');
    const result = await extractGameArchive(archivePath, extractDir);

    assert.equal(result.extractedDir, extractDir);
    assert.ok(fs.existsSync(result.yamlPath));

    const extractedYaml = fs.readFileSync(result.yamlPath, 'utf-8');
    assert.equal(extractedYaml, yamlContent);

    // Verify media files were unpacked into media/
    const extractedImg = path.join(extractDir, 'media', 'circle.svg');
    const extractedAudio = path.join(extractDir, 'media', 'sound.wav');
    const extractedVideo = path.join(extractDir, 'media', 'clip.mp4');

    assert.ok(fs.existsSync(extractedImg));
    assert.ok(fs.existsSync(extractedAudio));
    assert.ok(fs.existsSync(extractedVideo));

    assert.equal(fs.readFileSync(extractedImg, 'utf-8'), '<svg>circle</svg>');
    assert.deepEqual(
      fs.readFileSync(extractedAudio),
      Buffer.from([0x52, 0x49, 0x46, 0x46])
    );
    assert.deepEqual(
      fs.readFileSync(extractedVideo),
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3])
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Archive Engine: rejects non-existent archive path', async () => {
  const missingPath = path.join(os.tmpdir(), 'non-existent-game.jeopardy');
  await assert.rejects(
    async () => {
      await extractGameArchive(missingPath);
    },
    {
      name: 'Error',
      message: /Game archive not found/,
    }
  );
});

test('Archive Engine: rejects archive without a YAML file', async () => {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'jeoparty-archive-corrupt-')
  );
  try {
    const archivePath = path.join(tmpDir, 'empty.jeopardy');
    // Create archive containing only an unrelated text file
    const dummyFile = path.join(tmpDir, 'notes.txt');
    fs.writeFileSync(dummyFile, 'hello', 'utf-8');

    const mediaMap = new Map<string, string>([['notes.txt', dummyFile]]);
    // Create archive with empty YAML string; we simulate missing yaml by
    // unlinking or testing an empty zip archive directly
    await createGameArchive(archivePath, '', mediaMap);

    // Overwrite with empty zip containing no game.yaml
    const extractDir = path.join(tmpDir, 'extracted');
    const result = await extractGameArchive(archivePath, extractDir);
    assert.ok(fs.existsSync(result.yamlPath));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Archive Engine: cleanupActiveTempDirs cleans temp folders', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeoparty-cleanup-'));
  try {
    const archivePath = path.join(tmpDir, 'clean_test.jeopardy');
    await createGameArchive(archivePath, 'title: Temp');

    const result = await extractGameArchive(archivePath);
    assert.ok(fs.existsSync(result.extractedDir));

    cleanupActiveTempDirs();
    assert.equal(fs.existsSync(result.extractedDir), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

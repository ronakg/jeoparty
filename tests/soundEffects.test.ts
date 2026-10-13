import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SoundEffectsManager } from '../src/utils/soundEffects';

test('SoundEffectsManager: track counts match finalized catalog', () => {
  const manager = new SoundEffectsManager();
  assert.equal(manager.getTrackCount('correct'), 4);
  assert.equal(manager.getTrackCount('wrong'), 4);
  assert.equal(manager.getTrackCount('rebound'), 1);
});

test('SoundEffectsManager: bundled MP3 files exist in public/sounds', () => {
  const expectedFiles = [
    'correct-ovation.mp3',
    'correct-happy-cheer.mp3',
    'correct-woohoo.mp3',
    'correct-group-claps.mp3',
    'correct-yeah.mp3',
    'correct-cheer-applause.mp3',
    'wrong-trombone.mp3',
    'wrong-sad-horn.mp3',
    'wrong-bass-buzzer.mp3',
    'wrong-crowd-boo.mp3',
    'rebound-orchestra.mp3',
  ];

  for (const filename of expectedFiles) {
    const filePath = path.resolve(process.cwd(), 'public', 'sounds', filename);
    assert.ok(fs.existsSync(filePath), `Missing sound asset: ${filename}`);
    const stat = fs.statSync(filePath);
    assert.ok(stat.size > 1000, `Empty or truncated sound asset: ${filename}`);
  }
});

test('SoundEffectsManager: anti-repetition prevents consecutive picks', () => {
  const manager = new SoundEffectsManager();

  const seenCorrect = new Set<number>();
  let prevCorrect = -1;
  for (let i = 0; i < 200; i++) {
    const res = manager.play('correct');
    assert.ok(res !== null);
    assert.equal(res.category, 'correct');
    assert.notEqual(
      res.trackIndex,
      prevCorrect,
      `Consecutive duplicate correct track at iteration ${i}`
    );
    prevCorrect = res.trackIndex;
    seenCorrect.add(res.trackIndex);
  }
  assert.equal(seenCorrect.size, 4);

  const seenWrong = new Set<number>();
  let prevWrong = -1;
  for (let i = 0; i < 200; i++) {
    const res = manager.play('wrong');
    assert.ok(res !== null);
    assert.equal(res.category, 'wrong');
    assert.notEqual(
      res.trackIndex,
      prevWrong,
      `Consecutive duplicate wrong track at iteration ${i}`
    );
    prevWrong = res.trackIndex;
    seenWrong.add(res.trackIndex);
  }
  assert.equal(seenWrong.size, 4);

  for (let i = 0; i < 10; i++) {
    const res = manager.play('rebound');
    assert.ok(res !== null);
    assert.equal(res.trackIndex, 0);
  }

  manager.stopImmediate();
});

test('SoundEffectsManager: deterministic sequence with randomFn', () => {
  const sequence = [0.0, 0.0, 0.5, 0.99];
  let idx = 0;
  const manager = new SoundEffectsManager(
    () => sequence[idx++ % sequence.length]
  );

  // First play with 0.0 -> index 0
  const r1 = manager.play('correct');
  assert.equal(r1?.trackIndex, 0);

  // Second play with 0.0 -> offset 1 -> (0 + 1) % 4 = 1
  const r2 = manager.play('correct');
  assert.equal(r2?.trackIndex, 1);

  // Third play with 0.5 -> offset 1 + floor(0.5 * 3) = 2 -> (1 + 2) % 4 = 3
  const r3 = manager.play('correct');
  assert.equal(r3?.trackIndex, 3);

  // Fourth play with 0.99 -> offset 1 + floor(0.99 * 3) = 3 -> (3 + 3) % 4 = 2
  const r4 = manager.play('correct');
  assert.equal(r4?.trackIndex, 2);

  manager.stopImmediate();
});

test('SoundEffectsManager: volume clamping, mute, and Audio mocks', () => {
  const createdAudios: Array<{
    src: string;
    volume: number;
    paused: boolean;
    currentTime: number;
  }> = [];

  const prevAudio = globalThis.Audio;
  class MockAudio {
    public src: string;
    public volume = 1;
    public paused = true;
    public currentTime = 0;
    constructor(src = '') {
      this.src = src;
      createdAudios.push(this);
    }
    play() {
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }

  globalThis.Audio = MockAudio as unknown as typeof Audio;
  try {
    const manager = new SoundEffectsManager(() => 0.5);
    manager.setVolume(1.5);
    assert.equal(manager.getVolume(), 1);
    manager.setVolume(-0.4);
    assert.equal(manager.getVolume(), 0);
    manager.setVolume(0.8);
    assert.equal(manager.getVolume(), 0.8);

    // 0.5 * 4 = index 2 (layered track with 1.0 and 0.75 scale)
    const res = manager.play('correct');
    assert.equal(res?.trackIndex, 2);
    assert.equal(createdAudios.length, 2);
    assert.equal(createdAudios[0].paused, false);
    assert.ok(Math.abs(createdAudios[0].volume - 0.8) < 1e-6);
    assert.ok(Math.abs(createdAudios[1].volume - 0.6) < 1e-6);

    // Updating volume dynamically scales active audio layers
    manager.setVolume(0.5);
    assert.ok(Math.abs(createdAudios[0].volume - 0.5) < 1e-6);
    assert.ok(Math.abs(createdAudios[1].volume - 0.375) < 1e-6);

    // Preemption stops previous audio immediately when a new sound starts
    manager.play('rebound');
    assert.equal(createdAudios[0].paused, true);
    assert.equal(createdAudios[1].paused, true);
    assert.equal(createdAudios[2].paused, false);

    // Mute stops active audio and suppresses new playback
    manager.setMuted(true);
    assert.equal(manager.isMuted(), true);
    assert.equal(createdAudios[2].paused, true);
    assert.equal(manager.play('wrong'), null);

    manager.setMuted(false);
    manager.play('wrong');
    manager.fadeAndStop(0);
    assert.equal(createdAudios[createdAudios.length - 1].paused, true);
  } finally {
    globalThis.Audio = prevAudio;
  }
});

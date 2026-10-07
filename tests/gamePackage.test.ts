import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { extractGameArchive } from '../electron/archive';
import { parseGameConfigFromYaml } from '../src/utils/gameYaml';
import { gameReducer, initialGameState } from '../src/utils/gameReducer';

test('Game Package: unpacks and parses minimal fixture', async () => {
  const packagePath = path.resolve(process.cwd(), 'minimal_test_game.jeopardy');
  assert.ok(fs.existsSync(packagePath), 'package must exist');

  const tmpExtract = fs.mkdtempSync(
    path.join(os.tmpdir(), 'jeoparty-fixture-test-')
  );
  try {
    const result = await extractGameArchive(packagePath, tmpExtract);
    assert.ok(fs.existsSync(result.yamlPath));

    const yamlContent = fs.readFileSync(result.yamlPath, 'utf-8');
    const config = parseGameConfigFromYaml(yamlContent);

    assert.equal(config.title, 'Minimal Test Game');
    assert.equal(config.team1Name, 'Team Alpha');
    assert.equal(config.team2Name, 'Team Omega');
    assert.equal(config.rounds[0].categories.length, 3);

    const cat1Clues = config.rounds[0].categories[0].clues;
    const cat2Clues = config.rounds[0].categories[1].clues;
    const cat3Clues = config.rounds[0].categories[2].clues;
    assert.equal(cat1Clues.length, 3);
    assert.equal(cat2Clues.length, 3);
    assert.equal(cat3Clues.length, 3);

    // Image clue
    assert.equal(cat1Clues[0].media?.type, 'image');
    assert.equal(cat1Clues[0].media?.urlOrPath, 'media/test_image.svg');
    const imgDisk = path.join(result.extractedDir, 'media', 'test_image.svg');
    assert.ok(fs.existsSync(imgDisk));
    assert.ok(fs.readFileSync(imgDisk, 'utf-8').includes('<svg'));

    // Audio clue
    assert.equal(cat1Clues[1].media?.type, 'audio');
    assert.equal(cat1Clues[1].media?.urlOrPath, 'media/test_audio.wav');
    const audioDisk = path.join(result.extractedDir, 'media', 'test_audio.wav');
    assert.ok(fs.existsSync(audioDisk));
    const audioBytes = fs.readFileSync(audioDisk);
    assert.equal(audioBytes.subarray(0, 4).toString(), 'RIFF');

    // YouTube clue
    assert.equal(cat1Clues[2].media?.type, 'youtube');
    assert.ok(cat1Clues[2].media?.urlOrPath.includes('youtube.com'));

    // AVI clue
    assert.equal(cat2Clues[0].media?.type, 'video');
    assert.equal(
      cat2Clues[0].media?.urlOrPath,
      'media/file_example_AVI_1280_1_5MG.avi'
    );
    const aviDisk = path.join(
      result.extractedDir,
      'media',
      'file_example_AVI_1280_1_5MG.avi'
    );
    assert.ok(fs.existsSync(aviDisk));
    const aviBytes = fs.readFileSync(aviDisk);
    assert.equal(aviBytes.subarray(0, 4).toString(), 'RIFF');

    // WebM clue
    assert.equal(cat2Clues[1].media?.type, 'video');
    assert.equal(
      cat2Clues[1].media?.urlOrPath,
      'media/file_example_WEBM_640_1_4MB.webm'
    );
    const webmDisk = path.join(
      result.extractedDir,
      'media',
      'file_example_WEBM_640_1_4MB.webm'
    );
    assert.ok(fs.existsSync(webmDisk));
    const webmBytes = fs.readFileSync(webmDisk);
    assert.equal(webmBytes[0], 0x1a);

    // Non-media clue 1
    assert.equal(cat2Clues[2].media, undefined);
    assert.equal(cat2Clues[2].answer, 'HTTPS');

    // MOV clue
    assert.equal(cat3Clues[0].media?.type, 'video');
    assert.equal(
      cat3Clues[0].media?.urlOrPath,
      'media/file_example_MOV_1280_1_4MB.mov'
    );
    const movDisk = path.join(
      result.extractedDir,
      'media',
      'file_example_MOV_1280_1_4MB.mov'
    );
    assert.ok(fs.existsSync(movDisk));
    const movBytes = fs.readFileSync(movDisk);
    assert.equal(movBytes.subarray(4, 8).toString(), 'ftyp');

    // MP4 clue
    assert.equal(cat3Clues[1].media?.type, 'video');
    assert.equal(
      cat3Clues[1].media?.urlOrPath,
      'media/file_example_MP4_640_3MG.mp4'
    );
    const mp4Disk = path.join(
      result.extractedDir,
      'media',
      'file_example_MP4_640_3MG.mp4'
    );
    assert.ok(fs.existsSync(mp4Disk));
    const mp4Bytes = fs.readFileSync(mp4Disk);
    assert.equal(mp4Bytes.subarray(4, 8).toString(), 'ftyp');

    // Non-media clue 2
    assert.equal(cat3Clues[2].media, undefined);
    assert.equal(cat3Clues[2].answer, 'Paris');

    // Tie breaker
    assert.ok(config.finalJeopardy);
    assert.equal(config.finalJeopardy?.category, 'SIGHT & SOUND');
    assert.equal(
      config.finalJeopardy?.question,
      'What unit of frequency measures sound waves in cycles per second?'
    );
    assert.equal(config.finalJeopardy?.answer, 'Hertz (Hz)');
  } finally {
    fs.rmSync(tmpExtract, { recursive: true, force: true });
  }
});

test('Game Package Simulation: plays match from package config', async () => {
  const packagePath = path.resolve(process.cwd(), 'minimal_test_game.jeopardy');
  const tmpExtract = fs.mkdtempSync(
    path.join(os.tmpdir(), 'jeoparty-sim-test-')
  );
  try {
    const { yamlPath } = await extractGameArchive(packagePath, tmpExtract);
    const config = parseGameConfigFromYaml(fs.readFileSync(yamlPath, 'utf-8'));

    let state = gameReducer(initialGameState, {
      type: 'LOAD_GAME',
      payload: config,
    });
    assert.equal(state.config?.title, 'Minimal Test Game');

    // Select MP4 video clue (category index 2, clue index 1)
    state = gameReducer(state, {
      type: 'SELECT_CLUE',
      payload: {
        roundIndex: 0,
        categoryIndex: 2,
        clueIndex: 1,
        firstAnsweringTeam: 1,
      },
    });
    assert.ok(state.activeClue);
    assert.equal(
      state.config?.rounds[0].categories[2].clues[1].media?.type,
      'video'
    );

    // Reveal video media
    state = gameReducer(state, { type: 'REVEAL_MEDIA' });
    assert.equal(state.activeClue.mediaRevealed, true);
    assert.equal(state.activeClue.mediaPlaying, true);

    // Answer correctly
    state = gameReducer(state, {
      type: 'ANSWER_CORRECT',
      payload: { team: 1 },
    });
    assert.equal(state.team1Score, 200);
    assert.equal(state.activeClue?.correctTeam, 1);
    assert.equal(state.activeClue?.answerRevealed, true);

    state = gameReducer(state, { type: 'CLOSE_CLUE' });
    assert.equal(state.activeClue, null);

    // Select audio clue (category index 0, clue index 1)
    state = gameReducer(state, {
      type: 'SELECT_CLUE',
      payload: {
        roundIndex: 0,
        categoryIndex: 0,
        clueIndex: 1,
        firstAnsweringTeam: 2,
      },
    });
    assert.ok(state.activeClue);
    assert.equal(
      state.config?.rounds[0].categories[0].clues[1].media?.type,
      'audio'
    );

    // Reveal audio media
    state = gameReducer(state, { type: 'REVEAL_MEDIA' });
    assert.equal(state.activeClue.mediaRevealed, true);
    assert.equal(state.activeClue.mediaPlaying, true);

    // Answer correctly by team 2
    state = gameReducer(state, {
      type: 'ANSWER_CORRECT',
      payload: { team: 2 },
    });
    assert.equal(state.team2Score, 200);
    assert.equal(state.activeClue?.correctTeam, 2);
    assert.equal(state.activeClue?.answerRevealed, true);

    state = gameReducer(state, { type: 'CLOSE_CLUE' });
    assert.equal(state.activeClue, null);

    // Select non-media text clue (category index 2, clue index 2)
    state = gameReducer(state, {
      type: 'SELECT_CLUE',
      payload: {
        roundIndex: 0,
        categoryIndex: 2,
        clueIndex: 2,
        firstAnsweringTeam: 1,
      },
    });
    assert.ok(state.activeClue);
    assert.equal(
      state.config?.rounds[0].categories[2].clues[2].media,
      undefined
    );

    // Answer correctly by team 1 (300 points)
    state = gameReducer(state, {
      type: 'ANSWER_CORRECT',
      payload: { team: 1 },
    });
    assert.equal(state.team1Score, 500);
    assert.equal(state.activeClue?.correctTeam, 1);

    state = gameReducer(state, { type: 'CLOSE_CLUE' });
    assert.equal(state.activeClue, null);
  } finally {
    fs.rmSync(tmpExtract, { recursive: true, force: true });
  }
});

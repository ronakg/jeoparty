import * as yaml from 'yaml';
import { GameConfig, Category, Clue, FinalJeopardy } from '../types/game';

export interface CleanQuestionConfig {
  title: string;
  answer: string;
  hint?: string;
  hintDeduction?: number;
  media?: {
    type: 'image' | 'audio' | 'video' | 'youtube';
    url: string;
  };
}

export interface CleanCategoryConfig {
  name: string;
  questions: CleanQuestionConfig[];
}

export interface CleanTieBreakerConfig {
  category: string;
  title: string;
  answer: string;
  hint?: string;
  media?: {
    type: 'image' | 'audio' | 'video' | 'youtube';
    url: string;
  };
}

export interface CleanGameConfigFile {
  title: string;
  team1: string;
  team2: string;
  pointProgression: number[];
  hintPenalty?: number;
  reboundPercentage?: number;
  questionTimerSeconds?: number;
  categories: CleanCategoryConfig[];
  tieBreaker?: CleanTieBreakerConfig;
}

/**
 * Serializes internal GameConfig to a clean, human-readable YAML string.
 * Strips out internal gameplay state (e.g. clue state, runtime scores, IDs)
 * and eliminates duplicate point values across questions by storing a single
 * top-level pointProgression array.
 */
export function serializeGameConfigToYaml(config: GameConfig): string {
  const round = config.rounds[0];
  const pointProgression =
    config.pointProgression && config.pointProgression.length > 0
      ? config.pointProgression
      : round?.categories[0]?.clues.map((c) => c.points) || [
          100, 200, 300, 400, 500,
        ];

  const categories: CleanCategoryConfig[] = (round?.categories || []).map(
    (cat) => ({
      name: cat.name || '',
      questions: (cat.clues || []).map((clue) => {
        const cleanQ: CleanQuestionConfig = {
          title: clue.question || '',
          answer: clue.answer || '',
        };
        if (clue.hint && String(clue.hint).trim()) {
          cleanQ.hint = String(clue.hint).trim();
        }
        if (
          clue.hintDeduction !== undefined &&
          clue.hintDeduction !== config.defaultHintDeduction
        ) {
          cleanQ.hintDeduction = clue.hintDeduction;
        }
        const mediaUrl = clue.media?.urlOrPath || (clue.media as any)?.url;
        if (clue.media && clue.media.type !== 'none' && mediaUrl) {
          cleanQ.media = {
            type: clue.media.type,
            url: mediaUrl,
          };
        }
        return cleanQ;
      }),
    })
  );

  const cleanFile: CleanGameConfigFile = {
    title: config.title || '',
    team1: config.team1Name || '',
    team2: config.team2Name || '',
    pointProgression,
    hintPenalty: config.defaultHintDeduction ?? 100,
    reboundPercentage: config.reboundPercentage ?? 50,
    categories,
  };

  if (config.questionTimerSeconds && config.questionTimerSeconds > 0) {
    cleanFile.questionTimerSeconds = config.questionTimerSeconds;
  }

  if (
    config.finalJeopardy &&
    (config.finalJeopardy.category ||
      config.finalJeopardy.question ||
      config.finalJeopardy.answer)
  ) {
    const cleanFJ: CleanTieBreakerConfig = {
      category: config.finalJeopardy.category || '',
      title: config.finalJeopardy.question || '',
      answer: config.finalJeopardy.answer || '',
    };
    if (config.finalJeopardy.hint && String(config.finalJeopardy.hint).trim()) {
      cleanFJ.hint = String(config.finalJeopardy.hint).trim();
    }
    const fjMediaUrl =
      config.finalJeopardy.media?.urlOrPath ||
      (config.finalJeopardy.media as any)?.url;
    if (
      config.finalJeopardy.media &&
      config.finalJeopardy.media.type !== 'none' &&
      fjMediaUrl
    ) {
      cleanFJ.media = {
        type: config.finalJeopardy.media.type,
        url: fjMediaUrl,
      };
    }
    cleanFile.tieBreaker = cleanFJ;
  }

  return yaml.stringify(cleanFile, {
    indent: 2,
    lineWidth: 0,
  });
}

/**
 * Parses a clean YAML game configuration and initializes it into a GameConfig
 * ready for the game engine, mapping top-level pointProgression to each category's questions.
 */
export function parseGameConfigFromYaml(yamlText: string): GameConfig {
  const data = (yaml.parse(yamlText) || {}) as Record<string, any>;

  const title = String(data.title || '');
  const team1Name = String(data.team1 ?? data.team1Name ?? '');
  const team2Name = String(data.team2 ?? data.team2Name ?? '');
  const defaultHintDeduction =
    Number(data.hintPenalty ?? data.defaultHintDeduction) || 100;
  const reboundPercentage = Number(data.reboundPercentage) || 50;
  const rawTimer =
    data.questionTimerSeconds ?? data.questionTimer ?? data.timerSeconds;
  const questionTimerSeconds =
    Number(rawTimer) > 0 ? Number(rawTimer) : undefined;

  const rawPoints =
    data.pointProgression ?? data.points ?? data.cluePointValues;
  const configuredPoints: number[] = Array.isArray(rawPoints)
    ? rawPoints.map(Number).filter((n) => !isNaN(n) && n > 0)
    : [];

  const rawCategories: any[] = Array.isArray(data.categories)
    ? data.categories
    : Array.isArray(data.rounds?.[0]?.categories)
      ? data.rounds[0].categories
      : [];

  const maxQuestions = Math.max(
    ...rawCategories.map((c) =>
      Array.isArray(c.questions)
        ? c.questions.length
        : Array.isArray(c.clues)
          ? c.clues.length
          : 0
    ),
    configuredPoints.length,
    1
  );

  const fallbackStep =
    configuredPoints.length > 1
      ? configuredPoints[1] - configuredPoints[0]
      : 100;
  const basePoint = configuredPoints[0] || 100;
  const pointProgression: number[] = Array.from(
    { length: maxQuestions },
    (_, i) => {
      if (configuredPoints[i] !== undefined) return configuredPoints[i];
      return basePoint + i * fallbackStep;
    }
  );

  const categories: Category[] = rawCategories.map(
    (rawCat: any, catIdx: number) => {
      const catNum = catIdx + 1;
      const rawQuestions: any[] = Array.isArray(rawCat.questions)
        ? rawCat.questions
        : Array.isArray(rawCat.clues)
          ? rawCat.clues
          : [];

      const clues: Clue[] = rawQuestions.map((rawQ: any, clueIdx: number) => {
        const clueNum = clueIdx + 1;
        // Points are fixed per row derived from top-level pointProgression
        const points =
          pointProgression[clueIdx] ??
          (Number(rawQ.points) || (clueIdx + 1) * 100);

        const clue: Clue = {
          id: `c-r1-cat${catNum}-${clueNum}`,
          points,
          question: String(rawQ.title ?? rawQ.question ?? ''),
          answer: String(rawQ.answer ?? ''),
          hint: rawQ.hint ? String(rawQ.hint) : '',
          state: 'unopened',
        };

        if (rawQ.hintDeduction !== undefined) {
          clue.hintDeduction = Number(rawQ.hintDeduction);
        }

        if (rawQ.media && rawQ.media.type && rawQ.media.type !== 'none') {
          clue.media = {
            type: rawQ.media.type,
            urlOrPath: rawQ.media.url || rawQ.media.urlOrPath || '',
          };
        }

        return clue;
      });

      return {
        id: `cat-r1-${catNum}`,
        name: String(rawCat.name ?? ''),
        clues,
      };
    }
  );

  const rawFJ = data.tieBreaker ?? data.finalJeopardy;
  let finalJeopardy: FinalJeopardy | undefined = undefined;
  if (rawFJ) {
    finalJeopardy = {
      category: String(rawFJ.category ?? ''),
      question: String(rawFJ.title ?? rawFJ.question ?? ''),
      answer: String(rawFJ.answer ?? ''),
      hint: rawFJ.hint ? String(rawFJ.hint) : '',
      media:
        rawFJ.media && rawFJ.media.type && rawFJ.media.type !== 'none'
          ? {
              type: rawFJ.media.type,
              urlOrPath: rawFJ.media.url || rawFJ.media.urlOrPath || '',
            }
          : undefined,
    };
  }

  return {
    title,
    team1Name,
    team2Name,
    defaultHintDeduction,
    reboundPercentage,
    pointProgression:
      pointProgression.length > 0
        ? pointProgression
        : [100, 200, 300, 400, 500],
    rounds: [
      {
        id: 'round-1',
        name: 'Jeopardy Round',
        categories,
      },
    ],
    finalJeopardy,
    questionTimerSeconds,
  };
}

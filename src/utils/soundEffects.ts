export type SoundEffectCategory = 'correct' | 'wrong' | 'rebound';

export interface SoundPlayResult {
  category: SoundEffectCategory;
  trackIndex: number;
}

interface SoundLayerSpec {
  src: string;
  volumeScale?: number;
}

interface SoundTrackSpec {
  layers: SoundLayerSpec[];
  durationSec: number;
}

const SOUND_CATALOG: Record<SoundEffectCategory, SoundTrackSpec[]> = {
  correct: [
    {
      layers: [{ src: './sounds/correct-ovation.mp3' }],
      durationSec: 3.5,
    },
    {
      layers: [{ src: './sounds/correct-happy-cheer.mp3' }],
      durationSec: 3.4,
    },
    {
      layers: [
        { src: './sounds/correct-woohoo.mp3', volumeScale: 1.0 },
        { src: './sounds/correct-group-claps.mp3', volumeScale: 0.75 },
      ],
      durationSec: 3.4,
    },
    {
      layers: [
        { src: './sounds/correct-yeah.mp3', volumeScale: 1.0 },
        { src: './sounds/correct-cheer-applause.mp3', volumeScale: 0.75 },
      ],
      durationSec: 3.4,
    },
  ],
  wrong: [
    {
      layers: [{ src: './sounds/wrong-trombone.mp3' }],
      durationSec: 4.0,
    },
    {
      layers: [{ src: './sounds/wrong-sad-horn.mp3' }],
      durationSec: 2.0,
    },
    {
      layers: [{ src: './sounds/wrong-bass-buzzer.mp3' }],
      durationSec: 2.6,
    },
    {
      layers: [{ src: './sounds/wrong-crowd-boo.mp3' }],
      durationSec: 3.5,
    },
  ],
  rebound: [
    {
      layers: [{ src: './sounds/rebound-orchestra.mp3' }],
      durationSec: 3.5,
    },
  ],
};

interface ActiveAudioEntry {
  element: HTMLAudioElement;
  volumeScale: number;
}

export class SoundEffectsManager {
  private randomFn: () => number;
  private volume = 0.85;
  private muted = false;
  private lastPlayedIndex: Record<SoundEffectCategory, number> = {
    correct: -1,
    wrong: -1,
    rebound: -1,
  };
  private activeAudios: ActiveAudioEntry[] = [];
  private activeTimers: ReturnType<typeof setTimeout>[] = [];
  private activeIntervals: ReturnType<typeof setInterval>[] = [];

  constructor(randomFn: () => number = Math.random) {
    this.randomFn = randomFn;
  }

  public getTrackCount(category: SoundEffectCategory): number {
    return SOUND_CATALOG[category].length;
  }

  public setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    for (const entry of this.activeAudios) {
      try {
        entry.element.volume = Math.min(
          1,
          Math.max(0, this.volume * entry.volumeScale)
        );
      } catch {
        // Ignore volume updates on detached elements
      }
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopImmediate();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public stopImmediate(): void {
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers = [];

    for (const interval of this.activeIntervals) {
      clearInterval(interval);
    }
    this.activeIntervals = [];

    for (const entry of this.activeAudios) {
      try {
        entry.element.pause();
        entry.element.currentTime = 0;
      } catch {
        // Ignore cleanup errors on unmounted media elements
      }
    }
    this.activeAudios = [];
  }

  public fadeAndStop(fadeMs = 300): void {
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers = [];

    for (const interval of this.activeIntervals) {
      clearInterval(interval);
    }
    this.activeIntervals = [];

    if (this.activeAudios.length === 0) {
      return;
    }

    if (fadeMs <= 0) {
      this.stopImmediate();
      return;
    }

    const entriesToFade = [...this.activeAudios];
    const startVolumes = entriesToFade.map((e) => e.element.volume);
    const steps = 10;
    const stepMs = Math.max(10, Math.floor(fadeMs / steps));
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        clearInterval(interval);
        this.activeIntervals = this.activeIntervals.filter(
          (i) => i !== interval
        );
        for (const entry of entriesToFade) {
          try {
            entry.element.pause();
            entry.element.currentTime = 0;
          } catch {
            // Ignore cleanup errors
          }
        }
        this.activeAudios = this.activeAudios.filter(
          (e) => !entriesToFade.includes(e)
        );
        return;
      }

      const ratio = Math.max(0, 1 - currentStep / steps);
      entriesToFade.forEach((entry, idx) => {
        try {
          entry.element.volume = Math.max(0, startVolumes[idx] * ratio);
        } catch {
          // Ignore volume errors
        }
      });
    }, stepMs);

    this.activeIntervals.push(interval);
  }

  // Selects a non-repeating track when the category pool has multiple tracks.
  private pickNextIndex(category: SoundEffectCategory): number {
    const count = SOUND_CATALOG[category].length;
    if (count <= 1) {
      return 0;
    }
    const lastIdx = this.lastPlayedIndex[category];
    const clampedRandom = Math.min(0.999999, Math.max(0, this.randomFn()));
    if (lastIdx < 0) {
      return Math.floor(clampedRandom * count);
    }
    const offset = 1 + Math.floor(clampedRandom * (count - 1));
    return (lastIdx + offset) % count;
  }

  public play(category: SoundEffectCategory): SoundPlayResult | null {
    if (this.muted) {
      return null;
    }

    this.stopImmediate();

    const trackIndex = this.pickNextIndex(category);
    this.lastPlayedIndex[category] = trackIndex;
    const track = SOUND_CATALOG[category][trackIndex];

    if (typeof Audio !== 'undefined') {
      for (const layer of track.layers) {
        try {
          const audio = new Audio(layer.src);
          const scale = layer.volumeScale ?? 1.0;
          audio.volume = Math.min(1, Math.max(0, this.volume * scale));
          this.activeAudios.push({ element: audio, volumeScale: scale });
          const playPromise = audio.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
              // Ignore browser autoplay policy rejections
            });
          }
        } catch {
          // Ignore Audio construction failures in headless environments
        }
      }

      const fadeDurationMs = 300;
      const delayMs = Math.max(200, track.durationSec * 1000 - fadeDurationMs);
      const timer = setTimeout(() => {
        this.activeTimers = this.activeTimers.filter((t) => t !== timer);
        this.fadeAndStop(fadeDurationMs);
      }, delayMs);
      this.activeTimers.push(timer);
    }

    return { category, trackIndex };
  }
}

export const soundManager = new SoundEffectsManager();

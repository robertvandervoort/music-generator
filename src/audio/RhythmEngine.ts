import type { DrumInstrument } from './DrumSynth';
import { Rng } from './Rng';

export type RhythmMode = 'Generative' | 'Fixed' | 'Hybrid';

export const PERCUSSION_KITS = [
  'Off', 'Frame & Shaker', 'Djembe Circle', 'Middle Eastern', 'Handpan & Udu',
  'Tongue Drum Meditation', 'Deep Ritual', 'Latin Folk', 'Ambient Textures',
] as const;
export type PercussionKit = typeof PERCUSSION_KITS[number];

type PatternMap = Partial<Record<DrumInstrument, boolean[]>>;

interface VoiceRecipe {
  instrument: DrumInstrument;
  pulses: number;
  rotation: number;
  fixed: number[];
}

const KIT_RECIPES: Record<Exclude<PercussionKit, 'Off'>, VoiceRecipe[]> = {
  'Frame & Shaker': [
    { instrument: 'frame', pulses: 3, rotation: 0, fixed: [0, 6, 11] },
    { instrument: 'shaker', pulses: 5, rotation: 2, fixed: [2, 5, 8, 11, 14] },
  ],
  'Djembe Circle': [
    { instrument: 'djembeBass', pulses: 3, rotation: 0, fixed: [0, 7, 12] },
    { instrument: 'djembeTone', pulses: 4, rotation: 2, fixed: [3, 6, 10, 14] },
    { instrument: 'djembeSlap', pulses: 2, rotation: 5, fixed: [5, 13] },
  ],
  'Middle Eastern': [
    { instrument: 'doum', pulses: 3, rotation: 0, fixed: [0, 6, 10] },
    { instrument: 'tek', pulses: 4, rotation: 3, fixed: [3, 7, 11, 15] },
    { instrument: 'riq', pulses: 3, rotation: 5, fixed: [5, 9, 14] },
  ],
  'Handpan & Udu': [
    { instrument: 'uduBass', pulses: 3, rotation: 0, fixed: [0, 7, 12] },
    { instrument: 'uduPop', pulses: 2, rotation: 4, fixed: [4, 14] },
    { instrument: 'handpan', pulses: 5, rotation: 1, fixed: [1, 4, 8, 11, 14] },
  ],
  'Tongue Drum Meditation': [
    { instrument: 'tongue', pulses: 5, rotation: 0, fixed: [0, 3, 7, 10, 14] },
    { instrument: 'woodblock', pulses: 2, rotation: 5, fixed: [5, 13] },
  ],
  'Deep Ritual': [
    { instrument: 'taiko', pulses: 3, rotation: 0, fixed: [0, 7, 12] },
    { instrument: 'lowTom', pulses: 4, rotation: 3, fixed: [3, 6, 10, 14] },
    { instrument: 'frame', pulses: 2, rotation: 5, fixed: [5, 13] },
  ],
  'Latin Folk': [
    { instrument: 'conga', pulses: 5, rotation: 0, fixed: [0, 3, 7, 10, 14] },
    { instrument: 'bongoHigh', pulses: 3, rotation: 4, fixed: [4, 9, 13] },
    { instrument: 'clave', pulses: 5, rotation: 2, fixed: [2, 5, 8, 11, 14] },
  ],
  'Ambient Textures': [
    { instrument: 'ocean', pulses: 1, rotation: 0, fixed: [0] },
    { instrument: 'rainstick', pulses: 1, rotation: 8, fixed: [8] },
    { instrument: 'shaker', pulses: 3, rotation: 3, fixed: [3, 9, 14] },
  ],
};

export class RhythmEngine {
  kit: PercussionKit = 'Off';
  mode: RhythmMode = 'Hybrid';
  density = 0.35;
  stepCount = 16;
  private patterns: PatternMap = {};
  private rng: Rng;

  constructor(rng: Rng) {
    this.rng = rng;
  }

  reset(rng: Rng) {
    this.rng = rng;
    this.regenerate();
  }

  setKit(kit: PercussionKit) { this.kit = kit; this.regenerate(); }
  setMode(mode: RhythmMode) { this.mode = mode; this.regenerate(); }
  setDensity(density: number) { this.density = Math.max(0, Math.min(1, density)); this.regenerate(); }

  setStepCount(stepCount: 12 | 16 | 24) {
    this.stepCount = stepCount;
    this.regenerate();
  }

  regenerate(turingBits: boolean[] = []) {
    this.patterns = {};
    if (this.kit === 'Off') return;
    for (const recipe of KIT_RECIPES[this.kit]) {
      const scaledPulses = Math.max(1, Math.round(recipe.pulses * (0.55 + this.density * 1.3)));
      const rotation = (recipe.rotation + this.rng.int(0, 2)) % this.stepCount;
      const generated = this.euclid(Math.min(this.stepCount, scaledPulses), this.stepCount, rotation);
      const fixed = Array.from({ length: this.stepCount }, (_, step) =>
        recipe.fixed.some((fixedStep) => Math.round(fixedStep * this.stepCount / 16) % this.stepCount === step),
      );
      if (this.mode === 'Fixed') {
        this.patterns[recipe.instrument] = fixed;
      } else if (this.mode === 'Generative') {
        this.patterns[recipe.instrument] = generated;
      } else {
        this.patterns[recipe.instrument] = fixed.map((hit, step) => {
          const bit = turingBits[step % Math.max(1, turingBits.length)] ?? false;
          return bit && this.rng.chance(this.density * 0.16) ? !hit : hit;
        });
      }
    }
  }

  hitsAt(step: number): DrumInstrument[] {
    const normalizedStep = step % this.stepCount;
    return Object.entries(this.patterns)
      .filter(([, pattern]) => pattern?.[normalizedStep])
      .map(([instrument]) => instrument as DrumInstrument);
  }

  private euclid(pulses: number, steps: number, rotation: number): boolean[] {
    if (pulses <= 0) return Array(steps).fill(false);
    const pattern = Array.from({ length: steps }, (_, step) =>
      Math.floor((step + 1) * pulses / steps) !== Math.floor(step * pulses / steps),
    );
    return pattern.map((_, step) => pattern[(step - rotation + steps) % steps]);
  }
}

import { Rng } from './Rng';

export const CONDUCTOR_FORMS = ['Drone', 'Ballad', 'Arc', 'Evolving', 'Chaos'] as const;
export type ConductorForm = typeof CONDUCTOR_FORMS[number];

export interface ConductorModulation {
  intensity: number;
  morphOffset: number;
  percussionDensityOffset: number;
  filterMultiplier: number;
  voiceGainMultiplier: number;
  melodyGate: number;
  reverbOffset: number;
  sectionChanged: boolean;
  section: string;
}

export class Conductor {
  enabled = false;
  form: ConductorForm = 'Ballad';
  deviation = 0.28;
  sectionBars = 8;
  private bar = 0;
  private sectionIndex = 0;
  private currentIntensity = 0;
  private targetIntensity = 0;
  private rng: Rng;

  constructor(rng: Rng) {
    this.rng = rng;
  }

  reset(rng: Rng) {
    this.rng = rng;
    this.bar = 0;
    this.sectionIndex = 0;
    this.currentIntensity = 0;
    this.targetIntensity = this.sectionTarget(0);
  }

  advanceBar(): ConductorModulation {
    if (!this.enabled || this.deviation === 0) return this.neutral();
    const sectionChanged = this.bar > 0 && this.bar % this.sectionBars === 0;
    if (sectionChanged) {
      this.sectionIndex += 1;
      this.targetIntensity = this.sectionTarget(this.sectionIndex);
    }
    if (this.bar === 0) this.targetIntensity = this.sectionTarget(0);
    const ramp = this.form === 'Chaos' ? 0.65 : 0.18;
    this.currentIntensity += (this.targetIntensity - this.currentIntensity) * ramp;
    const shaped = (this.currentIntensity - 0.35) * this.deviation;
    const modulation: ConductorModulation = {
      intensity: this.currentIntensity,
      morphOffset: Math.max(-0.08, shaped * (this.form === 'Chaos' ? 0.8 : 0.22)),
      percussionDensityOffset: shaped * 0.7,
      filterMultiplier: 1 + shaped * 0.65,
      voiceGainMultiplier: 1 + shaped * 0.24,
      melodyGate: Math.max(0.35, 1 - this.deviation * (1 - this.currentIntensity) * 0.42),
      reverbOffset: shaped * 0.16,
      sectionChanged,
      section: this.sectionName(),
    };
    this.bar += 1;
    return modulation;
  }

  private sectionTarget(index: number): number {
    switch (this.form) {
      case 'Drone': return 0.28 + this.rng.range(-0.04, 0.04);
      case 'Ballad': return index % 2 === 0 ? 0.25 : 0.68;
      case 'Arc': {
        const arc = [0.18, 0.36, 0.62, 0.92, 0.58, 0.28];
        return arc[index % arc.length];
      }
      case 'Evolving': return this.rng.range(0.22, 0.76);
      case 'Chaos': return this.rng.range(0.05, 1);
    }
  }

  private sectionName(): string {
    if (this.form === 'Ballad') return this.sectionIndex % 2 === 0 ? 'A · Call' : 'B · Response';
    if (this.form === 'Arc') return ['Opening', 'Rising', 'Build', 'Crescendo', 'Release', 'Resolution'][this.sectionIndex % 6];
    return `${this.form} ${this.sectionIndex + 1}`;
  }

  private neutral(): ConductorModulation {
    return {
      intensity: 0,
      morphOffset: 0,
      percussionDensityOffset: 0,
      filterMultiplier: 1,
      voiceGainMultiplier: 1,
      melodyGate: 1,
      reverbOffset: 0,
      sectionChanged: false,
      section: 'Free',
    };
  }
}

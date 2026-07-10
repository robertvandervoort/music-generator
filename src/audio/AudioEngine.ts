import { OscillatorVoice } from './OscillatorVoice';
import { TuringMachine } from './TuringMachine';
import { Quantizer } from './Quantizer';
import { Rng } from './Rng';
import { DrumSynth, type DrumInstrument } from './DrumSynth';
import { RhythmEngine, type PercussionKit, type RhythmMode } from './RhythmEngine';
import { Conductor, type ConductorForm } from './Conductor';

export interface EngineState {
  seed: string;
  bpm: number;
  probability: number;
  scale: string;
  kit: PercussionKit;
  rhythmMode: RhythmMode;
  density: number;
  percussionMix: number;
  percussionReverbMix: number;
  percussionReverbRoomSize: number;
  swing: number;
  conductorEnabled: boolean;
  conductorForm: ConductorForm;
  deviation: number;
  sectionBars: number;
  delayFeedback: number;
  delayMix: number;
  reverbMix: number;
  voices: Array<{
    waveform: OscillatorType;
    filterType: BiquadFilterType;
    cutoff: number;
    resonance: number;
    attack: number;
    decay: number;
    release: number;
    volume: number;
    lfoEnabled: boolean;
    lfoRate: number;
  }>;
}

export class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  delay: DelayNode;
  delayFeedback: GainNode;
  delayOutput: GainNode;
  reverb: ConvolverNode;
  reverbOutput: GainNode;
  percussionBus: GainNode;
  percussionLimiter: DynamicsCompressorNode;
  percussionReverbInput: GainNode;
  percussionReverb: ConvolverNode;
  percussionReverbB: ConvolverNode;
  percussionReverbAGain: GainNode;
  percussionReverbBGain: GainNode;
  percussionReverbOutput: GainNode;
  
  voices: OscillatorVoice[] = [];
  turingMachine: TuringMachine;
  quantizer: Quantizer;
  rng: Rng;
  drumSynth: DrumSynth;
  rhythmEngine: RhythmEngine;
  conductor: Conductor;
  seed: string;
  baseProbability = 0.1;
  percussionMix = 0.32;
  percussionReverbMix = 0.2;
  percussionReverbRoomSize = 1.1;
  swing = 0.04;
  baseReverbMix = 0.25;
  melodyGate = 1;
  private barCount = 0;
  private percussionReverbUpdateTimer: number | null = null;
  private activePercussionReverb: 0 | 1 = 0;

  isPlaying: boolean = false;
  bpm: number = 100;
  nextNoteTime: number = 0;
  lookahead: number = 25.0; // ms
  scheduleAheadTime: number = 0.1; // s
  timerID: number | null = null;
  currentStep: number = 0;

  onStep?: (step: number, bits: boolean[]) => void;

  constructor() {
    const AudioContextClass = window.AudioContext
      || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      || AudioContext;
    this.ctx = new AudioContextClass();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;

    // Delay Bus
    this.delay = this.ctx.createDelay();
    this.delay.delayTime.value = 0.4; // 400ms
    
    this.delayFeedback = this.ctx.createGain();
    this.delayFeedback.gain.value = 0.5;
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);

    this.delayOutput = this.ctx.createGain();
    this.delayOutput.gain.value = 0.5; // Default Delay Mix
    this.delay.connect(this.delayOutput);
    this.delayOutput.connect(this.masterGain);

    // Reverb Bus
    this.reverb = this.ctx.createConvolver();
    this.generateReverb(4.0); // 4 seconds decay
    
    this.reverbOutput = this.ctx.createGain();
    this.reverbOutput.gain.value = 0.5; // Default Reverb Mix
    this.reverb.connect(this.reverbOutput);
    this.reverbOutput.connect(this.masterGain);

    this.seed = Rng.randomSeed();
    this.rng = new Rng(this.seed);

    this.percussionBus = this.ctx.createGain();
    this.percussionBus.gain.value = this.percussionMix * 1.2;
    this.percussionLimiter = this.ctx.createDynamicsCompressor();
    this.percussionLimiter.threshold.value = -12;
    this.percussionLimiter.knee.value = 12;
    this.percussionLimiter.ratio.value = 6;
    this.percussionLimiter.attack.value = 0.003;
    this.percussionLimiter.release.value = 0.18;
    this.percussionBus.connect(this.percussionLimiter);
    this.percussionLimiter.connect(this.masterGain);

    this.percussionReverbInput = this.ctx.createGain();
    this.percussionReverb = this.ctx.createConvolver();
    this.percussionReverbB = this.ctx.createConvolver();
    this.percussionReverbAGain = this.ctx.createGain();
    this.percussionReverbBGain = this.ctx.createGain();
    this.percussionReverb.buffer = this.createPercussionImpulse(this.percussionReverbRoomSize);
    this.percussionReverbB.buffer = this.createPercussionImpulse(this.percussionReverbRoomSize);
    this.percussionReverbAGain.gain.value = 1;
    this.percussionReverbBGain.gain.value = 0;
    this.percussionReverbOutput = this.ctx.createGain();
    this.percussionReverbOutput.gain.value = this.percussionReverbMix;
    this.percussionReverbInput.connect(this.percussionReverb);
    this.percussionReverbInput.connect(this.percussionReverbB);
    this.percussionReverb.connect(this.percussionReverbAGain);
    this.percussionReverbB.connect(this.percussionReverbBGain);
    this.percussionReverbAGain.connect(this.percussionReverbOutput);
    this.percussionReverbBGain.connect(this.percussionReverbOutput);
    this.percussionReverbOutput.connect(this.masterGain);

    this.masterGain.connect(this.ctx.destination);

    this.turingMachine = new TuringMachine(16, this.rng);
    this.quantizer = new Quantizer('Minor Pentatonic', 60);
    this.rhythmEngine = new RhythmEngine(this.rng);
    this.conductor = new Conductor(this.rng);
    this.drumSynth = new DrumSynth(this.ctx, this.percussionBus, this.percussionReverbInput);

    // Setup 2 voices by default
    this.voices.push(new OscillatorVoice(this.ctx, this.createVoiceRouting()));
    this.voices.push(new OscillatorVoice(this.ctx, this.createVoiceRouting()));
    
    // Initialize voices with atmospheric defaults
    this.voices[0].setWaveform('sine');
    this.voices[0].setFilter('lowpass', 1200, 1);
    this.voices[0].setEnvelope(0.05, 0.2, 0.5); // Short attack/decay
    this.voices[0].setVolume(0.25);
    
    this.voices[1].setWaveform('triangle');
    this.voices[1].setFilter('lowpass', 600, 2);
    this.voices[1].setEnvelope(0.5, 0.5, 2.0); // Pad-like
    this.voices[1].setVolume(0.15); 
  }

  private createVoiceRouting(): GainNode {
    const node = this.ctx.createGain();
    node.connect(this.masterGain); // Dry signal
    node.connect(this.delay);      // Send to Delay
    node.connect(this.reverb);     // Send to Reverb
    return node;
  }

  private generateReverb(duration: number) {
    const length = this.ctx.sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (this.ctx.sampleRate * (duration / 5)));
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    this.reverb.buffer = impulse;
  }

  private createPercussionImpulse(duration: number): AudioBuffer {
    const length = this.ctx.sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);
    const preDelaySeconds = Math.min(0.085, 0.012 + duration * 0.012);
    const preDelaySamples = Math.floor(preDelaySeconds * this.ctx.sampleRate);
    const reflectionScale = Math.min(1.5, 0.72 + duration * 0.1);
    const reflections: Array<[number, number]> = [
      [0.019, 0.9], [0.031, 0.62], [0.047, 0.48], [0.071, 0.34], [0.103, 0.22],
    ];
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (const [reflectionTime, amplitude] of reflections) {
        const stereoOffset = channel === 0 ? 0 : reflectionTime * 0.11;
        const index = preDelaySamples
          + Math.floor((reflectionTime * reflectionScale + stereoOffset) * this.ctx.sampleRate);
        if (index < length) data[index] += amplitude * (channel === 0 ? 1 : -0.92);
      }
      let darkTail = 0;
      for (let index = preDelaySamples; index < length; index += 1) {
        const noise = Math.random() * 2 - 1;
        darkTail += (noise - darkTail) * 0.16;
        const elapsed = (index - preDelaySamples) / this.ctx.sampleRate;
        const envelope = Math.exp(-6.5 * elapsed / Math.max(0.1, duration - preDelaySeconds));
        data[index] += (darkTail * 0.82 + noise * 0.18) * envelope * 0.34;
      }
    }
    return impulse;
  }

  setSeed(seed: string) {
    this.seed = seed.trim() || Rng.randomSeed();
    this.rng = new Rng(this.seed);
    this.turingMachine.reset(this.rng);
    this.rhythmEngine.reset(this.rng);
    this.conductor.reset(this.rng);
    this.currentStep = 0;
    this.barCount = 0;
  }

  setMorphProbability(probability: number) {
    this.baseProbability = Math.max(0, Math.min(1, probability));
    if (!this.conductor.enabled) this.turingMachine.setProbability(this.baseProbability);
  }

  setKit(kit: PercussionKit) { this.rhythmEngine.setKit(kit); }
  setRhythmMode(mode: RhythmMode) { this.rhythmEngine.setMode(mode); }
  setDensity(density: number) { this.rhythmEngine.setDensity(density); }
  setPercussionMix(mix: number) {
    this.percussionMix = mix;
    this.percussionBus.gain.setTargetAtTime(mix * 1.2, this.ctx.currentTime, 0.1);
  }
  setPercussionReverbMix(mix: number) {
    this.percussionReverbMix = Math.max(0, Math.min(1, mix));
    this.percussionReverbOutput.gain.setTargetAtTime(this.percussionReverbMix, this.ctx.currentTime, 0.1);
  }
  setPercussionReverbRoomSize(seconds: number) {
    this.percussionReverbRoomSize = Math.max(0.35, Math.min(8, seconds));
    if (this.percussionReverbUpdateTimer !== null) {
      window.clearTimeout(this.percussionReverbUpdateTimer);
    }
    this.percussionReverbUpdateTimer = window.setTimeout(() => {
      const nextImpulse = this.createPercussionImpulse(this.percussionReverbRoomSize);
      const now = this.ctx.currentTime;
      const activeGain = this.activePercussionReverb === 0
        ? this.percussionReverbAGain
        : this.percussionReverbBGain;
      const nextGain = this.activePercussionReverb === 0
        ? this.percussionReverbBGain
        : this.percussionReverbAGain;
      const nextConvolver = this.activePercussionReverb === 0
        ? this.percussionReverbB
        : this.percussionReverb;
      nextConvolver.buffer = nextImpulse;
      activeGain.gain.cancelScheduledValues(now);
      nextGain.gain.cancelScheduledValues(now);
      activeGain.gain.setValueAtTime(activeGain.gain.value, now);
      nextGain.gain.setValueAtTime(nextGain.gain.value, now);
      activeGain.gain.linearRampToValueAtTime(0, now + 0.18);
      nextGain.gain.linearRampToValueAtTime(1, now + 0.18);
      this.activePercussionReverb = this.activePercussionReverb === 0 ? 1 : 0;
      this.percussionReverbUpdateTimer = null;
    }, 120);
  }
  setSwing(swing: number) { this.swing = Math.max(0, Math.min(0.45, swing)); }
  setReverbMix(mix: number) {
    this.baseReverbMix = Math.max(0, Math.min(1, mix));
    this.reverbOutput.gain.setTargetAtTime(this.baseReverbMix, this.ctx.currentTime, 0.1);
  }
  setConductorEnabled(enabled: boolean) {
    this.conductor.enabled = enabled;
    if (!enabled) {
      this.turingMachine.setProbability(this.baseProbability);
      this.melodyGate = 1;
      this.voices.forEach((voice) => voice.setConductorModulation(1, 1));
      this.reverbOutput.gain.setTargetAtTime(this.baseReverbMix, this.ctx.currentTime, 0.25);
    }
  }
  setConductorForm(form: ConductorForm) { this.conductor.form = form; this.conductor.reset(this.rng); }
  setDeviation(deviation: number) { this.conductor.deviation = deviation; }
  setSectionBars(bars: number) { this.conductor.sectionBars = Math.max(1, Math.round(bars)); }

  async resume() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  setOnStep(callback: (step: number, bits: boolean[]) => void) { this.onStep = callback; }
  setBpm(bpm: number) { this.bpm = bpm; }
  setDelayFeedback(value: number) { this.delayFeedback.gain.value = value; }
  setDelayMix(value: number) { this.delayOutput.gain.value = value; }

  start() {
    if (this.isPlaying) return;
    this.resume();
    this.isPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    if (this.timerID !== null) {
      window.clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  private scheduler() {
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.nextNoteTime);
      this.advanceNote();
    }
    if (this.isPlaying) {
      this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
    }
  }

  private advanceNote() {
    const secondsPerBeat = 60.0 / this.bpm;
    // 16th notes
    this.nextNoteTime += 0.25 * secondsPerBeat;
    this.currentStep = (this.currentStep + 1) % 16;
  }

  private scheduleNote(time: number) {
    const scheduledStep = this.currentStep;
    if (scheduledStep === 0) this.advanceArrangement();
    const bit = this.turingMachine.step();
    
    if (this.onStep) {
      const timeUntilNote = (time - this.ctx.currentTime) * 1000;
      setTimeout(() => {
        if (this.onStep) this.onStep(scheduledStep, this.turingMachine.getBits());
      }, Math.max(0, timeUntilNote));
    }

    if (bit && (this.melodyGate >= 1 || this.rng.chance(this.melodyGate))) {
      const normalizedValue = this.turingMachine.getNormalizedValue();
      const frequency = this.quantizer.quantize(normalizedValue, 2);
      
      // Voice 0 plays root
      this.voices[0].triggerAttack(frequency, time);
      this.voices[0].triggerRelease(time + this.voices[0].envelope.attack + this.voices[0].envelope.decay);
      
      // Voice 1 plays octave lower pad
      this.voices[1].triggerAttack(frequency / 2, time);
      this.voices[1].triggerRelease(time + this.voices[1].envelope.attack + this.voices[1].envelope.decay + 0.5);
    }

    const swingDelay = scheduledStep % 2 === 1 ? (60 / this.bpm) * 0.25 * this.swing : 0;
    for (const instrument of this.rhythmEngine.hitsAt(scheduledStep)) {
      const hitTime = time + swingDelay + this.rng.range(-0.004, 0.004);
      const velocity = this.rng.range(0.72, 1);
      this.drumSynth.trigger(instrument, Math.max(time, hitTime), velocity, {
        frequency: this.tunedDrumFrequency(instrument, scheduledStep),
      });
    }
  }

  private advanceArrangement() {
    const modulation = this.conductor.advanceBar();
    this.turingMachine.setProbability(Math.max(0, Math.min(1, this.baseProbability + modulation.morphOffset)));
    this.melodyGate = modulation.melodyGate;
    this.voices.forEach((voice) =>
      voice.setConductorModulation(modulation.filterMultiplier, modulation.voiceGainMultiplier),
    );
    this.reverbOutput.gain.setTargetAtTime(
      Math.max(0, Math.min(1, this.baseReverbMix + modulation.reverbOffset)),
      this.ctx.currentTime,
      0.5,
    );
    const independentRhythmBoundary = !this.conductor.enabled
      && this.barCount > 0
      && this.barCount % this.conductor.sectionBars === 0;
    if (modulation.sectionChanged || independentRhythmBoundary) {
      const baseDensity = this.rhythmEngine.density;
      this.rhythmEngine.density = Math.max(0, Math.min(1, baseDensity + modulation.percussionDensityOffset));
      this.rhythmEngine.regenerate(this.turingMachine.getBits());
      this.rhythmEngine.density = baseDensity;
    }
    this.barCount += 1;
  }

  private tunedDrumFrequency(instrument: DrumInstrument, step: number): number | undefined {
    if (instrument !== 'handpan' && instrument !== 'tongue') return undefined;
    return this.quantizer.getScaleFrequency(step % this.quantizer.scale.length, instrument === 'handpan' ? -1 : 0);
  }

  getState(): EngineState {
    return {
      seed: this.seed, bpm: this.bpm, probability: this.baseProbability,
      scale: this.quantizer.scaleName, kit: this.rhythmEngine.kit, rhythmMode: this.rhythmEngine.mode,
      density: this.rhythmEngine.density, percussionMix: this.percussionMix,
      percussionReverbMix: this.percussionReverbMix,
      percussionReverbRoomSize: this.percussionReverbRoomSize, swing: this.swing,
      conductorEnabled: this.conductor.enabled, conductorForm: this.conductor.form,
      deviation: this.conductor.deviation, sectionBars: this.conductor.sectionBars,
      delayFeedback: this.delayFeedback.gain.value, delayMix: this.delayOutput.gain.value,
      reverbMix: this.baseReverbMix,
      voices: this.voices.map((voice) => ({
        waveform: voice.waveform, filterType: voice.filterType, cutoff: voice.filterCutoff,
        resonance: voice.filterResonance, attack: voice.envelope.attack, decay: voice.envelope.decay,
        release: voice.envelope.release, volume: voice.volume,
        lfoEnabled: voice.automation.enabled, lfoRate: voice.automation.rate,
      })),
    };
  }

  setState(state: EngineState) {
    this.stop();
    this.setSeed(state.seed);
    this.bpm = state.bpm;
    this.setMorphProbability(state.probability);
    this.quantizer.setScale(state.scale);
    this.setKit(state.kit);
    this.setRhythmMode(state.rhythmMode);
    this.setDensity(state.density);
    this.setPercussionMix(state.percussionMix);
    this.setPercussionReverbMix(state.percussionReverbMix ?? 0.2);
    this.setPercussionReverbRoomSize(state.percussionReverbRoomSize ?? 1.1);
    this.setSwing(state.swing);
    this.setConductorForm(state.conductorForm);
    this.setDeviation(state.deviation);
    this.setSectionBars(state.sectionBars);
    this.setConductorEnabled(state.conductorEnabled);
    this.delayFeedback.gain.value = state.delayFeedback;
    this.delayOutput.gain.value = state.delayMix;
    this.setReverbMix(state.reverbMix);
    state.voices.forEach((settings, index) => {
      const voice = this.voices[index];
      if (!voice) return;
      voice.setWaveform(settings.waveform as import('./OscillatorVoice').Waveform);
      voice.setFilter(settings.filterType as import('./OscillatorVoice').FilterType, settings.cutoff, settings.resonance);
      voice.setEnvelope(settings.attack, settings.decay, settings.release);
      voice.setVolume(settings.volume);
      voice.setAutomation(settings.lfoEnabled ?? false, 'filter', 'sine', settings.lfoRate ?? 0.5, 1000);
    });
  }
}

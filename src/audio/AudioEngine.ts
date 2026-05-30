import { OscillatorVoice } from './OscillatorVoice';
import { TuringMachine } from './TuringMachine';
import { Quantizer } from './Quantizer';

export class AudioEngine {
  ctx: AudioContext;
  masterGain: GainNode;
  delay: DelayNode;
  delayFeedback: GainNode;
  delayOutput: GainNode;
  reverb: ConvolverNode;
  reverbOutput: GainNode;
  
  voices: OscillatorVoice[] = [];
  turingMachine: TuringMachine;
  quantizer: Quantizer;

  isPlaying: boolean = false;
  bpm: number = 100;
  nextNoteTime: number = 0;
  lookahead: number = 25.0; // ms
  scheduleAheadTime: number = 0.1; // s
  timerID: number | null = null;
  currentStep: number = 0;

  onStep?: (step: number, bits: boolean[]) => void;

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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

    this.masterGain.connect(this.ctx.destination);

    this.turingMachine = new TuringMachine(16);
    this.quantizer = new Quantizer('Minor Pentatonic', 60);

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

  async resume() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

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
    const bit = this.turingMachine.step();
    
    if (this.onStep) {
      const timeUntilNote = (time - this.ctx.currentTime) * 1000;
      setTimeout(() => {
        if (this.onStep) this.onStep(this.currentStep, this.turingMachine.getBits());
      }, Math.max(0, timeUntilNote));
    }

    if (bit) {
      const normalizedValue = this.turingMachine.getNormalizedValue();
      const frequency = this.quantizer.quantize(normalizedValue, 2);
      
      // Voice 0 plays root
      this.voices[0].triggerAttack(frequency, time);
      this.voices[0].triggerRelease(time + this.voices[0].envelope.attack + this.voices[0].envelope.decay);
      
      // Voice 1 plays octave lower pad
      this.voices[1].triggerAttack(frequency / 2, time);
      this.voices[1].triggerRelease(time + this.voices[1].envelope.attack + this.voices[1].envelope.decay + 0.5);
    }
  }
}

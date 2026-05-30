export type Waveform = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass';

export interface EnvelopeOptions {
  attack: number;
  decay: number;
  sustain: number; 
  release: number;
}

export interface AutomationOptions {
  enabled: boolean;
  target: 'filter' | 'amplitude';
  waveform: Waveform;
  rate: number; // Hz
  depth: number;
}

export class OscillatorVoice {
  ctx: AudioContext;
  output: GainNode;
  analyser: AnalyserNode;
  
  // Audio graph nodes (created per note)
  activeNodes: {
    osc: OscillatorNode;
    filter: BiquadFilterNode;
    vca: GainNode;
    lfo?: OscillatorNode;
    lfoGain?: GainNode;
  } | null = null;

  // Settings
  waveform: Waveform = 'sine';
  filterType: FilterType = 'lowpass';
  filterCutoff: number = 2000;
  filterResonance: number = 1;
  envelope: EnvelopeOptions = { attack: 0.1, decay: 0.3, sustain: 0.5, release: 2.0 };
  automation: AutomationOptions = { enabled: false, target: 'filter', waveform: 'sine', rate: 0.5, depth: 1000 };
  volume: number = 0.5;

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.output.gain.value = this.volume;
    
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    
    this.output.connect(this.analyser);
    this.analyser.connect(destination);
  }

  setWaveform(type: Waveform) { this.waveform = type; }
  setFilter(type: FilterType, cutoff: number, resonance: number) {
    this.filterType = type;
    this.filterCutoff = cutoff;
    this.filterResonance = resonance;
    if (this.activeNodes) {
      this.activeNodes.filter.type = type;
      this.activeNodes.filter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.1);
      this.activeNodes.filter.Q.setTargetAtTime(resonance, this.ctx.currentTime, 0.1);
    }
  }
  setEnvelope(attack: number, decay: number, release: number) {
    // User requested ADR, we keep sustain at a fixed 0.5 for musicality, or we can let ADR mean A->Peak->D to 0.
    // We'll use A-D-S-R with a default sustain.
    this.envelope = { attack, decay, sustain: 0.5, release };
  }
  setAutomation(enabled: boolean, target: 'filter' | 'amplitude', waveform: Waveform, rate: number, depth: number) {
    this.automation = { enabled, target, waveform, rate, depth };
  }
  setVolume(vol: number) {
    this.volume = vol;
    this.output.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
  }

  triggerAttack(frequency: number, time: number = this.ctx.currentTime) {
    // Clean up old nodes if any
    if (this.activeNodes) {
      this.triggerRelease(time - 0.01);
    }

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const vca = this.ctx.createGain();

    osc.type = this.waveform;
    osc.frequency.value = frequency;

    filter.type = this.filterType;
    filter.frequency.value = this.filterCutoff;
    filter.Q.value = this.filterResonance;

    // Envelope
    vca.gain.setValueAtTime(0, time);
    vca.gain.linearRampToValueAtTime(1, time + this.envelope.attack);
    vca.gain.setTargetAtTime(this.envelope.sustain, time + this.envelope.attack, Math.max(0.01, this.envelope.decay / 3));

    // Automation
    let lfo: OscillatorNode | undefined;
    let lfoGain: GainNode | undefined;

    if (this.automation.enabled) {
      lfo = this.ctx.createOscillator();
      lfoGain = this.ctx.createGain();
      lfo.type = this.automation.waveform;
      lfo.frequency.value = this.automation.rate;
      
      if (this.automation.target === 'filter') {
        lfoGain.gain.value = this.automation.depth; // depth in Hz
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
      } else if (this.automation.target === 'amplitude') {
        lfoGain.gain.value = this.automation.depth; // depth 0 to 1
        lfo.connect(lfoGain);
        lfoGain.connect(vca.gain);
      }
      lfo.start(time);
    }

    // Connections
    osc.connect(filter);
    filter.connect(vca);
    vca.connect(this.output);

    osc.start(time);

    this.activeNodes = { osc, filter, vca, lfo, lfoGain };
  }

  triggerRelease(time: number = this.ctx.currentTime) {
    if (!this.activeNodes) return;
    const { osc, vca, lfo } = this.activeNodes;
    
    // Release
    vca.gain.cancelScheduledValues(time);
    vca.gain.setValueAtTime(vca.gain.value, time);
    vca.gain.linearRampToValueAtTime(0, time + this.envelope.release);
    
    osc.stop(time + this.envelope.release);
    if (lfo) lfo.stop(time + this.envelope.release);
    
    this.activeNodes = null;
  }
}

export type DrumInstrument =
  | 'kick' | 'lowTom' | 'midTom' | 'highTom' | 'frame' | 'bodhran'
  | 'djembeBass' | 'djembeTone' | 'djembeSlap' | 'conga' | 'congaSlap'
  | 'bongoLow' | 'bongoHigh' | 'doum' | 'tek' | 'ka' | 'cajonBass'
  | 'cajonSlap' | 'uduBass' | 'uduPop' | 'taiko' | 'shaker' | 'riq'
  | 'clave' | 'woodblock' | 'ocean' | 'rainstick' | 'handpan' | 'tongue';

interface HitOptions {
  frequency?: number;
  reverb?: number;
}

const NOISE_INSTRUMENTS = new Set<DrumInstrument>([
  'djembeSlap', 'congaSlap', 'tek', 'ka', 'cajonSlap', 'shaker', 'riq', 'ocean', 'rainstick',
]);

export class DrumSynth {
  private noiseBuffer: AudioBuffer;
  private ctx: AudioContext;
  private dryDestination: AudioNode;
  private reverbDestination: AudioNode;

  constructor(
    ctx: AudioContext,
    dryDestination: AudioNode,
    reverbDestination: AudioNode,
  ) {
    this.ctx = ctx;
    this.dryDestination = dryDestination;
    this.reverbDestination = reverbDestination;
    this.noiseBuffer = this.createNoiseBuffer(2);
  }

  trigger(instrument: DrumInstrument, time: number, velocity: number, options: HitOptions = {}) {
    const safeVelocity = Math.max(0.02, Math.min(1, velocity));
    const defaultReverb = instrument === 'ocean' || instrument === 'rainstick'
      ? 0.75
      : instrument === 'handpan' || instrument === 'tongue'
        ? 0.58
        : 0.42;
    const reverbSend = options.reverb ?? defaultReverb;
    if (instrument === 'handpan' || instrument === 'tongue') {
      this.triggerTuned(instrument, time, safeVelocity, options.frequency ?? 220, reverbSend);
    } else if (NOISE_INSTRUMENTS.has(instrument)) {
      this.triggerNoise(instrument, time, safeVelocity, reverbSend);
    } else {
      this.triggerMembrane(instrument, time, safeVelocity, options.frequency, reverbSend);
    }
  }

  private createNoiseBuffer(seconds: number): AudioBuffer {
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
    return buffer;
  }

  private route(source: AudioNode, reverb: number): [GainNode, GainNode] {
    const dry = this.ctx.createGain();
    const wet = this.ctx.createGain();
    dry.gain.value = 1;
    wet.gain.value = reverb;
    source.connect(dry);
    source.connect(wet);
    dry.connect(this.dryDestination);
    wet.connect(this.reverbDestination);
    return [dry, wet];
  }

  private triggerMembrane(instrument: DrumInstrument, time: number, velocity: number, override?: number, reverb = 0.12) {
    const settings: Partial<Record<DrumInstrument, [number, number, number, OscillatorType]>> = {
      kick: [110, 42, 0.34, 'sine'], lowTom: [150, 75, 0.38, 'sine'],
      midTom: [220, 120, 0.28, 'sine'], highTom: [340, 210, 0.22, 'triangle'],
      frame: [130, 68, 0.5, 'sine'], bodhran: [155, 82, 0.42, 'sine'],
      djembeBass: [145, 72, 0.36, 'sine'], djembeTone: [310, 185, 0.24, 'triangle'],
      conga: [350, 205, 0.25, 'triangle'], bongoLow: [460, 285, 0.18, 'sine'],
      bongoHigh: [620, 405, 0.14, 'sine'], doum: [190, 92, 0.38, 'sine'],
      cajonBass: [125, 62, 0.24, 'triangle'], uduBass: [170, 74, 0.48, 'sine'],
      uduPop: [430, 235, 0.16, 'sine'], taiko: [105, 48, 0.72, 'sine'],
      clave: [2200, 1650, 0.08, 'square'], woodblock: [1050, 720, 0.11, 'triangle'],
    };
    const [start, end, duration, waveform] = settings[instrument] ?? [220, 110, 0.25, 'sine'];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = waveform;
    osc.frequency.setValueAtTime(override ? override * 1.35 : start, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(25, override ?? end), time + Math.min(0.08, duration / 2));
    gain.gain.setValueAtTime(Math.max(0.0001, velocity * 0.8), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    const routed = this.route(gain, reverb);
    osc.start(time);
    osc.stop(time + duration + 0.02);
    osc.onended = () => {
      osc.disconnect(); gain.disconnect();
      routed.forEach((node) => node.disconnect());
    };
  }

  private triggerNoise(instrument: DrumInstrument, time: number, velocity: number, reverb: number) {
    const settings: Partial<Record<DrumInstrument, [number, number, number, BiquadFilterType]>> = {
      djembeSlap: [1700, 5, 0.11, 'bandpass'], congaSlap: [2400, 4, 0.09, 'bandpass'],
      tek: [3200, 3, 0.075, 'highpass'], ka: [2100, 5, 0.08, 'bandpass'],
      cajonSlap: [2600, 2, 0.12, 'highpass'], shaker: [6200, 2, 0.1, 'bandpass'],
      riq: [7600, 5, 0.18, 'bandpass'], ocean: [950, 1, 1.2, 'bandpass'],
      rainstick: [3700, 1, 0.8, 'bandpass'],
    };
    const [frequency, q, duration, filterType] = settings[instrument] ?? [3000, 2, 0.1, 'bandpass'];
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    source.buffer = this.noiseBuffer;
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    gain.gain.setValueAtTime(Math.max(0.0001, velocity * (duration > 0.5 ? 0.22 : 0.5)), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    const routed = this.route(gain, reverb);
    source.start(time);
    source.stop(time + duration + 0.02);
    source.onended = () => {
      source.disconnect(); filter.disconnect(); gain.disconnect();
      routed.forEach((node) => node.disconnect());
    };
  }

  private triggerTuned(instrument: DrumInstrument, time: number, velocity: number, frequency: number, reverb: number) {
    const partials = instrument === 'handpan' ? [1, 2.01, 3.94] : [1, 2.76, 5.4];
    const duration = instrument === 'handpan' ? 1.8 : 0.72;
    partials.forEach((partial, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency * partial;
      gain.gain.setValueAtTime(Math.max(0.0001, velocity * 0.42 / (index + 1)), time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration / (1 + index * 0.15));
      osc.connect(gain);
      const routed = this.route(gain, reverb);
      osc.start(time);
      osc.stop(time + duration + 0.02);
      osc.onended = () => {
        osc.disconnect(); gain.disconnect();
        routed.forEach((node) => node.disconnect());
      };
    });
  }
}

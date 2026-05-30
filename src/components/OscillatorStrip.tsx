import React, { useState, useEffect } from 'react';
import { OscillatorVoice, type Waveform, type FilterType } from '../audio/OscillatorVoice';
import { Knob } from './Knob';
import { Oscilloscope } from './Oscilloscope';

interface OscillatorStripProps {
  title: string;
  voice: OscillatorVoice;
}

export const OscillatorStrip: React.FC<OscillatorStripProps> = ({ title, voice }) => {
  const [waveform, setWaveform] = useState<Waveform>(voice.waveform);
  const [filterType, setFilterType] = useState<FilterType>(voice.filterType);
  const [cutoff, setCutoff] = useState(voice.filterCutoff);
  const [res, setRes] = useState(voice.filterResonance);
  const [attack, setAttack] = useState(voice.envelope.attack);
  const [decay, setDecay] = useState(voice.envelope.decay);
  const [release, setRelease] = useState(voice.envelope.release);
  const [volume, setVolume] = useState(voice.volume);
  const [lfoEnabled, setLfoEnabled] = useState(voice.automation.enabled);
  const [lfoRate, setLfoRate] = useState(voice.automation.rate);

  useEffect(() => {
    voice.setWaveform(waveform);
  }, [waveform, voice]);

  useEffect(() => {
    voice.setFilter(filterType, cutoff, res);
  }, [filterType, cutoff, res, voice]);

  useEffect(() => {
    voice.setEnvelope(attack, decay, release);
  }, [attack, decay, release, voice]);

  useEffect(() => {
    voice.setVolume(volume);
  }, [volume, voice]);

  useEffect(() => {
    voice.setAutomation(lfoEnabled, 'filter', 'sine', lfoRate, 1000);
  }, [lfoEnabled, lfoRate, voice]);

  return (
    <div className="oscillator-strip">
      <div className="strip-header">
        <h3 style={{ color: 'var(--accent-amber)' }}>{title}</h3>
        <select className="select-input" value={waveform} onChange={(e) => setWaveform(e.target.value as Waveform)}>
          <option value="sine">Sine</option>
          <option value="square">Square</option>
          <option value="sawtooth">Sawtooth</option>
          <option value="triangle">Triangle</option>
        </select>
      </div>
      <div className="strip-content">
        <Oscilloscope analyser={voice.analyser} />
        <div className="control-groups">
          <div className="control-group">
            <div className="group-title">Filter</div>
            <select className="select-input" value={filterType} onChange={(e) => setFilterType(e.target.value as FilterType)}>
              <option value="lowpass">Low Pass</option>
              <option value="highpass">High Pass</option>
              <option value="bandpass">Band Pass</option>
            </select>
            <div className="group-knobs">
              <Knob label="Cutoff" min={20} max={10000} value={cutoff} onChange={setCutoff} formatValue={(v) => Math.round(v) + 'Hz'} />
              <Knob label="Res" min={0} max={20} value={res} onChange={setRes} formatValue={(v) => v.toFixed(1)} />
            </div>
          </div>
          <div className="control-group">
            <div className="group-title">Envelope (ADR)</div>
            <div className="group-knobs">
              <Knob label="Attack" min={0.01} max={5} value={attack} onChange={setAttack} formatValue={(v) => v.toFixed(2) + 's'} />
              <Knob label="Decay" min={0.01} max={5} value={decay} onChange={setDecay} formatValue={(v) => v.toFixed(2) + 's'} />
              <Knob label="Release" min={0.01} max={5} value={release} onChange={setRelease} formatValue={(v) => v.toFixed(2) + 's'} />
            </div>
          </div>
          <div className="control-group">
            <div className="group-title">LFO & Output</div>
            <div className="group-knobs">
              <Knob label="LFO Rate" min={0.1} max={20} value={lfoRate} onChange={setLfoRate} formatValue={(v) => v.toFixed(1) + 'Hz'} />
              <Knob label="Vol" min={0} max={1} value={volume} onChange={setVolume} formatValue={(v) => (v * 100).toFixed(0) + '%'} />
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={lfoEnabled} onChange={(e) => setLfoEnabled(e.target.checked)} />
                  LFO (Filter)
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { SCALES } from './audio/Quantizer';
import { LedVisualizer } from './components/LedVisualizer';
import { OscillatorStrip } from './components/OscillatorStrip';
import { Knob } from './components/Knob';

function App() {
  const [engine] = useState(() => new AudioEngine());
  const [isPlaying, setIsPlaying] = useState(false);
  const [bits, setBits] = useState<boolean[]>(Array(16).fill(false));
  const [currentStep, setCurrentStep] = useState(0);
  
  // Turing Machine params
  const [probability, setProbability] = useState(0.1);
  const [bpm, setBpm] = useState(70);
  const [scale, setScale] = useState('Minor Pentatonic');
  
  // Master FX
  const [delayFb, setDelayFb] = useState(0.5);
  const [delayMix, setDelayMix] = useState(0.5);
  const [reverbMix, setReverbMix] = useState(0.25);

  useEffect(() => {
    engine.onStep = (step, currentBits) => {
      setCurrentStep(step);
      setBits(currentBits);
    };
  }, [engine]);

  useEffect(() => {
    engine.turingMachine.setProbability(probability);
  }, [probability, engine]);

  useEffect(() => {
    engine.bpm = bpm;
  }, [bpm, engine]);

  useEffect(() => {
    engine.quantizer.setScale(scale);
  }, [scale, engine]);

  useEffect(() => {
    engine.delayFeedback.gain.value = delayFb;
  }, [delayFb, engine]);

  useEffect(() => {
    engine.delayOutput.gain.value = delayMix;
  }, [delayMix, engine]);

  useEffect(() => {
    engine.reverbOutput.gain.value = reverbMix;
  }, [reverbMix, engine]);

  const togglePlay = async () => {
    if (!isPlaying) {
      await engine.resume();
      engine.start();
      setIsPlaying(true);
    } else {
      engine.stop();
      setIsPlaying(false);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div>
          <h1 style={{ color: 'var(--accent-cyan)' }}>Atmospheric Machine 01</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Turing Sequencer & Dual Oscillator Synth</p>
        </div>
        <div className="global-controls">
          <button className={`btn ${isPlaying ? 'primary' : ''}`} onClick={togglePlay}>
            {isPlaying ? 'STOP' : 'START'}
          </button>
        </div>
      </header>

      <LedVisualizer bits={bits} currentStep={currentStep} />

      <div className="oscillator-strip" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', gap: '32px' }}>
          <div className="control-group">
            <div className="group-title">Sequencer</div>
            <div className="group-knobs">
              <Knob label="Tempo" min={1} max={200} value={bpm} onChange={setBpm} formatValue={(v) => Math.round(v).toString()} />
              <Knob label="Morph Prob" min={0} max={1} value={probability} onChange={setProbability} formatValue={(v) => (v * 100).toFixed(0) + '%'} />
            </div>
          </div>

          <div className="control-group">
            <div className="group-title">Harmony</div>
            <div style={{ marginTop: '12px' }}>
              <select className="select-input" value={scale} onChange={(e) => setScale(e.target.value)}>
                {Object.keys(SCALES).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="control-group">
            <div className="group-title">Master FX</div>
            <div className="group-knobs">
              <Knob label="Delay Mix" min={0} max={1} value={delayMix} onChange={setDelayMix} formatValue={(v) => (v * 100).toFixed(0) + '%'} />
              <Knob label="Delay FB" min={0} max={0.95} value={delayFb} onChange={setDelayFb} formatValue={(v) => (v * 100).toFixed(0) + '%'} />
              <Knob label="Reverb Mix" min={0} max={1} value={reverbMix} onChange={setReverbMix} formatValue={(v) => (v * 100).toFixed(0) + '%'} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <OscillatorStrip title="Voice 1 (Pluck)" voice={engine.voices[0]} />
        <OscillatorStrip title="Voice 2 (Pad)" voice={engine.voices[1]} />
      </div>

      <footer style={{ marginTop: '16px', textAlign: 'center', fontSize: '11px', color: '#555' }}>
        &copy; 2026 <a href="https://vdvlabs.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>VDV Labs Inc</a>. All rights reserved. Distributed freely for non-commercial use with attribution.
      </footer>
    </div>
  );
}

export default App;

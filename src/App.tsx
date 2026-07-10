import { useState, useEffect } from 'react';
import { AudioEngine } from './audio/AudioEngine';
import { SCALES } from './audio/Quantizer';
import { LedVisualizer } from './components/LedVisualizer';
import { OscillatorStrip } from './components/OscillatorStrip';
import { Knob } from './components/Knob';
import { PercussionStrip } from './components/PercussionStrip';
import { ConductorStrip } from './components/ConductorStrip';
import { SeedControl } from './components/SeedControl';
import { PresetManager } from './components/PresetManager';
import { Rng } from './audio/Rng';
import type { PercussionKit, RhythmMode } from './audio/RhythmEngine';
import type { ConductorForm } from './audio/Conductor';
import type { EngineState } from './audio/AudioEngine';

function App() {
  const [engine] = useState(() => new AudioEngine());
  const [isPlaying, setIsPlaying] = useState(false);
  const [bits, setBits] = useState<boolean[]>(Array(16).fill(false));
  const [currentStep, setCurrentStep] = useState(0);
  
  // Turing Machine params
  const [probability, setProbability] = useState(0.1);
  const [bpm, setBpm] = useState(70);
  const [scale, setScale] = useState('Minor Pentatonic');
  const [seed, setSeed] = useState(engine.seed);
  const [kit, setKit] = useState<PercussionKit>('Off');
  const [rhythmMode, setRhythmMode] = useState<RhythmMode>('Hybrid');
  const [density, setDensity] = useState(0.35);
  const [percMix, setPercMix] = useState(0.32);
  const [percReverbMix, setPercReverbMix] = useState(0.2);
  const [percReverbRoomSize, setPercReverbRoomSize] = useState(1.1);
  const [swing, setSwing] = useState(0.04);
  const [conductorEnabled, setConductorEnabled] = useState(false);
  const [conductorForm, setConductorForm] = useState<ConductorForm>('Ballad');
  const [deviation, setDeviation] = useState(0.28);
  const [sectionBars, setSectionBars] = useState(8);
  const [voiceRevision, setVoiceRevision] = useState(0);
  
  // Master FX
  const [delayFb, setDelayFb] = useState(0.5);
  const [delayMix, setDelayMix] = useState(0.5);
  const [reverbMix, setReverbMix] = useState(0.25);

  useEffect(() => {
    engine.setOnStep((step, currentBits) => {
      setCurrentStep(step);
      setBits(currentBits);
    });
  }, [engine]);

  useEffect(() => {
    engine.setMorphProbability(probability);
  }, [probability, engine]);

  useEffect(() => {
    engine.setBpm(bpm);
  }, [bpm, engine]);

  useEffect(() => {
    engine.quantizer.setScale(scale);
  }, [scale, engine]);

  useEffect(() => { engine.setSeed(seed); }, [seed, engine]);
  useEffect(() => { engine.setKit(kit); }, [kit, engine]);
  useEffect(() => { engine.setRhythmMode(rhythmMode); }, [rhythmMode, engine]);
  useEffect(() => { engine.setDensity(density); }, [density, engine]);
  useEffect(() => { engine.setPercussionMix(percMix); }, [percMix, engine]);
  useEffect(() => { engine.setPercussionReverbMix(percReverbMix); }, [percReverbMix, engine]);
  useEffect(() => {
    engine.setPercussionReverbRoomSize(percReverbRoomSize);
  }, [percReverbRoomSize, engine]);
  useEffect(() => { engine.setSwing(swing); }, [swing, engine]);
  useEffect(() => { engine.setConductorEnabled(conductorEnabled); }, [conductorEnabled, engine]);
  useEffect(() => { engine.setConductorForm(conductorForm); }, [conductorForm, engine]);
  useEffect(() => { engine.setDeviation(deviation); }, [deviation, engine]);
  useEffect(() => { engine.setSectionBars(sectionBars); }, [sectionBars, engine]);

  useEffect(() => {
    engine.setDelayFeedback(delayFb);
  }, [delayFb, engine]);

  useEffect(() => {
    engine.setDelayMix(delayMix);
  }, [delayMix, engine]);

  useEffect(() => {
    engine.setReverbMix(reverbMix);
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

  const randomizeSeed = () => setSeed(Rng.randomSeed());

  const loadFavorite = (state: EngineState) => {
    const current = engine.getState();
    const restored: EngineState = {
      ...current,
      ...state,
      voices: state.voices?.length
        ? state.voices.map((voice, index) => ({ ...current.voices[index], ...voice }))
        : current.voices,
    };
    engine.setState(restored);
    setIsPlaying(false);
    setSeed(restored.seed);
    setBpm(restored.bpm);
    setProbability(restored.probability);
    setScale(restored.scale);
    setKit(restored.kit);
    setRhythmMode(restored.rhythmMode);
    setDensity(restored.density);
    setPercMix(restored.percussionMix);
    setPercReverbMix(restored.percussionReverbMix);
    setPercReverbRoomSize(restored.percussionReverbRoomSize);
    setSwing(restored.swing);
    setConductorEnabled(restored.conductorEnabled);
    setConductorForm(restored.conductorForm);
    setDeviation(restored.deviation);
    setSectionBars(restored.sectionBars);
    setDelayFb(restored.delayFeedback);
    setDelayMix(restored.delayMix);
    setReverbMix(restored.reverbMix);
    setVoiceRevision((revision) => revision + 1);
  };

  const captureFavoriteState = (): EngineState => ({
    ...engine.getState(),
    seed,
    bpm,
    probability,
    scale,
    kit,
    rhythmMode,
    density,
    percussionMix: percMix,
    percussionReverbMix: percReverbMix,
    percussionReverbRoomSize: percReverbRoomSize,
    swing,
    conductorEnabled,
    conductorForm,
    deviation,
    sectionBars,
    delayFeedback: delayFb,
    delayMix,
    reverbMix,
  });

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
        <div style={{ flex: 1, display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div className="control-group">
            <div className="group-title">Sequencer</div>
            <div className="group-knobs">
              <Knob label="Tempo" min={1} max={200} value={bpm} onChange={setBpm} formatValue={(v) => Math.round(v).toString()} />
              <Knob label="Morph Prob" min={0} max={1} value={probability} onChange={setProbability} formatValue={(v) => (v * 100).toFixed(0) + '%'} />
            </div>
          </div>

          <PercussionStrip kit={kit} mode={rhythmMode} density={density} mix={percMix}
            reverbMix={percReverbMix} reverbRoomSize={percReverbRoomSize} swing={swing}
            onKit={setKit} onMode={setRhythmMode} onDensity={setDensity} onMix={setPercMix}
            onReverbMix={setPercReverbMix} onReverbRoomSize={setPercReverbRoomSize}
            onSwing={setSwing} />

          <ConductorStrip enabled={conductorEnabled} form={conductorForm} deviation={deviation}
            sectionBars={sectionBars} onEnabled={setConductorEnabled} onForm={setConductorForm}
            onDeviation={setDeviation} onSectionBars={setSectionBars} />

          <SeedControl key={seed} seed={seed} onChange={setSeed} onRandomize={randomizeSeed} />

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
        <OscillatorStrip key={`voice-0-${voiceRevision}`} title="Voice 1 (Pluck)" voice={engine.voices[0]} />
        <OscillatorStrip key={`voice-1-${voiceRevision}`} title="Voice 2 (Pad)" voice={engine.voices[1]} />
      </div>

      <PresetManager captureState={captureFavoriteState} onLoad={loadFavorite} />

      <footer style={{ marginTop: '16px', textAlign: 'center', fontSize: '11px', color: '#555' }}>
        &copy; 2026 <a href="https://vdvlabs.ai" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>VDV Labs Inc</a>. All rights reserved. Distributed freely for non-commercial use with attribution.
      </footer>
    </div>
  );
}

export default App;

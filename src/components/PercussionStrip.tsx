import { Knob } from './Knob';
import { PERCUSSION_KITS, type PercussionKit, type RhythmMode } from '../audio/RhythmEngine';

interface Props {
  kit: PercussionKit;
  mode: RhythmMode;
  density: number;
  mix: number;
  reverbMix: number;
  reverbRoomSize: number;
  swing: number;
  onKit: (value: PercussionKit) => void;
  onMode: (value: RhythmMode) => void;
  onDensity: (value: number) => void;
  onMix: (value: number) => void;
  onReverbMix: (value: number) => void;
  onReverbRoomSize: (value: number) => void;
  onSwing: (value: number) => void;
}

export function PercussionStrip(props: Props) {
  return (
    <div className="control-group">
      <div className="group-title">Percussion</div>
      <select aria-label="Percussion kit" className="select-input" value={props.kit}
        onChange={(event) => props.onKit(event.target.value as PercussionKit)}>
        {PERCUSSION_KITS.map((kit) => <option key={kit}>{kit}</option>)}
      </select>
      <select aria-label="Rhythm mode" className="select-input" value={props.mode}
        onChange={(event) => props.onMode(event.target.value as RhythmMode)}>
        {(['Generative', 'Fixed', 'Hybrid'] as RhythmMode[]).map((mode) => <option key={mode}>{mode}</option>)}
      </select>
      <div className="group-knobs">
        <Knob label="Density" min={0} max={1} value={props.density} onChange={props.onDensity}
          formatValue={(value) => `${Math.round(value * 100)}%`} />
        <Knob label="Perc Mix" min={0} max={1} value={props.mix} onChange={props.onMix}
          formatValue={(value) => `${Math.round(value * 100)}%`} />
        <Knob label="Reverb Mix" min={0} max={1} value={props.reverbMix} onChange={props.onReverbMix}
          formatValue={(value) => `${Math.round(value * 100)}%`} />
        <Knob label="Room Size" min={0.35} max={8} value={props.reverbRoomSize}
          onChange={props.onReverbRoomSize} formatValue={(value) => `${value.toFixed(1)}s`} />
        <Knob label="Swing" min={0} max={0.45} value={props.swing} onChange={props.onSwing}
          formatValue={(value) => `${Math.round(value * 100)}%`} />
      </div>
    </div>
  );
}

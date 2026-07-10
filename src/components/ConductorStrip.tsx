import { CONDUCTOR_FORMS, type ConductorForm } from '../audio/Conductor';
import { Knob } from './Knob';

interface Props {
  enabled: boolean;
  form: ConductorForm;
  deviation: number;
  sectionBars: number;
  onEnabled: (value: boolean) => void;
  onForm: (value: ConductorForm) => void;
  onDeviation: (value: number) => void;
  onSectionBars: (value: number) => void;
}

export function ConductorStrip(props: Props) {
  return (
    <div className="control-group">
      <div className="group-title">Conductor</div>
      <label className="toggle-label">
        <input aria-label="Enable conductor" type="checkbox" checked={props.enabled}
          onChange={(event) => props.onEnabled(event.target.checked)} />
        Arrange the journey
      </label>
      <select aria-label="Conductor form" className="select-input" value={props.form}
        onChange={(event) => props.onForm(event.target.value as ConductorForm)} disabled={!props.enabled}>
        {CONDUCTOR_FORMS.map((form) => <option key={form}>{form}</option>)}
      </select>
      <div className="group-knobs" style={{ opacity: props.enabled ? 1 : 0.45 }}>
        <Knob label="Deviation" min={0} max={1} value={props.deviation} onChange={props.onDeviation}
          formatValue={(value) => `${Math.round(value * 100)}%`} />
        <Knob label="Section" min={2} max={32} value={props.sectionBars} onChange={props.onSectionBars}
          formatValue={(value) => `${Math.round(value)} bars`} />
      </div>
    </div>
  );
}

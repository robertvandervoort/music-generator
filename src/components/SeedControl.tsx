import { useState } from 'react';

interface Props {
  seed: string;
  onChange: (seed: string) => void;
  onRandomize: () => void;
}

export function SeedControl({ seed, onChange, onRandomize }: Props) {
  const [draft, setDraft] = useState(seed);

  return (
    <div className="control-group">
      <div className="group-title">Seed</div>
      <label className="field-label">
        Arrangement seed
        <input aria-label="Arrangement seed" className="text-input" value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && draft.trim()) onChange(draft.trim()); }} />
      </label>
      <div className="favorite-actions">
        <button className="btn compact" type="button" onClick={() => draft.trim() && onChange(draft.trim())}>Apply</button>
        <button className="btn compact" type="button" onClick={onRandomize}>Randomize</button>
      </div>
    </div>
  );
}

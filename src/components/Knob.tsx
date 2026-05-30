import React, { useState, useRef } from 'react';

interface KnobProps {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (val: number) => void;
  formatValue?: (val: number) => string;
}

export const Knob: React.FC<KnobProps> = ({ label, min, max, value, onChange, formatValue }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(value);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    startY.current = e.clientY;
    startVal.current = value;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const deltaY = startY.current - e.clientY;
    // 150 pixels of drag = full range
    const range = max - min;
    const change = (deltaY / 150) * range;
    let newVal = startVal.current + change;
    newVal = Math.max(min, Math.min(max, newVal));
    onChange(newVal);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  const percentage = (value - min) / (max - min);
  const angle = percentage * 270 - 135; // -135 to +135 degrees

  const displayVal = formatValue ? formatValue(value) : value.toFixed(2);

  return (
    <div className="knob-container">
      <div 
        className="knob"
        style={{ width: '40px', height: '40px' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div style={{
          position: 'absolute',
          top: '3px',
          left: '50%',
          width: '3px',
          height: '10px',
          backgroundColor: 'var(--accent-amber)',
          transformOrigin: '50% 17px',
          transform: `translateX(-50%) rotate(${angle}deg)`,
          borderRadius: '2px',
          boxShadow: '0 0 5px var(--accent-amber)'
        }} />
      </div>
      <div className="knob-label">{label}</div>
      <div className="knob-value">{displayVal}</div>
    </div>
  );
};

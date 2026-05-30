import React from 'react';

interface LedVisualizerProps {
  bits: boolean[];
  currentStep: number;
}

export const LedVisualizer: React.FC<LedVisualizerProps> = ({ bits, currentStep }) => {
  return (
    <div className="sequencer-panel">
      <div className="led-array">
        {bits.map((bit, index) => (
          <div key={index} className="led-wrapper">
            <div className={`led ${bit ? 'active' : ''} ${index === currentStep ? 'active-step' : ''}`} />
            <span className="led-index">{index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

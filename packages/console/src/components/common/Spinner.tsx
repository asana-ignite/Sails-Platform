import React from 'react';
import './Spinner.css';

interface SpinnerProps {
  size?: number;
  color?: string;
  label?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ 
  size = 24, 
  color = 'var(--klao-primary)', 
  label 
}) => {
  return (
    <div className="klao-spinner-container">
      <div 
        className="klao-spinner" 
        style={{ 
          width: size, 
          height: size, 
          borderColor: `${color} transparent transparent transparent` 
        }}
      ></div>
      {label && <span className="klao-spinner-label">{label}</span>}
    </div>
  );
};

export default Spinner;

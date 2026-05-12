import React from 'react';
import './Spinner.css';

interface SpinnerProps {
  size?: number;
  color?: string;
  label?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ 
  size = 24, 
  color = 'var(--inidos-primary)', 
  label 
}) => {
  return (
    <div className="inidos-spinner-container">
      <div 
        className="inidos-spinner" 
        style={{ 
          width: size, 
          height: size, 
          borderColor: `${color} transparent transparent transparent` 
        }}
      ></div>
      {label && <span className="inidos-spinner-label">{label}</span>}
    </div>
  );
};

export default Spinner;

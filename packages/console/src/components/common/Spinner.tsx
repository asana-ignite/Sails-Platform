import React from 'react';

interface SpinnerProps {
  size?: number;
  color?: string;
  label?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ 
  size = 24, 
  color = 'var(--sails-primary)', 
  label 
}) => {
  return (
    <div className="sails-spinner-container">
      <div 
        className="sails-spinner" 
        style={{ 
          width: size, 
          height: size, 
          borderColor: `${color} transparent transparent transparent` 
        }}
      ></div>
      {label && <span className="sails-spinner-label">{label}</span>}
    </div>
  );
};

export default Spinner;

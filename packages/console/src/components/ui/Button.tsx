import React from 'react';
import './Button.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * INIDOS UI: Standard Button
 * Follows BEM naming convention.
 */
export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  ...props 
}) => {
  const classes = `inidos-btn inidos-btn--${variant} inidos-btn--${size} ${className}`;
  
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
};

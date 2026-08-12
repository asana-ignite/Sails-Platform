/**
 * FieldControlWrapper — common chrome around a field control (label,
 * errors, hints).
 */
import React from 'react';
import type { FieldControlProps } from './types';
import './controls.css';

interface FieldControlWrapperProps extends FieldControlProps {
  children: React.ReactNode;
}

export const FieldControlWrapper: React.FC<FieldControlWrapperProps> = ({
  error,
  size = 'md',
  variant = 'glass',
  disabled,
  readOnly,
  className = '',
  children,
}) => {
  const sizeClass = {
    sm: 'sails-control-wrapper__field--size-sm',
    md: 'sails-control-wrapper__field--size-md',
    lg: 'sails-control-wrapper__field--size-lg',
  }[size];

  const variantClass = {
    default: 'sails-control-wrapper__field--variant-default',
    ghost: 'sails-control-wrapper__field--variant-ghost',
    glass: 'sails-control-wrapper__field--variant-glass',
  }[variant];

  const stateClass = disabled || readOnly
    ? 'is-disabled'
    : 'is-active';

  const errorClass = error ? 'is-error' : '';

  return (
    <div className="sails-control-wrapper">
      <div
        className={`sails-control-wrapper__field ${sizeClass} ${variantClass} ${errorClass} ${stateClass} ${className}`}
      >
        {children}
      </div>
      {error && (
        <span className="sails-control-wrapper__error">
          {error}
        </span>
      )}
    </div>
  );
};

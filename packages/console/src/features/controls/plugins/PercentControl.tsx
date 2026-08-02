import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const PercentControl: FieldControlPlugin = {
  id: 'control:percent',
  name: 'Percentage Input',
  description: 'Numeric input control with % symbol suffix',
  iconName: 'Percent',
  compatibleTypes: ['percentage', 'percent'],
  isDefault: true,

  mockValue: () => 75,

  RenderEdit: ({ value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => (
    <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
      <input
        type="number"
        step="0.01"
        readOnly={readOnly}
        disabled={disabled}
        value={value ?? ''}
        placeholder="0.00"
        onChange={(e) => onChange && onChange(e.target.value)}
        className={`sails-input ${className}`}
        style={{ textAlign: 'right', paddingRight: '28px' }}
      />
      <span
        style={{
          position: 'absolute',
          right: '10px',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--sails-text-muted, #94a3b8)',
          pointerEvents: 'none'
        }}
      >
        %
      </span>
    </div>
  ),

  RenderDisplay: ({ value }: FieldControlProps) => (
    <span>
      {value !== undefined && value !== null && value !== '' ? `${value}%` : '—'}
    </span>
  ),
};

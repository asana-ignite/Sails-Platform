import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const DecimalControl: FieldControlPlugin = {
  id: 'control:decimal',
  name: 'Decimal Input',
  description: 'Decimal numeric input control (step 0.01)',
  iconName: 'Binary',
  compatibleTypes: ['decimal'],
  isDefault: true,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => (
    <input
      type="number"
      step="0.01"
      readOnly={readOnly}
      disabled={disabled}
      value={value ?? ''}
      placeholder="0.00"
      onChange={(e) => onChange && onChange(e.target.value)}
      className={`sails-input w-full text-right ${className}`}
      style={{ textAlign: 'right' }}
    />
  ),

  RenderDisplay: ({ value }: FieldControlProps) => (
    <span className="text-xs text-slate-200">{value !== undefined && value !== null && value !== '' ? String(value) : '—'}</span>
  ),
};

import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const NumberControl: FieldControlPlugin = {
  id: 'control:number',
  name: 'Number Input',
  description: 'Integer numeric input control',
  iconName: 'Hash',
  compatibleTypes: ['number'],
  isDefault: true,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => (
    <input
      type="number"
      step="1"
      readOnly={readOnly}
      disabled={disabled}
      value={value ?? ''}
      placeholder="0"
      onChange={(e) => onChange && onChange(e.target.value)}
      className={`sails-input w-full text-right ${className}`}
      style={{ textAlign: 'right' }}
    />
  ),

  RenderDisplay: ({ value }: FieldControlProps) => (
    <span className="text-xs text-slate-200">{value !== undefined && value !== null && value !== '' ? String(value) : '—'}</span>
  ),
};

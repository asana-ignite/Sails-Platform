import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const DateControl: FieldControlPlugin = {
  id: 'control:date',
  name: 'Date Picker Input',
  description: 'Calendar date picker control',
  iconName: 'Calendar',
  compatibleTypes: ['date'],
  isDefault: true,

  RenderEdit: ({ value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => (
    <input
      type="date"
      readOnly={readOnly}
      disabled={disabled}
      value={value ?? ''}
      onChange={(e) => onChange && onChange(e.target.value)}
      className={`sails-input w-full [color-scheme:dark] ${className}`}
    />
  ),

  RenderDisplay: ({ value }: FieldControlProps) => (
    <span className="text-xs text-slate-200">{value ? String(value) : '—'}</span>
  ),
};

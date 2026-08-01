import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const TimeControl: FieldControlPlugin = {
  id: 'control:time',
  name: 'Time Picker Input',
  description: 'Clock time picker control',
  iconName: 'Clock',
  compatibleTypes: ['time'],
  isDefault: true,

  RenderEdit: ({ value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => (
    <input
      type="time"
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

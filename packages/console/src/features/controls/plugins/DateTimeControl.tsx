import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const DateTimeControl: FieldControlPlugin = {
  id: 'control:datetime',
  name: 'Date & Time Picker Input',
  description: 'Calendar date and timestamp picker control',
  iconName: 'CalendarDays',
  compatibleTypes: ['datetime', 'timestamp'],
  isDefault: true,

  RenderEdit: ({ value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => (
    <input
      type="datetime-local"
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

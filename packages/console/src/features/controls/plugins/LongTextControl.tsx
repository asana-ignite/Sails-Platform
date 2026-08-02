import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const LongTextControl: FieldControlPlugin = {
  id: 'control:long_text',
  name: 'Multiline Text Area',
  description: 'Multi-line text area input',
  iconName: 'AlignLeft',
  compatibleTypes: ['long_text', 'text'],
  isDefault: true,

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const placeholder = (field?.config as any)?.placeholder || `Provide ${field?.name || 'details'}...`;
    const numRows = (field?.config as any)?.rows || 3;
    return (
      <textarea
        rows={numRows}
        readOnly={readOnly}
        disabled={disabled}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange && onChange(e.target.value)}
        className={`sails-input w-full resize-y ${className}`}
      />
    );
  },

  RenderDisplay: ({ value }: FieldControlProps) => (
    <p className="text-xs text-slate-300 whitespace-pre-wrap">{value !== undefined && value !== null && value !== '' ? String(value) : '—'}</p>
  ),
};

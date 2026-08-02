import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const ShortTextControl: FieldControlPlugin = {
  id: 'control:short_text',
  name: 'Standard Textbox',
  description: 'Single-line text input control',
  iconName: 'Type',
  compatibleTypes: ['short_text', 'text', 'email', 'phone', 'url'],
  isDefault: true,

  mockValue: (field) => {
    switch (field.logicalType) {
      case 'email': return 'user@example.com';
      case 'phone': return '+66 2 123 4567';
      case 'url': return 'https://example.com';
      default: return 'Sample text';
    }
  },

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const placeholder = (field?.config as any)?.placeholder || `Enter ${field?.name || 'text'}...`;
    return (
      <input
        type="text"
        readOnly={readOnly}
        disabled={disabled}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange && onChange(e.target.value)}
        className={`sails-input ${className}`}
      />
    );
  },

  RenderDisplay: ({ value }: FieldControlProps) => (
    <span>{value !== undefined && value !== null && value !== '' ? String(value) : '—'}</span>
  ),
};

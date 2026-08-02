import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

export const AddressControl: FieldControlPlugin = {
  id: 'control:address',
  name: 'Address Field',
  description: 'Multi-line unified address input with formatted display',
  iconName: 'MapPin',
  compatibleTypes: ['address'],
  isDefault: true,

  mockValue: () => '123 Main St, Suite 400\nNew York, NY 10001',

  RenderEdit: ({ field, value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => {
    const placeholder = (field?.config as any)?.placeholder || 'Enter address...';
    return (
      <textarea
        rows={2}
        readOnly={readOnly}
        disabled={disabled}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange && onChange(e.target.value)}
        className={`sails-input ${className}`}
        style={{ resize: 'vertical', minHeight: 56 }}
      />
    );
  },

  RenderDisplay: ({ value }: FieldControlProps) => {
    if (value === undefined || value === null || value === '') return <span>—</span>;
    return (
      <span style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
      </span>
    );
  },
};

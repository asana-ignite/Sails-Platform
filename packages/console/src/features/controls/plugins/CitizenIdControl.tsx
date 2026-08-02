import React from 'react';
import type { FieldControlPlugin, FieldControlProps } from '../types';

// Format a 13-digit Thai citizen ID as X-XXXX-XXXXX-XX-X
const formatCitizenId = (val: string): string => {
  const digits = String(val).replace(/[^\d]/g, '').slice(0, 13);
  const parts = [
    digits.slice(0, 1),
    digits.slice(1, 5),
    digits.slice(5, 10),
    digits.slice(10, 12),
    digits.slice(12, 13),
  ].filter((p) => p.length > 0);
  return parts.join('-');
};

export const CitizenIdControl: FieldControlPlugin = {
  id: 'control:citizen_id',
  name: 'Thai Citizen ID',
  description: 'Formatted 13-digit Thai national ID input (X-XXXX-XXXXX-XX-X)',
  iconName: 'CreditCard',
  compatibleTypes: ['citizen_id'],
  isDefault: true,

  mockValue: () => '1234567890121',

  RenderEdit: ({ value, onChange, disabled, readOnly, className = '' }: FieldControlProps) => (
    <input
      type="text"
      inputMode="numeric"
      readOnly={readOnly}
      disabled={disabled}
      value={value ? formatCitizenId(String(value)) : ''}
      placeholder="1-2345-67890-12-3"
      onChange={(e) => {
        if (!onChange) return;
        const digits = e.target.value.replace(/[^\d]/g, '').slice(0, 13);
        onChange(digits);
      }}
      className={`sails-input ${className}`}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    />
  ),

  RenderDisplay: ({ value }: FieldControlProps) => {
    if (value === undefined || value === null || value === '') return <span>—</span>;
    return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCitizenId(String(value))}</span>;
  },
};
